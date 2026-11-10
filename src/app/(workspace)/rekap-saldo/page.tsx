import { isCurrentLedgerEntry } from "@/lib/bonus-period";
import { BalanceSummary } from "@/components/balance-summary";
import { settlementLeft } from "@/lib/settlements";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { attendanceSummary } from "@/lib/attendance";
import { operationalCash } from "@/lib/outlet-operations";

export default async function BalanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireAccess("rekap-saldo");
  const { q } = await searchParams;
  const search = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 150) ?? "";
  const db = getPrisma();
  const [employees, ledger, days, paidTotals, operations] = await Promise.all([
    db.employee.findMany({
      where: { active: true },
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
    db.outletOperation.findMany({
      where: {
        cashReceived: { not: null },
        crew: { active: true },
      },
      select: {
        crewId: true,
        totalGross: true,
        qris: true,
        gofood: true,
        grabfood: true,
        shopeefood: true,
        expenseAmount: true,
        cashReceived: true,
        updatedAt: true,
        settlementReviews: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            employeeId: true,
            date: true,
            status: true,
            amount: true,
            sourceVersion: true,
            deductions: { select: { amount: true } },
          },
        },
      },
    }),
  ]);
  const approvedByEmployee = new Map<string, number>();
  const pendingByEmployee = new Map<string, number>();
  for (const operation of operations) {
    const review = operation.settlementReviews[0];
    if (review?.status === "APPROVED") {
      approvedByEmployee.set(
        review.employeeId,
        (approvedByEmployee.get(review.employeeId) ?? 0) + settlementLeft(review),
      );
      continue;
    }
    if (
      operation.cashReceived == null ||
      review?.sourceVersion === operation.updatedAt.toISOString()
    )
      continue;
    const shortage = operationalCash(operation) - operation.cashReceived;
    if (shortage > 0)
      pendingByEmployee.set(
        operation.crewId,
        (pendingByEmployee.get(operation.crewId) ?? 0) + shortage,
      );
  }
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
  const balances = employees.map((employee) => {
    const entries = ledger.filter((entry) => entry.employeeId === employee.id);
    const bonus = entries.filter(isCurrentLedgerEntry).reduce((total, entry) => {
      if (entry.kind === "BONUS_EARNED") return total + entry.amount;
      if (entry.kind === "BONUS_WITHDRAWAL") return total - entry.amount;
      return total;
    }, 0);
    const loan = loans
      .filter((entry) => entry.employeeId === employee.id)
      .reduce((total, entry) => total + entry.left, 0);
    const fine = Math.max(
      0,
      days
        .filter((day) => day.employeeId === employee.id)
        .reduce((total, day) => total + attendanceSummary(day, day.attendance).lateFine, 0) -
        (paidTotals.find((paid) => paid.employeeId === employee.id)?._sum.lateDeduction || 0),
    );
    return {
      id: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      loan,
      bonus,
      fine,
      settlement: approvedByEmployee.get(employee.id) ?? 0,
      settlementPending: pendingByEmployee.get(employee.id) ?? 0,
    };
  });
  return <BalanceSummary key={search} rows={balances} initialSearch={search} />;
}
