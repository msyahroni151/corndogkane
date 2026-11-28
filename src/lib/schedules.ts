export const shiftLabels = {
  S1: "Shift 1 · 08:00–17:00",
  S2: "Shift 2 · 15:00–23:59",
  FULL: "Full shift · 08:00–23:59",
};
export function isWarehouse(role: string) {
  return role === "LEADER_SHIFT" || role === "CREW_GUDANG";
}
/** Keep each warehouse day's shift groups together, with leave at the bottom. */
export function compareWarehouseSchedules(
  a: { status: string; shift: string | null; name: string },
  b: { status: string; shift: string | null; name: string },
) {
  const rank = (row: typeof a) => row.status === "LIBUR" ? 3 : row.shift === "S1" ? 0 : row.shift === "S2" ? 1 : 2;
  return rank(a) - rank(b) || a.name.localeCompare(b.name, "id-ID", { numeric: true });
}
export function parseTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Isi jam masuk dan pulang yang valid.");
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
export function timeLabel(value: number | null) {
  return value === null
    ? ""
    : `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function shiftTimes(shift: string) {
  if (shift === "S1") return { startMinutes: 480, endMinutes: 1020 };
  if (shift === "S2") return { startMinutes: 900, endMinutes: 1439 };
  if (shift === "FULL") return { startMinutes: 480, endMinutes: 1439 };
  throw new Error("Pilih shift gudang yang valid.");
}

/** Outlet opening shifts use the same attendance and pay rules as work shifts. */
export function isWorkingSchedule(status: string) {
  return status === "KERJA" || status === "OPENINGAN";
}

export function canEditScheduleFromAttendance(status: string) {
  return isWorkingSchedule(status) || status === "LIBUR" || status === "STANBY";
}
