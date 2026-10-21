import { parseCivilDate, todayWib } from "@/lib/placements";
export const portalTabs = [
  { key: "", label: "Beranda", icon: "dashboard" },
  { key: "gaji", label: "Gaji Saya", icon: "coins" },
  { key: "kasbon", label: "Kasbon Saya", icon: "wallet" },
  { key: "jadwal", label: "Jadwal Saya", icon: "calendar" },
  { key: "absensi", label: "Absensi Saya", icon: "check" },
  { key: "cuti", label: "Cuti & Izin", icon: "calendar" },
] as const;
export const portalStatuses: Record<string, string> = {
  PENDING: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};
export const leaveKinds: Record<string, string> = {
  CUTI: "Cuti",
  IZIN: "Izin",
  LIBUR: "Permintaan libur",
  SAKIT: "Sakit",
};
export function descriptorOf(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== 128 ||
    value.some((n) => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 10)
  )
    throw Error("Data wajah tidak valid. Ulangi pemindaian.");
  const norm = Math.sqrt(value.reduce((sum, n) => sum + n * n, 0));
  if (norm < 0.1 || norm > 5) throw Error("Data wajah tidak valid.");
  return value;
}
export function faceDistance(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((sum, n, i) => sum + (n - b[i]) ** 2, 0));
}
export function portalLeaveDates(start: string, end: string, now = todayWib()) {
  const from = parseCivilDate(start),
    to = parseCivilDate(end);
  if (start < now || end < start || (to.getTime() - from.getTime()) / 86400000 > 30)
    throw Error("Pilih tanggal mulai hari ini atau mendatang, maksimal 31 hari per pengajuan.");
  return { from, to };
}
export function clock(minutes: number | null | undefined, next = false) {
  return minutes == null
    ? "-"
    : String(Math.floor(minutes / 60)).padStart(2, "0") +
        ":" +
        String(minutes % 60).padStart(2, "0") +
        (next ? " (+1 hari)" : "");
}
export function portalWindow(
  s: { date: Date; startMinutes: number | null; endMinutes: number | null; status: string },
  kind: string,
  now = new Date(),
) {
  if (s.status !== "KERJA" || s.startMinutes === null || s.endMinutes === null)
    throw Error("Absensi memerlukan jadwal kerja dengan jam masuk dan pulang yang lengkap.");
  const midnight = s.date.getTime() - 7 * 3600000,
    start = midnight + s.startMinutes * 60000,
    end = midnight + (s.endMinutes + (s.endMinutes <= s.startMinutes ? 1440 : 0)) * 60000;
  if (
    now.getTime() < start - 2 * 3600000 ||
    now.getTime() > end + (kind === "OUT" ? 4 : 0) * 3600000
  )
    throw Error("Absensi berada di luar waktu shift. Hubungi admin untuk koreksi.");
}
export function portalMinutes(date: Date, scheduleDate: Date) {
  const wib = new Date(date.getTime() + 7 * 3600000);
  return {
    minutes: wib.getUTCHours() * 60 + wib.getUTCMinutes(),
    next: wib.toISOString().slice(0, 10) > scheduleDate.toISOString().slice(0, 10),
  };
}
