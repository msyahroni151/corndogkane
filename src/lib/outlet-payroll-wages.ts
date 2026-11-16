type PaidPayroll = { details: unknown; lateDeduction: number };
type Outlet = { id: string; name: string };
type Shift = {
  date: string;
  outlet: string;
  outletId?: string | null;
  units: number;
  base: number;
  backup: number;
  standby: number;
  fine: number;
};

function isShift(value: unknown): value is Shift {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<Shift>;
  return (
    typeof line.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(line.date) &&
    typeof line.outlet === "string" &&
    (line.outletId == null || typeof line.outletId === "string") &&
    [line.units, line.base, line.backup, line.standby, line.fine].every(
      (amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0,
    )
  );
}

const outletNameKey = (name: string) => name.trim().toLocaleUpperCase("id-ID");

export function outletPayrollWages(
  payrolls: PaidPayroll[],
  outlet: Outlet,
  from: string,
  to: string,
): number | null {
  const targetName = outletNameKey(outlet.name);
  let total = 0;
  let matched = false;

  for (const { details, lateDeduction } of payrolls) {
    if (!Array.isArray(details)) continue;
    const shifts = details.filter(isShift);
    const selected = shifts.filter((line) =>
      line.units > 0 &&
      line.date >= from &&
      line.date <= to &&
      (line.outletId ? line.outletId === outlet.id : outletNameKey(line.outlet) === targetName),
    );
    if (!selected.length) continue;

    // The payroll deduction can include earlier shifts or differ from the attendance estimate.
    // Apply only deductions that can be reconciled to the individual saved shifts.
    const assessed = shifts.reduce((amount, line) => amount + line.fine, 0);
    if (lateDeduction > 0 && (shifts.length !== details.length || assessed !== lateDeduction))
      return null;

    matched = true;
    total += selected.reduce(
      (amount, line) =>
        amount + line.base + line.backup + line.standby - (lateDeduction > 0 ? line.fine : 0),
      0,
    );
  }

  return matched ? total : null;
}
