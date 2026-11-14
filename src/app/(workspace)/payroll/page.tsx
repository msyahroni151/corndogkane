import Link from "next/link";
import { PayrollHistory } from "@/components/payroll-history";
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
  const [employees, rows] = await Promise.all([
    db.employee.findMany({
      where: { active: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, employeeCode: true },
    }),
    db.payroll.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
      include: { employee: { select: { fullName: true } } },
    }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <div className="space-y-6">
      <PayrollHistory
        createAction={
          <FormDialog title="Hitung payroll" trigger="+ Buat Payroll" wide>
            <PayrollForm
              employees={employees.map((e) => ({ id: e.id, name: e.employeeCode || e.fullName }))}
              today={today}
            />
          </FormDialog>
        }
        header={
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
        }
        records={rows.map((p) => ({
          id: p.id,
          name: p.employeeName,
          fullName: p.employee.fullName,
          status: p.status,
          row: (
            <tr key={p.id} className="border-t border-slate-100 align-top">
              <td className="p-4" data-sort-value={p.employeeName}>
                <p className="font-semibold">{p.employeeName}</p>
                <p className="mt-1 text-xs text-slate-500">{p.id}</p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-emerald-700">Rincian hitungan</summary>
                  <div className="mt-3 space-y-2 text-xs">
                    {(p.details as unknown as PayLine[]).map((l) => (
                      <p key={l.date}>
                        {dateToDisplay(l.date)} · {l.outlet} · {l.validation}
                        <br />
                        {l.units} × {rupiah(l.rate)} = {rupiah(l.base)}; backup {rupiah(l.backup)};
                        standby {rupiah(l.standby)}; sendiri {rupiah(l.solo)}; denda{" "}
                        {rupiah(l.fine)}
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
                <div className="flex flex-wrap gap-2">
                  {p.status === "DRAFT" && (
                    <FormDialog title="Keputusan payroll" trigger="Proses draft">
                      <PayrollForm id={p.id} today={today} />
                    </FormDialog>
                  )}
                  {p.status === "CANCELLED" ? (
                    "—"
                  ) : (
                    <Link
                      href={`/payroll/slip/${encodeURIComponent(p.id)}`}
                      prefetch={false}
                      className="button-secondary whitespace-nowrap"
                    >
                      Lihat Slip Gaji
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ),
        }))}
      />
    </div>
  );
}
