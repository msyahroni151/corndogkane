export const shiftLabels = {
  S1: "Shift 1 · 08:00–17:00",
  S2: "Shift 2 · 15:00–00:00",
  FULL: "Full shift · 08:00–00:00",
};
export function isWarehouse(role: string) {
  return role === "LEADER_SHIFT" || role === "CREW_GUDANG";
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
  if (shift === "S2") return { startMinutes: 900, endMinutes: 0 };
  if (shift === "FULL") return { startMinutes: 480, endMinutes: 0 };
  throw new Error("Pilih shift gudang yang valid.");
}
