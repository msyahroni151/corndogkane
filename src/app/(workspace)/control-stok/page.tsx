import { ControlStockTabs } from "@/components/control-stock-tabs";
import { StockReturnsWorkspace } from "@/components/stock-returns-workspace";
import Link from "next/link";
import "@/components/outlet-monitoring.css";
import { warehouseKindNames } from "@/lib/inventory";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { rupiah } from "@/lib/money";
import { quantityLabel } from "@/lib/goods-receipts";
import { orderStatusNames, stockEventNames } from "@/lib/outlet-stock";
import { UiIcon, type IconName } from "@/components/ui-icon";
import { SortableTable } from "@/components/sortable-table";
import { FormDialog } from "@/components/form-dialog";
import {
  OutletRequestForm,
  OutletPhysicalForm,
  OutletOrderAction,
  type OutletStockOptions,
} from "@/components/outlet-stock-forms";
const stamp = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(d) + " WIB";
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: IconName;
}) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
          <UiIcon name={icon} size={18} />
        </span>
      </div>
      <p className="mt-3 break-words text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </section>
  );
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; outlet?: string; status?: string }>;
}) {
  await requireAccess("control-stok");
  const query = await searchParams,
    tab = ["requests", "returns", "history"].includes(query.tab || "") ? query.tab! : "stock",
    outletId = typeof query.outlet === "string" ? query.outlet : "",
    db = getPrisma();
  if (tab === "returns")
    return (
      <div className="space-y-5">
        <ControlStockTabs tab={tab} outletId={outletId} />
        <StockReturnsWorkspace
          outletId={outletId}
          status={typeof query.status === "string" ? query.status : ""}
        />
      </div>
    );
  const [outlets, items, balances, recentOrders, openOrders, events, warehouseTotal] =
    await Promise.all([
      db.outlet.findMany({
        include: { area: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      db.inventoryItem.findMany({
        where: { kind: { in: ["RAW", "SUB", "FINISHED"] } },
        include: {
          batches: { select: { baseUnit: true, remainingQuantity: true, remainingValue: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.outletStock.findMany({ include: { item: { select: { name: true, active: true } } } }),
      db.outletStockOrder.findMany({
        where: {
          status: { notIn: ["REQUESTED", "SENT"] },
          ...(outletId ? { outletId } : {}),
        },
        include: {
          outlet: { select: { name: true } },
          createdBy: { select: { name: true } },
          lines: { include: { item: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.outletStockOrder.findMany({
        where: {
          status: { in: ["REQUESTED", "SENT"] },
          ...(outletId ? { outletId } : {}),
        },
        include: {
          outlet: { select: { name: true } },
          createdBy: { select: { name: true } },
          lines: { include: { item: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.outletStockEvent.findMany({
        where: { ...(outletId ? { outletId } : {}) },
        include: {
          outlet: { select: { name: true } },
          item: { select: { name: true } },
          actor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.inventoryBatch.aggregate({ _sum: { remainingValue: true } }),
    ]);
  const orders = [...openOrders, ...recentOrders].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const activeOutlets = outlets.filter((o) => o.active),
    activeItems = items.filter((i) => i.active),
    stockKey = (outlet: string, item: string, unit: string) => JSON.stringify([outlet, item, unit]),
    stockMap = new Map(balances.map((b) => [stockKey(b.outletId, b.itemId, b.unit), b])),
    warehouse = new Map(
      items.map((i) => [
        i.id,
        i.batches
          .filter((b) => b.baseUnit === i.baseUnit)
          .reduce((s, b) => s + Number(b.remainingQuantity), 0),
      ]),
    );
  const options: OutletStockOptions = {
    outlets: activeOutlets.map((o) => ({ id: o.id, name: o.name })),
    items: activeItems.map((i) => ({
      id: i.id,
      name: i.name,
      kind: i.kind,
      unit: i.baseUnit,
      warehouse: warehouse.get(i.id) || 0,
    })),
    balances: balances.map((b) => ({
      outletId: b.outletId,
      itemId: b.itemId,
      quantity: Number(b.quantity),
      version: b.version,
    })),
  };
  const scoped = activeOutlets.filter((o) => !outletId || o.id === outletId),
    visible = scoped,
    selected = outlets.find((o) => o.id === outletId),
    scopedIds = new Set(scoped.map((o) => o.id)),
    selectedBalances = balances.filter((b) => scopedIds.has(b.outletId)),
    unknownValues = selectedBalances.filter(
      (b) => Number(b.quantity) > 0 && b.value === null,
    ).length,
    knownValue = selectedBalances.reduce((s, b) => s + Number(b.value || 0), 0),
    transitValue = orders
      .filter((o) => o.status === "SENT")
      .flatMap((o) => o.lines)
      .reduce((s, l) => s + Number(l.value || 0), 0),
    warehouseValue = Number(warehouseTotal._sum.remainingValue ?? 0);
  const href = (nextTab = tab, patch: Record<string, string> = {}) =>
    "/control-stok?" + new URLSearchParams({ tab: nextTab, outlet: outletId, ...patch });
  const detailItems = selected
    ? items.filter((i) => i.active || stockMap.has(stockKey(selected.id, i.id, i.baseUnit)))
    : [];
  const inTransit = (outlet: string, item: string, unit: string) =>
    orders
      .filter((o) => o.outletId === outlet && o.status === "SENT")
      .flatMap((o) => o.lines)
      .filter((l) => l.itemId === item && l.unit === unit)
      .reduce((s, l) => s + Number(l.quantity), 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Pantau stok sebelum memproses permintaan crew.</p>
        <div className="flex flex-wrap gap-2">
          <FormDialog title="Catat Permintaan Crew" trigger="+ Permintaan Barang" wide>
            <OutletRequestForm options={options} outletId={selected?.active ? outletId : ""} />
          </FormDialog>
          <FormDialog title="Pencatatan Stok Outlet" trigger="Catat Stok / Pemakaian">
            <OutletPhysicalForm options={options} outletId={selected?.active ? outletId : ""} />
          </FormDialog>
        </div>
      </div>
      <ControlStockTabs tab={tab} outletId={outletId} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="OUTLET DIPANTAU"
          value={selected ? selected.name : String(scoped.length)}
          note={selected ? selected.area.name : "seluruh outlet aktif"}
          icon="building"
        />
        <Metric
          label="MENUNGGU GUDANG"
          value={String(orders.filter((o) => o.status === "REQUESTED").length)}
          note="permintaan belum mengubah stok"
          icon="clock"
        />
        <Metric
          label="DALAM PENGIRIMAN"
          value={String(orders.filter((o) => o.status === "SENT").length)}
          note={rupiah(Math.round(transitValue)) + " · belum diterima outlet"}
          icon="truck"
        />
        <Metric
          label={selected ? "NILAI STOK OUTLET" : "NILAI STOK GUDANG"}
          value={
            selected
              ? !selectedBalances.length
                ? "Belum dicatat"
                : unknownValues > 0 && knownValue === 0
                  ? "Belum dinilai"
                  : rupiah(Math.round(knownValue))
              : rupiah(Math.round(warehouseValue))
          }
          note={
            selected
              ? unknownValues > 0
                ? `${unknownValues} item belum dinilai; nilai belum lengkap`
                : !selectedBalances.length
                  ? "catat stok awal outlet terlebih dahulu"
                  : "nilai perolehan stok tersisa di " + selected.name
              : "stok di gudang, belum termasuk stok outlet"
          }
          icon="wallet"
        />
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Stok tercatat = stok awal + barang diterima − pemakaian − susut. Cocokkan dengan hitung
        fisik. Pemakaian penjualan saat ini dicatat manual; pengurangan otomatis dari POS belum
        terhubung.
      </p>
      {tab === "stock" && (
        <>
          {selected ? (
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div>
                  <h2 className="text-sm font-bold">STOK OUTLET · {selected.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{selected.area.name}</p>
                </div>
                <Link href={href("stock", { outlet: "" })} className="button-primary">
                  ← Kembali ke Daftar Outlet
                </Link>
              </div>
              <div className="overflow-x-auto">
                <SortableTable className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Barang",
                        "Jenis",
                        "Satuan",
                        "Stok Tercatat",
                        "Dalam Pengiriman",
                        "Fisik Terakhir",
                        "Selisih Saat Hitung",
                        "Terakhir Diperiksa",
                        "Status",
                      ].map((label) => (
                        <th key={label} className="whitespace-nowrap p-4">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((i) => {
                      const b = stockMap.get(stockKey(selected.id, i.id, i.baseUnit));
                      return (
                        <tr key={i.id}>
                          <td className="p-4 font-semibold">
                            {i.name}
                            {!i.active && " (nonaktif)"}
                          </td>
                          <td className="p-4 text-xs">{warehouseKindNames[i.kind]}</td>
                          <td className="p-4">{i.baseUnit.toLowerCase()}</td>
                          <td className="p-4">
                            {b ? quantityLabel(Number(b.quantity), b.unit) : "—"}
                          </td>
                          <td className="p-4">
                            {quantityLabel(inTransit(selected.id, i.id, i.baseUnit), i.baseUnit)}
                          </td>
                          <td className="p-4">
                            {b ? quantityLabel(Number(b.lastCountQuantity), b.unit) : "—"}
                          </td>
                          <td className="p-4">
                            {b?.lastCountDifference != null
                              ? quantityLabel(Number(b.lastCountDifference), b.unit)
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap p-4 text-xs">
                            {b ? stamp(b.lastCountAt) : "Belum diperiksa"}
                          </td>
                          <td className="whitespace-nowrap p-4 text-xs">
                            {!b
                              ? "Belum ada stok awal"
                              : Number(b.quantity) === 0
                                ? "Habis"
                                : "Tercatat"}
                          </td>
                        </tr>
                      );
                    })}
                    {!detailItems.length && (
                      <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-400">
                          Belum ada barang yang terdaftar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </SortableTable>
              </div>
            </section>
          ) : (
            <section aria-label="Daftar kartu stok outlet" className="space-y-3">
              <div>
                <h2 className="text-sm font-bold">STOK PER OUTLET</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Klik kartu outlet untuk melihat rincian stoknya.
                </p>
              </div>
              <div className="monitor-grid">
                {visible.map((o) => {
                  const rows = balances.filter((b) => b.outletId === o.id);
                  const recorded = activeItems.filter((i) =>
                    stockMap.has(stockKey(o.id, i.id, i.baseUnit)),
                  ).length;
                  const missing = activeItems.length - recorded;
                  const empty = rows.filter(
                    (b) => Number(b.quantity) === 0 && b.item.active,
                  ).length;
                  const shipments = orders.filter(
                    (order) => order.outletId === o.id && order.status === "SENT",
                  ).length;
                  const last = rows.reduce<Date | null>(
                    (date, b) => (!date || b.lastCountAt > date ? b.lastCountAt : date),
                    null,
                  );
                  const code =
                    o.nameCode?.trim() ||
                    o.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")
                      .toUpperCase();
                  return (
                    <article key={o.id} className="monitor-card h-full" aria-label={o.name}>
                      <Link
                        href={href("stock", { outlet: o.id })}
                        className="monitor-card-open"
                        aria-label={"Lihat stok outlet " + o.name}
                        prefetch={false}
                      />
                      <div className="monitor-card-heading">
                        <span
                          className={`monitor-avatar ${code.length > 4 ? "monitor-avatar-code-long" : ""}`}
                        >
                          {code}
                        </span>
                        <div className="monitor-outlet-name">
                          <h3 className="break-words text-[13px] font-bold leading-snug">
                            {o.name}
                          </h3>
                          <p>{o.area.name}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${recorded === 0 ? "bg-slate-100 text-slate-500" : missing > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {recorded === 0
                            ? "Belum dicatat"
                            : missing > 0
                              ? "Sebagian dicatat"
                              : "Sudah dicatat"}
                        </span>
                      </div>
                      <div className="monitor-turnover">
                        <span>ITEM STOK DICATAT</span>
                        <strong>
                          {recorded}{" "}
                          <span className="text-sm font-normal text-slate-400">
                            / {activeItems.length} item
                          </span>
                        </strong>
                        <p>
                          {recorded === 0
                            ? "Catat stok awal untuk mulai memantau."
                            : "Berdasarkan stok outlet yang tersimpan."}
                        </p>
                      </div>
                      <div className="monitor-payments">
                        <div>
                          <span>Belum dicatat</span>
                          <strong>{missing} item</strong>
                        </div>
                        <div>
                          <span>Item habis</span>
                          <strong>{empty} item</strong>
                        </div>
                        <div>
                          <span>Pengiriman</span>
                          <strong>{shipments}</strong>
                        </div>
                      </div>
                      <div className="monitor-card-meta">
                        <span>
                          <UiIcon name="clock" size={13} />
                          {last ? stamp(last) : "Belum diperiksa"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#dfe8e2] pt-3 text-xs font-semibold text-emerald-700">
                        <span>Lihat Detail Stok</span>
                        <UiIcon name="chevron" size={15} />
                      </div>
                    </article>
                  );
                })}
              </div>
              {!visible.length && (
                <div className="panel p-10 text-center text-sm text-slate-400">
                  Belum ada outlet aktif.
                </div>
              )}
            </section>
          )}
        </>
      )}
      {tab === "requests" && (
        <section className="panel overflow-hidden">
          <h2 className="border-b border-slate-100 p-4 text-sm font-bold">
            PERMINTAAN TERBUKA & 500 RIWAYAT TERBARU
          </h2>
          <div className="overflow-x-auto">
            <SortableTable className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Tanggal / Outlet",
                    "Pemohon / Crew",
                    "Permintaan vs Stok Tersedia",
                    "Status",
                    "Tindakan",
                  ].map((label) => (
                    <th key={label} className="p-4">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="p-4">
                      <p className="font-semibold">{o.outlet.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{stamp(o.createdAt)}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {o.id.slice(-8).toUpperCase()}
                      </p>
                    </td>
                    <td className="p-4">
                      <p>{o.requesterName}</p>
                      <p className="mt-1 text-xs text-slate-400">Dicatat: {o.createdBy.name}</p>
                      <p className="mt-2 max-w-48 whitespace-pre-wrap text-xs">{o.notes}</p>
                    </td>
                    <td className="p-4">
                      <ul className="space-y-3">
                        {o.lines.map((l) => {
                          const b = stockMap.get(stockKey(o.outletId, l.itemId, l.unit));
                          return (
                            <li key={l.id}>
                              <p className="font-semibold">
                                {l.item.name}: {quantityLabel(Number(l.quantity), l.unit)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Outlet sekarang:{" "}
                                {b ? quantityLabel(Number(b.quantity), b.unit) : "belum dicatat"} ·
                                Gudang sekarang:{" "}
                                {quantityLabel(warehouse.get(l.itemId) || 0, l.unit)}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td className="p-4">
                      <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                        {orderStatusNames[o.status] || o.status}
                      </span>
                      {o.sentAt && (
                        <p className="mt-2 text-xs text-slate-500">Dikirim: {stamp(o.sentAt)}</p>
                      )}
                      {o.receivedAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          Diterima: {stamp(o.receivedAt)}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {o.status === "REQUESTED" && (
                          <>
                            <FormDialog title="Konfirmasi Pengiriman Gudang" trigger="Kirim Barang">
                              <OutletOrderAction
                                id={o.id}
                                version={o.version}
                                kind="SEND"
                                label="Kirim dari Gudang"
                              >
                                <p className="text-sm">
                                  Kirim seluruh permintaan ke <strong>{o.outlet.name}</strong>? Stok
                                  gudang berkurang menggunakan batch FIFO. Stok outlet bertambah
                                  setelah penerimaan dikonfirmasi.
                                </p>
                                <ul className="list-disc space-y-1 pl-5 text-sm">
                                  {o.lines.map((l) => (
                                    <li key={l.id}>
                                      {l.item.name}: {quantityLabel(Number(l.quantity), l.unit)}
                                    </li>
                                  ))}
                                </ul>
                              </OutletOrderAction>
                            </FormDialog>
                            <FormDialog title="Batalkan Permintaan" trigger="Batalkan">
                              <OutletOrderAction
                                id={o.id}
                                version={o.version}
                                kind="CANCEL"
                                label="Batalkan Permintaan"
                              >
                                <p className="text-sm">
                                  Batalkan permintaan {o.outlet.name}? Stok tidak berubah.
                                </p>
                              </OutletOrderAction>
                            </FormDialog>
                          </>
                        )}
                        {o.status === "SENT" && (
                          <FormDialog
                            title="Konfirmasi Penerimaan Outlet"
                            trigger="Terima di Outlet"
                          >
                            <OutletOrderAction
                              id={o.id}
                              version={o.version}
                              kind="RECEIVE"
                              label="Konfirmasi Diterima"
                            >
                              <p className="text-sm">
                                Pastikan seluruh barang benar-benar sudah diterima oleh{" "}
                                {o.outlet.name}. Catat stok awal setiap barang sebelum menerima
                                kiriman pertama. Penerimaan menambah stok outlet satu kali.
                              </p>
                              <ul className="list-disc space-y-1 pl-5 text-sm">
                                {o.lines.map((l) => (
                                  <li key={l.id}>
                                    {l.item.name}: {quantityLabel(Number(l.quantity), l.unit)}
                                  </li>
                                ))}
                              </ul>
                            </OutletOrderAction>
                          </FormDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">
                      Belum ada permintaan barang.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableTable>
          </div>
        </section>
      )}
      {tab === "history" && (
        <section className="panel overflow-hidden">
          <h2 className="border-b border-slate-100 p-4 text-sm font-bold">
            RIWAYAT MUTASI OUTLET · 500 TERBARU
          </h2>
          <div className="overflow-x-auto">
            <SortableTable className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Waktu / Petugas",
                    "Outlet / Barang",
                    "Jenis",
                    "Sebelum",
                    "Sesudah",
                    "Catatan",
                  ].map((label) => (
                    <th key={label} className="p-4">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap p-4 text-xs">
                      {stamp(e.createdAt)}
                      <p className="mt-1 text-slate-500">{e.actor.name}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">{e.outlet.name}</p>
                      <p className="mt-1 text-xs">{e.item.name}</p>
                    </td>
                    <td className="p-4 text-xs">{stockEventNames[e.kind] || e.kind}</td>
                    <td className="whitespace-nowrap p-4">
                      {e.quantityBefore == null
                        ? "Belum dicatat"
                        : quantityLabel(Number(e.quantityBefore), e.unit)}
                    </td>
                    <td className="whitespace-nowrap p-4 font-semibold">
                      {quantityLabel(Number(e.quantityAfter), e.unit)}
                    </td>
                    <td className="max-w-64 whitespace-pre-wrap p-4 text-xs">{e.notes}</td>
                  </tr>
                ))}
                {!events.length && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      Belum ada mutasi stok outlet.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableTable>
          </div>
        </section>
      )}
    </div>
  );
}
