import { isCurrentLedgerEntry } from "@/lib/bonus-period";
import SearchForm from "next/form";
import { settlementLeft } from "@/lib/settlements";
import { SortableTable } from "@/components/sortable-table";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { attendanceSummary } from "@/lib/attendance";
import { rupiah } from "@/lib/money";

export default async function BalanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireAccess("rekap-saldo");
  const { q } = await searchParams;
  const search = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 150) ?? "";
  const term = search.replace(/[\\%_]/g, "\\$&");
  const db = getPrisma();
  const [employees, ledger, days, paidTotals, settlementRows] = await Promise.all([
    db.employee.findMany({
      ...(term
        ? {
            where: {
              OR: [
                { fullName: { contains: term, mode: "insensitive" as const } },
                { employeeCode: { contains: term, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, employeeCode: true },
    }),
    db.moneyEntry.findMany({ where: { status: "APPROVED" } }),
    db.schedule.findMany({ include: { attendance: true } }),
    db.payroll.groupBy({
      by: ["employeeId"],
      where: { status: "PAID" },
      _sum: { lateDeduction: true },
    }),
    db.settlementReview.findMany({ where: { status: "APPROVED" }, include: { deductions: true } }),
  ]);
  const loans = ledger
    .filter((entry) => entry.kind === "LOAN")
    .map((entry) => ({
      id: entry.id,
      employeeId: entry.employeeId,
      left:
        entry.amount -
        ledger
          .filter((payment) => payment.kind === "REPAYMENT" && payment.sourceId === entry.id)
          .reduce((sum, payment) => sum + payment.amount, 0),
    }));
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
        <h2 className="font-semibold">Saldo untuk periode berikutnya</h2>
        <SearchForm
          action=""
          prefetch={false}
          scroll={false}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="field">
            <input
              name="q"
              type="search"
              defaultValue={search}
              maxLength={150}
              aria-label="Cari nama atau kode karyawan"
              placeholder="Cari nama atau kode..."
            />
          </div>
          <button className="button-secondary">Cari</button>
        </SearchForm>
      </div>
      <div className="overflow-x-auto">
        <SortableTable className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Karyawan",
                "Sisa kasbon",
                "Sisa bonus disetujui",
                "Denda belum dipotong",
                "Sisa selisih setoran",
              ].map((h) => (
                <th className="p-4" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const entries = ledger.filter((l) => l.employeeId === e.id),
                bonus = entries
                  .filter(isCurrentLedgerEntry)
                  .reduce(
                    (s, l) =>
                      s +
                      (l.kind === "BONUS_EARNED"
                        ? l.amount
                        : l.kind === "BONUS_WITHDRAWAL"
                          ? -l.amount
                          : 0),
                    0,
                  ),
                loan = loans.filter((l) => l.employeeId === e.id).reduce((s, l) => s + l.left, 0),
                fine = Math.max(
                  0,
                  days
                    .filter((d) => d.employeeId === e.id)
                    .reduce((s, d) => s + attendanceSummary(d, d.attendance).lateFine, 0) -
                    (paidTotals.find((p) => p.employeeId === e.id)?._sum.lateDeduction || 0),
                );
              return (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="p-4 font-medium">{e.employeeCode || e.fullName}</td>
                  <td className="p-4">{rupiah(loan)}</td>
                  <td className="p-4">{rupiah(bonus)}</td>
                  <td className="p-4">{rupiah(fine)}</td>
                  <td className="p-4">
                    {rupiah(
                      settlementRows
                        .filter((s) => s.employeeId === e.id)
                        .reduce((sum, s) => sum + settlementLeft(s), 0),
                    )}
                  </td>
                </tr>
              );
            })}
            {!employees.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  {search
                    ? "Tidak ada karyawan yang cocok dengan pencarian."
                    : "Belum ada data karyawan untuk rekap saldo."}
                </td>
              </tr>
            )}
          </tbody>
        </SortableTable>
      </div>
    </section>
  );
}
