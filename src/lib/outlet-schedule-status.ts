export type OutletSchedulePeriod = {
  openDays: number;
  totalDays: number;
  workDates: string[];
  crewNames: string[];
};
export type OutletWorkSchedule = {
  outletId: string | null;
  date: string;
  status: string;
  role: string;
  crewName: string;
};
export function outletSchedulePeriods(
  ids: string[],
  from: string,
  to: string,
  rows: OutletWorkSchedule[],
) {
  const start = Date.parse(from + "T00:00:00Z"),
    end = Date.parse(to + "T00:00:00Z");
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    new Date(start).toISOString().slice(0, 10) !== from ||
    new Date(end).toISOString().slice(0, 10) !== to ||
    end < start ||
    end - start > 365 * 86400000
  )
    throw Error("Rentang jadwal tidak valid.");
  const result: Record<string, OutletSchedulePeriod> = Object.fromEntries(
    ids.map((id) => [
      id,
      { openDays: 0, totalDays: (end - start) / 86400000 + 1, workDates: [], crewNames: [] },
    ]),
  );
  for (const row of rows) {
    if (
      !row.outletId ||
      !result[row.outletId] ||
      row.status !== "KERJA" ||
      row.role === "CREW_GUDANG" ||
      row.date < from ||
      row.date > to
    )
      continue;
    const value = result[row.outletId];
    if (!value.workDates.includes(row.date)) value.workDates.push(row.date);
    if (row.crewName.trim() && !value.crewNames.includes(row.crewName.trim()))
      value.crewNames.push(row.crewName.trim());
  }
  for (const value of Object.values(result)) {
    value.workDates.sort();
    value.openDays = value.workDates.length;
  }
  return result;
}
export function outletScheduleLabel(value: OutletSchedulePeriod | undefined) {
  if (!value) return "Memuat jadwal…";
  if (!value.openDays) return "Tutup";
  return value.openDays === value.totalDays
    ? "Buka"
    : "Buka " + value.openDays + "/" + value.totalDays + " hari";
}
