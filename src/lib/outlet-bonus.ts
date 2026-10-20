/** Sales bonus is calculated per outlet/day, before any period aggregation. */
export function outletBonus(gross: number, dailyRate: number | null) {
  if (gross >= 2000000) return dailyRate == null ? null : Math.max(0, 200000 - dailyRate);
  return gross < 600000 ? 0 : (Math.floor((gross - 600000) / 100000) + 1) * 5000;
}
export function outletBonusRate(name: string, date: string, rate: number | null, gross: number) {
  // Keep the existing CIJERAH payroll rate exception consistent with the inclusive 200k rule.
  return name.trim().toUpperCase() === "CIJERAH" && date >= "2026-10-01"
    ? gross >= 800000
      ? 100000
      : 95000
    : rate;
}
