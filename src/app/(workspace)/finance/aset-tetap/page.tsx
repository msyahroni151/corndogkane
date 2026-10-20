import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib } from "@/lib/placements";
import { dateToDisplay, APP_TIME_ZONE } from "@/lib/local-date";
import {
  assetConditions,
  assetStatuses,
  assetEvents,
  assetMoney,
  assetLocationLabel,
  isFixedAssetAccount,
  type AssetFormRecord,
  type AssetChoices,
} from "@/lib/fixed-assets";
import { FormDialog } from "@/components/form-dialog";
import { FixedAssetForm, FixedAssetMoveForm } from "@/components/fixed-asset-forms";
import { SortableTable } from "@/components/sortable-table";
import type { FixedAsset, Prisma } from "@/generated/prisma/client";
import "@/components/fixed-assets.css";
function record(a: FixedAsset): AssetFormRecord {
  return {
    ...a,
    version: a.updatedAt.toISOString(),
    acquiredAt: a.acquiredAt?.toISOString().slice(0, 10) || "",
    inUseAt: a.inUseAt?.toISOString().slice(0, 10) || "",
    acquisitionCost: a.acquisitionCost?.toString() ?? null,
  };
}
function snapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function changes(before: unknown, after: unknown) {
  const a = snapshot(before),
    b = snapshot(after);
  const labels: Record<string, string> = {
    name: "Nama",
    categoryName: "Kategori",
    brandModel: "Merek/model",
    serialNumber: "Nomor seri",
    registrationType: "Jenis pencatatan",
    acquiredAt: "Tanggal perolehan",
    inUseAt: "Mulai pakai",
    acquisitionCost: "Harga perolehan",
    invoiceNumber: "Invoice",
    evidenceUrl: "Bukti",
    locationType: "Jenis lokasi",
    locationName: "Lokasi",
    locationDetail: "Detail lokasi",
    responsibleName: "Penanggung jawab",
    condition: "Kondisi",
    status: "Status",
    notes: "Catatan",
  };
  const display = (key: string, v: unknown) => {
    if (v == null || v === "") return "—";
    if (key === "acquisitionCost") return assetMoney(String(v));
    if (key === "condition")
      return assetConditions[String(v) as keyof typeof assetConditions] || String(v);
    if (key === "status")
      return assetStatuses[String(v) as keyof typeof assetStatuses] || String(v);
    if (key === "registrationType") return v === "NEW" ? "Aset baru" : "Aset lama";
    if (key === "acquiredAt" || key === "inUseAt") return dateToDisplay(String(v).slice(0, 10));
    return String(v);
  };
  return Object.entries(labels)
    .filter(([key]) => JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null))
    .map(([key, label]) => ({ label, before: display(key, a[key]), after: display(key, b[key]) }));
}
export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAccess("finance-assets");
  const params = await searchParams,
    query = (key: string, max = 200) =>
      typeof params[key] === "string" ? (params[key] as string).trim().slice(0, max) : "";
  const tab = query("tab") === "riwayat" ? "riwayat" : "daftar",
    q = query("q"),
    location = query("location"),
    status = query("status"),
    condition = query("condition"),
    categoryId = query("category"),
    assetId = query("asset", 100),
    eventType = query("event");
  let error = "";
  if (
    (location && !["KANTOR", "OUTLET"].includes(location)) ||
    (status && !Object.hasOwn(assetStatuses, status)) ||
    (condition && !Object.hasOwn(assetConditions, condition)) ||
    (eventType && !Object.hasOwn(assetEvents, eventType))
  )
    error = "Filter aset tidak valid. Pilih kembali filter yang tersedia.";
  const db = getPrisma(),
    today = todayWib();
  const [accounts, outlets, employees] = await Promise.all([
    db.financialAccount.findMany({
      where: { kind: "ASET", subGroup: "Aset Tetap" },
      select: { id: true, code: true, name: true, kind: true, subGroup: true, active: true },
      orderBy: { code: "asc" },
    }),
    db.outlet.findMany({
      where: { active: true, closed: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.employee.findMany({
      where: { active: true },
      select: { fullName: true, employeeCode: true },
      orderBy: { fullName: "asc" },
      take: 1000,
    }),
  ]);
  const choices: AssetChoices = {
    accounts: accounts
      .filter(isFixedAssetAccount)
      .map((a) => ({ id: a.id, code: a.code, name: a.name })),
    outlets,
    people: [
      ...new Set(employees.map((e) => [e.fullName, e.employeeCode].filter(Boolean).join(" - "))),
    ],
  };
  const where: Prisma.FixedAssetWhereInput = {
    ...(location ? { locationType: location } : {}),
    ...(status ? { status } : {}),
    ...(condition ? { condition } : {}),
    ...(categoryId ? { categoryAccountId: categoryId } : {}),
    ...(q
      ? {
          OR: ["code", "name", "serialNumber", "brandModel", "responsibleName", "locationName"].map(
            (key) => ({ [key]: { contains: q, mode: "insensitive" as const } }),
          ),
        }
      : {}),
  };
  const rows =
    tab === "daftar" && !error
      ? await db.fixedAsset.findMany({ where, orderBy: { code: "asc" }, take: 500 })
      : [];
  const groups =
    tab === "daftar" && !error
      ? await db.fixedAsset.groupBy({
          by: ["locationType"],
          where,
          _count: { _all: true, acquisitionCost: true },
          _sum: { acquisitionCost: true },
        })
      : [];
  const total = groups.reduce((n, g) => n + g._count._all, 0),
    knownCost = groups.reduce((n, g) => n + g._count.acquisitionCost, 0),
    cost = groups.reduce((n, g) => n + (g._sum.acquisitionCost ?? BigInt(0)), BigInt(0));
  const damaged =
    tab === "daftar" && !error
      ? await db.fixedAsset.count({ where: { AND: [where, { condition: { not: "BAIK" } }] } })
      : 0;
  const eventWhere: Prisma.AssetEventWhereInput = {
    ...(assetId ? { assetId } : {}),
    ...(eventType ? { type: eventType } : {}),
    ...(q
      ? {
          asset: {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const [events, eventCount] =
    tab === "riwayat" && !error
      ? await Promise.all([
          db.assetEvent.findMany({
            where: eventWhere,
            include: {
              asset: { select: { code: true, name: true } },
              actor: { select: { name: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 500,
          }),
          db.assetEvent.count({ where: eventWhere }),
        ])
      : [[], 0];
  const selected = assetId
    ? await db.fixedAsset.findUnique({ where: { id: assetId }, select: { code: true, name: true } })
    : null;
  return (
    <div className="asset-workspace">
      <nav className="asset-tabs" aria-label="Submenu Aset Tetap">
        <Link href="/finance/aset-tetap" aria-current={tab === "daftar" ? "page" : undefined}>
          Daftar Aset
        </Link>
        <Link
          href="/finance/aset-tetap?tab=riwayat"
          aria-current={tab === "riwayat" ? "page" : undefined}
        >
          Riwayat Aset
        </Link>
      </nav>
      <div className="asset-heading">
        <div>
          <h2>{tab === "daftar" ? "Daftar aset kantor & outlet" : "Riwayat Aset"}</h2>
          <p>
            {tab === "daftar"
              ? "Satu unit per baris · lokasi, kondisi, dan penanggung jawab tercatat."
              : "Pendaftaran, perubahan data, dan perpindahan aset beserta pengguna yang mencatatnya."}
          </p>
        </div>
        {tab === "daftar" && (
          <FormDialog
            title="Tambah Aset"
            trigger="+ Tambah Aset"
            subtitle="Daftarkan aset kantor atau outlet"
          >
            <FixedAssetForm choices={choices} today={today} />
          </FormDialog>
        )}
      </div>
      {tab === "daftar" ? (
        <>
          <div className="asset-stats">
            {[
              ["Total aset", total + " unit"],
              [
                "Lokasi asset (Kantor)",
                (groups.find((g) => g.locationType === "KANTOR")?._count._all || 0) + " unit",
              ],
              [
                "Lokasi asset (Outlet)",
                (groups.find((g) => g.locationType === "OUTLET")?._count._all || 0) + " unit",
              ],
              ["Kondisi rusak", damaged + " unit"],
              ["Nilai perolehan tercatat", knownCost ? assetMoney(cost) : "—"],
            ].map(([label, value]) => (
              <section className="panel" key={label}>
                <p>{label}</p>
                <strong>{value}</strong>
                {label === "Nilai perolehan tercatat" && (
                  <small>
                    {knownCost}/{total} aset memiliki harga
                  </small>
                )}
              </section>
            ))}
          </div>
          <form className="panel asset-filters">
            <input type="hidden" name="tab" value="daftar" />
            <label className="field asset-search">
              Cari aset
              <input
                name="q"
                defaultValue={q}
                placeholder="Kode, nama, lokasi, atau penanggung jawab..."
                aria-label="Cari aset"
                maxLength={200}
              />
            </label>
            <label className="field">
              Lokasi
              <select name="location" aria-label="Filter lokasi" defaultValue={location}>
                <option value="">Semua lokasi</option>
                <option value="KANTOR">Kantor</option>
                <option value="OUTLET">Outlet</option>
              </select>
            </label>
            <label className="field">
              Kategori
              <select name="category" aria-label="Filter kategori" defaultValue={categoryId}>
                <option value="">Semua kategori</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Kondisi
              <select name="condition" aria-label="Filter kondisi" defaultValue={condition}>
                <option value="">Semua kondisi</option>
                {Object.entries(assetConditions).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Status
              <select name="status" aria-label="Filter status" defaultValue={status}>
                <option value="">Semua status</option>
                {Object.entries(assetStatuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-secondary">Terapkan</button>
            <Link href="/finance/aset-tetap" className="button-secondary">
              Reset
            </Link>
          </form>
          {error && (
            <p className="asset-error" role="alert">
              {error}
            </p>
          )}
          <section className="panel asset-table-panel" aria-label="Daftar Aset">
            <div className="asset-table-title">
              <strong>{total} aset sesuai filter</strong>
              <small>
                Nilai perolehan merupakan data inventaris, bukan saldo buku setelah penyusutan.
              </small>
            </div>
            <div className="asset-table-scroll">
              <SortableTable className="asset-table">
                <thead>
                  <tr>
                    {[
                      "Kode / Nama aset",
                      "Kategori",
                      "Lokasi",
                      "Penanggung jawab",
                      "Kondisi",
                      "Status",
                      "Harga perolehan",
                      "Tanggal perolehan",
                      "Aksi",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const dto = record(a);
                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.code}</strong>
                          <span>{a.name}</span>
                          {a.brandModel && <small>{a.brandModel}</small>}
                        </td>
                        <td>{a.categoryName}</td>
                        <td>{assetLocationLabel(a)}</td>
                        <td>{a.responsibleName || "—"}</td>
                        <td>
                          <span
                            className={
                              "asset-badge " + (a.condition === "BAIK" ? "is-good" : "is-warning")
                            }
                          >
                            {assetConditions[a.condition as keyof typeof assetConditions]}
                          </span>
                        </td>
                        <td>{assetStatuses[a.status as keyof typeof assetStatuses]}</td>
                        <td
                          className="asset-money"
                          data-sort-value={a.acquisitionCost?.toString() ?? ""}
                        >
                          {assetMoney(a.acquisitionCost)}
                        </td>
                        <td data-sort-value={a.acquiredAt?.getTime() ?? ""}>
                          {a.acquiredAt
                            ? dateToDisplay(a.acquiredAt.toISOString().slice(0, 10))
                            : "—"}
                        </td>
                        <td>
                          <div className="asset-actions">
                            <FormDialog title={"Detail / Edit · " + a.code} trigger="Detail / Edit">
                              <FixedAssetForm choices={choices} record={dto} today={today} />
                            </FormDialog>
                            <FormDialog title={"Pindahkan Aset · " + a.code} trigger="Pindahkan">
                              <FixedAssetMoveForm choices={choices} record={dto} />
                            </FormDialog>
                            <Link
                              className="button-secondary"
                              href={
                                "/finance/aset-tetap?tab=riwayat&asset=" + encodeURIComponent(a.id)
                              }
                            >
                              Riwayat
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={9} className="asset-empty">
                        Belum ada aset untuk filter ini. Tambahkan aset kantor atau outlet melalui
                        tombol Tambah Aset.
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableTable>
            </div>
            {total > 500 && (
              <p className="asset-help">
                Menampilkan 500 aset pertama. Persempit filter atau pencarian untuk melihat aset
                lainnya.
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <form className="panel asset-filters">
            <input type="hidden" name="tab" value="riwayat" />
            {assetId && <input type="hidden" name="asset" value={assetId} />}
            <label className="field asset-search">
              Cari riwayat
              <input
                name="q"
                aria-label="Cari riwayat"
                defaultValue={q}
                placeholder="Kode atau nama aset..."
                maxLength={200}
              />
            </label>
            <label className="field">
              Jenis aktivitas
              <select name="event" aria-label="Jenis aktivitas" defaultValue={eventType}>
                <option value="">Semua aktivitas</option>
                {Object.entries(assetEvents).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-secondary">Terapkan</button>
            <Link className="button-secondary" href="/finance/aset-tetap?tab=riwayat">
              Semua riwayat
            </Link>
          </form>
          {selected && (
            <p className="asset-help">
              Riwayat:{" "}
              <strong>
                {selected.code} · {selected.name}
              </strong>
            </p>
          )}
          {assetId && !selected && (
            <p className="asset-error" role="alert">
              Aset tidak ditemukan.
            </p>
          )}
          {error && (
            <p className="asset-error" role="alert">
              {error}
            </p>
          )}
          <section className="panel asset-table-panel" aria-label="Riwayat Aset">
            <div className="asset-table-title">
              <strong>{eventCount} aktivitas</strong>
              <small>Catatan riwayat tersimpan dan tidak dapat dihapus dari halaman ini.</small>
            </div>
            <div className="asset-table-scroll">
              <SortableTable className="asset-table asset-history-table">
                <thead>
                  <tr>
                    {[
                      "Waktu (WIB)",
                      "Aset",
                      "Aktivitas",
                      "Rincian perubahan",
                      "Keterangan",
                      "Dicatat oleh",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const diff = changes(e.before, e.after);
                    return (
                      <tr key={e.id}>
                        <td className="asset-nowrap" data-sort-value={e.createdAt.getTime()}>
                          {new Intl.DateTimeFormat("id-ID", {
                            timeZone: APP_TIME_ZONE,
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(e.createdAt)}
                        </td>
                        <td>
                          <strong>{e.asset.code}</strong>
                          <span>{e.asset.name}</span>
                        </td>
                        <td>{assetEvents[e.type as keyof typeof assetEvents]}</td>
                        <td>
                          <details className="asset-event-details">
                            <summary>
                              {e.type === "MOVED"
                                ? "Lokasi / penanggung jawab berubah"
                                : diff.length + " isian tercatat"}
                            </summary>
                            <ul>
                              {diff.map((d) => (
                                <li key={d.label}>
                                  <strong>{d.label}</strong>
                                  <span>
                                    {d.before} → {d.after}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                        <td>{e.notes || "—"}</td>
                        <td>{e.actor.name}</td>
                      </tr>
                    );
                  })}
                  {!events.length && (
                    <tr>
                      <td className="asset-empty" colSpan={6}>
                        Belum ada riwayat aset untuk filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableTable>
            </div>
            {eventCount > 500 && (
              <p className="asset-help">
                Menampilkan 500 aktivitas terbaru. Gunakan pencarian aset untuk mempersempit
                riwayat.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
