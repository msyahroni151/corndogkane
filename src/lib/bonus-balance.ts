export type BonusBalanceEntry = {
  employeeId: string;
  employeeName: string;
  kind: string;
  status: string;
  amount: number;
  date: Date;
};
export function bonusBalances(
  employees: { id: string; fullName: string; employeeCode: string | null; active: boolean }[],
  entries: BonusBalanceEntry[],
  today: string,
) {
  const end = new Date(today + "T00:00:00.000Z");
  const involved = new Set(entries.map((e) => e.employeeId));
  return employees
    .filter((e) => involved.has(e.id))
    .map((employee) => {
      const approved = entries.filter(
        (e) => e.employeeId === employee.id && e.status === "APPROVED" && e.date <= end,
      );
      const earned = approved
        .filter((e) => e.kind === "BONUS_EARNED")
        .reduce((n, e) => n + e.amount, 0);
      const taken = approved
        .filter((e) => e.kind === "BONUS_WITHDRAWAL")
        .reduce((n, e) => n + e.amount, 0);
      return { ...employee, earned, taken, left: earned - taken };
    });
}
