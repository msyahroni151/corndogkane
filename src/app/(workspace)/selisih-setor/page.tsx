import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate, displayDate } from "@/lib/placements";
import { operationalCash } from "@/lib/outlet-operations";
import { settlementLeft } from "@/lib/settlements";
import { rupiah } from "@/lib/money";
import { LocalInput } from "@/components/local-input";
import { SortableTable } from "@/components/sortable-table";
import { FormDialog } from "@/components/form-dialog";
import { SettlementDecisionForm } from "@/components/settlement-decision-form";
type Query = { from?: string; to?: string; employee?: string; status?: string };
export default async function SettlementDifferencePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  await requireAccess("selisih-setor");
  const query = await searchParams,
    db = getPrisma(),
    today = todayWib();
  const from = query.from || today.slice(0, 8) + "01",
    to = query.to || today;
  let start = parseCivilDate(today),
    end = start,
    error = "";
  try {
    start = parseCivilDate(from);
    end = parseCivilDate(to);
    if (end < start || end.getTime() - start.getTime() > 365 * 86400000) throw Error();
  } catch {
    error = "Pilih rentang tanggal yang valid, maksimal 366 hari.";
  }
  const [employees, records] = await Promise.all([
    db.employee.findMany({
      select: { id: true, fullName: true, employeeCode: true },
      orderBy: { fullName: "asc" },
    }),
    error
      ? Promise.resolve([])
      : db.outletOperation.findMany({
          where: {
            date: { gte: start, lte: end },
            ...(query.employee ? { crewId: query.employee } : {}),
          },
          orderBy: [{ date: "desc" }, { outletName: "asc" }],
          take: 10001,
          include: {
            crew: { select: { employeeCode: true } },
            settlementReviews: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              include: {
                createdBy: { select: { name: true } },
                deductions: {
                  include: { payroll: { select: { id: true, endDate: true, status: true } } },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        }),
  ]);
  if (records.length > 10000) error = "Rekap melebihi 10.000 baris. Pilih periode lebih pendek.";
  const rows = (error ? [] : records)
    .map((row) => {
      const cash = operationalCash(row),
        difference = row.cashReceived == null ? null : row.cashReceived - cash,
        review = row.settlementReviews[0];
      const status =
        difference == null
          ? "UNKNOWN"
          : difference === 0
            ? "MATCH"
            : review?.status === "APPROVED"
              ? "APPROVED"
              : review?.sourceVersion === row.updatedAt.toISOString()
                ? "REJECTED"
                : "PENDING";
      const approved = status === "APPROVED" ? review.amount : 0,
        paid = status === "APPROVED" ? review.deductions.reduce((s, p) => s + p.amount, 0) : 0;
      return {
        row,
        cash,
        difference,
        status,
        approved,
        paid,
        left: status === "APPROVED" ? settlementLeft(review) : 0,
      };
    })
    .filter((r) => !query.status || r.status === query.status);
  const statuses = {
    UNKNOWN: "REAL belum diisi",
    PENDING: "Perlu diproses",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
    MATCH: "Sesuai",
  };
  const cards = [
    {
      label: "Kekurangan setoran",
      value: rows.reduce((s, r) => s + Math.max(0, -(r.difference ?? 0)), 0),
    },
    {
      label: "Kelebihan setoran",
      value: rows.reduce((s, r) => s + Math.max(0, r.difference ?? 0), 0),
    },
    { label: "Sudah dipotong", value: rows.reduce((s, r) => s + r.paid, 0) },
    { label: "Sisa potongan disetujui", value: rows.reduce((s, r) => s + r.left, 0) },
  ];
  return (
    <div className="space-y-6">
      <form className="panel flex flex-wrap items-end gap-4 p-5">
        <label className="field">
          Tanggal mulai
          <LocalInput type="date" name="from" defaultValue={from} required />
        </label>
        <label className="field">
          Tanggal selesai
          <LocalInput type="date" name="to" defaultValue={to} required />
        </label>
        <label className="field">
          Karyawan
          <select name="employee" defaultValue={query.employee || ""}>
            <option value="">Semua karyawan</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode || e.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Status
          <select name="status" defaultValue={query.status || ""}>
            <option value="">Semua status</option>
            {Object.entries(statuses).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button-secondary">Terapkan</button>
      </form>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <section className="panel p-5" key={c.label}>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-3 text-xl font-bold">{rupiah(c.value)}</p>
            <p className="mt-2 text-[10px] text-slate-400">Sesuai filter yang dipilih</p>
          </section>
        ))}
      </div>
      <section className="panel overflow-hidden">
        <h2 className="border-b border-slate-100 p-5 text-sm font-bold">
          Rekap Selisih Setoran · {rows.length} rekap
        </h2>
        <p className="p-5 text-xs leading-6 text-slate-500">
          Sumber: rekap operasional outlet. SELISIH = REAL − CASH. REAL kosong belum dihitung
          sebagai kekurangan. Hanya kekurangan yang disetujui dapat dipilih untuk dipotong melalui
          payroll; draft belum mengurangi saldo. Kelebihan setoran bersifat informasi.
        </p>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[1350px] text-left text-sm">
            <thead>
              <tr>
                {[
                  "Tanggal",
                  "Cabang",
                  "Crew",
                  "CASH",
                  "REAL",
                  "Selisih",
                  "Status",
                  "Disetujui dipotong",
                  "Sudah dipotong",
                  "Sisa potongan",
                  "Aksi",
                ].map((t) => (
                  <th className="p-4" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, cash, difference, status, approved, paid, left }) => (
                <tr key={row.id}>
                  <td className="p-4 whitespace-nowrap" data-sort-value={row.date.getTime()}>
                    {displayDate(row.date)}
                  </td>
                  <td className="p-4">{row.outletName}</td>
                  <td className="p-4">
                    {row.crewName}
                    {row.crew.employeeCode ? ` - ${row.crew.employeeCode}` : ""}
                  </td>
                  <td className="p-4 whitespace-nowrap">{rupiah(cash)}</td>
                  <td className="p-4 whitespace-nowrap">
                    {row.cashReceived == null ? "—" : rupiah(row.cashReceived)}
                  </td>
                  <td
                    className={`p-4 whitespace-nowrap font-semibold ${difference != null && difference < 0 ? "text-red-700" : difference ? "text-emerald-700" : ""}`}
                    data-sort-value={difference}
                  >
                    {difference == null
                      ? "—"
                      : `${difference > 0 ? "+ " : ""}${rupiah(difference)}`}
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${status === "PENDING" ? "bg-amber-50 text-amber-700" : status === "REJECTED" ? "bg-red-50 text-red-700" : status === "APPROVED" || status === "MATCH" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {statuses[status as keyof typeof statuses]}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">{rupiah(approved)}</td>
                  <td className="p-4 whitespace-nowrap">{rupiah(paid)}</td>
                  <td className="p-4 whitespace-nowrap font-semibold">{rupiah(left)}</td>
                  <td className="p-4">
                    {status === "PENDING" && row.cashReceived != null && (
                      <FormDialog title="Persetujuan Selisih Setoran" trigger="Proses">
                        <SettlementDecisionForm
                          operationId={row.id}
                          version={row.updatedAt.toISOString()}
                          crew={row.crewName}
                          outlet={row.outletName}
                          cash={cash}
                          real={row.cashReceived}
                        />
                      </FormDialog>
                    )}
                    {!!row.settlementReviews.length && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-emerald-700">Riwayat</summary>
                        <div className="mt-3 min-w-60 space-y-4">
                          {row.settlementReviews.map((review) => (
                            <div key={review.id}>
                              <p className="font-semibold">
                                {review.status === "APPROVED" ? "Disetujui" : "Ditolak"} ·{" "}
                                {review.createdBy.name}
                              </p>
                              <p>{review.notes || "Tanpa catatan"}</p>
                              <p>
                                CASH {rupiah(review.expectedCash)} · REAL{" "}
                                {rupiah(review.receivedCash)}
                              </p>
                              {review.deductions.map((p) => (
                                <p key={p.id}>
                                  {p.payroll.id} · {displayDate(p.payroll.endDate)} · dipotong{" "}
                                  {rupiah(p.amount)}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {status !== "PENDING" && !row.settlementReviews.length && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
          {!rows.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              Belum ada rekap operasional untuk filter ini.
            </p>
          )}
        </div>
      </section>
      <p className="text-xs leading-6 text-slate-500">
        Sisa potongan mengikuti seluruh pembayaran payroll atas rekap yang ditampilkan, termasuk
        pembayaran pada periode berikutnya. Persetujuan dan pembayaran tetap tersimpan sebagai
        riwayat.
      </p>
    </div>
  );
}
