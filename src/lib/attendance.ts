import { isWarehouse } from "@/lib/schedules";
export const attendanceLabels = {
  HADIR: "Hadir",
  SETENGAH_HARI: "Setengah hari (gudang)",
  IZIN: "Izin",
  SAKIT: "Sakit",
  ALPA: "Alpa",
};
type AttendanceLike = {
  status: string;
  checkInMinutes: number | null;
  checkOutMinutes: number | null;
  checkInNextDay: boolean;
};
export function attendanceSummary(
  schedule: { status: string; role: string; shift: string | null; startMinutes: number | null },
  attendance: AttendanceLike | null,
) {
  if (schedule.status !== "KERJA")
    return { validation: schedule.status, paidUnits: 0, lateMinutes: 0, lateFine: 0 };
  if (!attendance) return { validation: "BELUM DIISI", paidUnits: 0, lateMinutes: 0, lateFine: 0 };
  if (["IZIN", "SAKIT", "ALPA"].includes(attendance.status))
    return { validation: "TIDAK HADIR", paidUnits: 0, lateMinutes: 0, lateFine: 0 };
  if (attendance.checkInMinutes === null)
    return { validation: "CHECK-IN BELUM DIISI", paidUnits: 0, lateMinutes: 0, lateFine: 0 };
  const paidUnits =
    attendance.status === "SETENGAH_HARI"
      ? 0.5
      : isWarehouse(schedule.role) && schedule.shift === "FULL"
        ? 2
        : 1;
  const actual = attendance.checkInMinutes + (attendance.checkInNextDay ? 1440 : 0);
  const lateMinutes =
    schedule.startMinutes === null ? 0 : Math.max(0, actual - schedule.startMinutes);
  return {
    validation: attendance.checkOutMinutes === null ? "CHECK-OUT BELUM DIISI" : "LENGKAP",
    paidUnits,
    lateMinutes,
    lateFine: Math.min(lateMinutes * 1000, 30000),
  };
}
