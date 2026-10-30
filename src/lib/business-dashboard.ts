import { parseCivilDate } from "@/lib/placements";
export type BusinessEntry = {
  outletId: string;
  date: string;
  totalGross: number;
  expenseAmount: number | null;
  bonusAmount: number | null;
};
const DAY = 86400000;
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function shiftDays(key: string, days: number) {
  return dateKey(new Date(parseCivilDate(key).getTime() + days * DAY));
}
function shiftMonth(key: string, months: number) {
  const d = parseCivilDate(key),
    last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0));
  return dateKey(
    new Date(
      Date.UTC(
        last.getUTCFullYear(),
        last.getUTCMonth(),
        Math.min(d.getUTCDate(), last.getUTCDate()),
      ),
    ),
  );
}
export function dashboardPresets(today: string) {
  const d = parseCivilDate(today);
  return [
    { key: "today", label: "Hari Ini", from: today, to: today },
    {
      key: "week",
      label: "Minggu Ini",
      from: shiftDays(today, -((d.getUTCDay() + 6) % 7)),
      to: today,
    },
    { key: "month", label: "Bulan Ini", from: today.slice(0, 8) + "01", to: today },
    { key: "year", label: "Tahun Ini", from: today.slice(0, 4) + "-01-01", to: today },
  ];
}
export function previousDashboardPeriod(from: string, to: string, mode = "previous", period = "") {
  if (mode === "year") return { from: shiftMonth(from, -12), to: shiftMonth(to, -12) };
  if (from === to && (!period || period === "today"))
    return { from: shiftDays(from, -1), to: shiftDays(to, -1) };
  const presets = dashboardPresets(to),
    match =
      presets.find((p) => p.key === period && p.from === from) ||
      presets.find((p) => p.key === "month" && p.from === from) ||
      presets.find((p) => p.from === from && p.key !== "today");
  if (match?.key === "today") return { from: shiftDays(from, -1), to: shiftDays(to, -1) };
  if (match?.key === "month") return { from: shiftMonth(from, -1), to: shiftMonth(to, -1) };
  if (match?.key === "year") return { from: shiftMonth(from, -12), to: shiftMonth(to, -12) };
  if (match?.key === "week") return { from: shiftDays(from, -7), to: shiftDays(to, -7) };
  if (from.endsWith("-01") && from.slice(0, 7) === to.slice(0, 7))
    return { from: shiftMonth(from, -1), to: shiftMonth(to, -1) };
  const length = (parseCivilDate(to).getTime() - parseCivilDate(from).getTime()) / DAY + 1;
  return { from: shiftDays(from, -length), to: shiftDays(from, -1) };
}
export function growth(current: number | null, previous: number | null) {
  return current === null || previous === null || previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}
export type TrendPoint = {
  key: string;
  gross: number | null;
  expense: number | null;
  records: number;
  expenseRecords: number;
};
export function dashboardTrend(
  entries: BusinessEntry[],
  from: string,
  to: string,
  grain: "day" | "week" | "month",
): TrendPoint[] {
  const key = (d: string) =>
    grain === "month"
      ? d.slice(0, 7)
      : grain === "week"
        ? shiftDays(d, -((parseCivilDate(d).getUTCDay() + 6) % 7))
        : d;
  const groups = new Map<string, TrendPoint>();
  for (let d = from; d <= to; d = shiftDays(d, 1)) {
    const k = key(d);
    if (!groups.has(k))
      groups.set(k, { key: k, gross: null, expense: null, records: 0, expenseRecords: 0 });
  }
  for (const row of entries) {
    if (row.date < from || row.date > to) continue;
    const point = groups.get(key(row.date));
    if (point) {
      point.gross = (point.gross ?? 0) + row.totalGross;
      point.expense = (point.expense ?? 0) + (row.expenseAmount ?? 0);
      point.records++;
      if (row.expenseAmount !== null) point.expenseRecords++;
    }
  }
  return [...groups.values()].map((point) => ({
    ...point,
    expense: point.expenseRecords === point.records ? point.expense : null,
  }));
}
export function monthlyHistory(entries: BusinessEntry[], to: string) {
  const start = shiftMonth(to.slice(0, 8) + "01", -11);
  return { from: start, to, points: dashboardTrend(entries, start, to, "month") };
}
export function summarizeBusiness(entries: BusinessEntry[]) {
  return {
    gross: entries.length ? entries.reduce((n, e) => n + e.totalGross, 0) : null,
    expense:
      entries.length && entries.every((e) => e.expenseAmount !== null)
        ? entries.reduce((n, e) => n + (e.expenseAmount ?? 0), 0)
        : null,
    records: entries.length,
  };
}
