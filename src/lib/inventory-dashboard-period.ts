import { displayDate, parseCivilDate } from "@/lib/placements";

const dayMs = 86_400_000;
export const inventoryDashboardMaxDays = 366;

export function inventoryDashboardRange(
  query: { from?: string; to?: string; period?: string },
  today: string,
) {
  const defaultEnd = parseCivilDate(today);
  const presetDays = query.period === "7" ? 7 : 30;
  const defaultStart = new Date(defaultEnd.getTime() - (presetDays - 1) * dayMs);
  if (query.from === undefined && query.to === undefined)
    return { start: defaultStart, end: defaultEnd, days: presetDays, error: "" };

  let error: string;
  try {
    const start = parseCivilDate(query.from ?? "");
    const end = parseCivilDate(query.to ?? "");
    const days = (end.getTime() - start.getTime()) / dayMs + 1;
    if (days < 1) error = "Tanggal akhir harus sama dengan atau setelah tanggal awal.";
    else if (end > defaultEnd) error = "Tanggal akhir tidak boleh melewati hari ini.";
    else if (days > inventoryDashboardMaxDays)
      error = `Rentang maksimal ${inventoryDashboardMaxDays} hari.`;
    else return { start, end, days, error: "" };
  } catch {
    error = "Isi tanggal awal dan akhir yang valid.";
  }
  return { start: defaultStart, end: defaultEnd, days: presetDays, error };
}

export function inventoryTrend(start: Date, days: number, totals: ReadonlyMap<number, number>) {
  const span = days > 31 ? 7 : 1;
  return Array.from({ length: Math.ceil(days / span) }, (_, index) => {
    const first = start.getTime() + index * span * dayMs;
    const length = Math.min(span, days - index * span);
    let total = 0;
    for (let day = 0; day < length; day++) total += totals.get(first + day * dayMs) ?? 0;
    const label = displayDate(new Date(first));
    const last = displayDate(new Date(first + (length - 1) * dayMs));
    return { key: first, label: label === last ? label : `${label} – ${last}`, total };
  });
}
