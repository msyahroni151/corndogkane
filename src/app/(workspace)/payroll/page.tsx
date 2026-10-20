import { settlementLeft } from "@/lib/settlements";
import { SortableTable } from "@/components/sortable-table";
import { APP_TIME_ZONE, dateToDisplay } from "@/lib/local-date";
import { displayDate } from "@/lib/placements";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { payrollStatuses, type PayLine } from "@/lib/payroll";
import { rupiah } from "@/lib/money";
import { FormDialog } from "@/components/form-dialog";
import { PayrollForm } from "@/components/payroll-form";
export default async function PayrollPage() {
  await requireAccess("payroll");
  const db = getPrisma();
  const [employees, rows, ledger, settlementRows] = await Promise.all([
    db.employee.findMany({ orderBy: { fullName: "asc" } }),
    db.payroll.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    db.moneyEntry.findMany({ where: { status: "APPROVED" } }),
    db.settlementReview.findMany({
      where: { status: "APPROVED", amount: { gt: 0 } },
      include: { deductions: true },
      orderBy: { date: "asc" },
    }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const loans = ledger
    .filter((e) => e.kind === "LOAN")
    .map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      left:
        e.amount -
        ledger
          .filter((p) => p.kind === "REPAYMENT" && p.sourceId === e.id)
          .reduce((s, p) => s + p.amount, 0),
    }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <FormDialog title="Hitung payroll" trigger="+ Buat payroll" wide>
          <PayrollForm
            employees={employees.map((e) => ({ id: e.id, name: e.employeeCode || e.fullName }))}
            loans={loans}
            settlements={settlementRows.map((s) => ({
              id: s.id,
              employeeId: s.employeeId,
              left: settlementLeft(s),
              label: `${displayDate(s.date)} · ${s.outletName}`,
            }))}
            today={today}
          />
        </FormDialog>
      </div>
      <div className="panel p-5 text-sm leading-6 text-slate-600">
        Absensi dengan check-in sudah dihitung untuk upah. Draft belum mengurangi saldo. Setelah
        dicatat dibayar, potongan kasbon dan pengambilan bonus masuk ke riwayat masing-masing.
        Periode karyawan yang sama tidak boleh bertumpang tindih. Bonus penjualan berasal dari rekap
        operasional yang sudah disetujui; omzet CIJERAH mengikuti isian payroll. Potongan selisih
        setoran disetujui dapat dipilih dan dicicil saat membuat draft.
      </div>
      <section className="panel overflow-hidden">
        <h2 className="border-b border-slate-100 p-5 font-semibold">
          Riwayat payroll · {rows.length} terbaru
        </h2>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "ID / Karyawan",
                  "Periode",
                  "Unit dibayar / standby",
                  "Upah dasar",
                  "Tambahan / bonus",
                  "Potongan",
                  "Gaji bersih",
                  "Status",
                  "Aksi",
                ].map((h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 align-top">
                  <td className="p-4" data-sort-value={p.employeeName}>
                    <p className="font-semibold">{p.employeeName}</p>
                    <p className="mt-1 text-xs text-slate-500">{p.id}</p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-emerald-700">
                        Rincian hitungan
                      </summary>
                      <div className="mt-3 space-y-2 text-xs">
                        {(p.details as unknown as PayLine[]).map((l) => (
                          <p key={l.date}>
                            {dateToDisplay(l.date)} · {l.outlet} · {l.validation}
                            <br />
                            {l.units} × {rupiah(l.rate)} = {rupiah(l.base)}; backup{" "}
                            {rupiah(l.backup)}; standby {rupiah(l.standby)}; sendiri{" "}
                            {rupiah(l.solo)}; denda {rupiah(l.fine)}
                          </p>
                        ))}
                        <p>
                          Bonus ledger: {rupiah(p.bonusPaid)}
                          <br />
                          Kasbon: {rupiah(p.loanDeduction)}
                          <br />
                          Selisih setoran: {rupiah(p.settlementDeduction)}
                          <br />
                          Telat: {rupiah(p.lateDeduction)}
                          <br />
                          Lain: {rupiah(p.otherDeduction)}
                        </p>
                        <p>{p.notes || "Tanpa catatan"}</p>
                      </div>
                    </details>
                  </td>
                  <td className="p-4 whitespace-nowrap" data-sort-value={p.startDate.getTime()}>
                    {displayDate(p.startDate)}
                    <br />
                    {displayDate(p.endDate)}
                  </td>
                  <td className="p-4" data-sort-value={p.paidUnits}>
                    {p.paidUnits} / {p.standbyDays}
                  </td>
                  <td className="p-4 whitespace-nowrap">{rupiah(p.basePay)}</td>
                  <td className="p-4 whitespace-nowrap">
                    {rupiah(p.backupPay + p.standbyPay + p.warehouseBonus + p.bonusPaid)}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {rupiah(
                      p.loanDeduction + p.lateDeduction + p.otherDeduction + p.settlementDeduction,
                    )}
                  </td>
                  <td className="p-4 font-bold whitespace-nowrap">{rupiah(p.netPay)}</td>
                  <td className="p-4" data-sort-value={payrollStatuses[p.status]}>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs ${p.status === "PAID" ? "bg-emerald-50 text-emerald-700" : p.status === "CANCELLED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {payrollStatuses[p.status]}
                    </span>
                    {p.paidAt && (
                      <p className="mt-2 text-xs text-slate-500">
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeZone: APP_TIME_ZONE,
                        }).format(p.paidAt)}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    {p.status === "DRAFT" ? (
                      <FormDialog title="Keputusan payroll" trigger="Proses draft">
                        <PayrollForm id={p.id} today={today} />
                      </FormDialog>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
          {!rows.length && (
            <p className="p-6 text-sm text-slate-500">
              Belum ada payroll. Klik Buat payroll untuk menghitung periode.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
