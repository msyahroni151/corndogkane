import { attendanceSummary } from "@/lib/attendance";
import { isWarehouse } from "@/lib/schedules";
export type PayrollDay = {
  id: string;
  employeeId: string;
  date: Date;
  role: string;
  status: string;
  shift: string | null;
  outletName: string | null;
  outletDailyRate?: number | null;
  location: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  attendance: {
    status: string;
    checkInMinutes: number | null;
    checkOutMinutes: number | null;
    checkInNextDay: boolean;
    checkOutNextDay: boolean;
  } | null;
};
export type PayLine = {
  date: string;
  outlet: string;
  units: number;
  rate: number;
  base: number;
  backup: number;
  standby: number;
  solo: number;
  fine: number;
  validation: string;
};
export function payrollLines(
  days: PayrollDay[],
  coworkers: PayrollDay[],
  dailyRate: number,
  backupRate: number,
  sales: Record<string, number>,
) {
  return days.map((day): PayLine => {
    const date = day.date.toISOString().slice(0, 10),
      summary = attendanceSummary(day, day.attendance);
    let rate = isWarehouse(day.role) ? 80000 : (day.outletDailyRate ?? dailyRate);
    if (summary.paidUnits && !isWarehouse(day.role)) {
      if (day.outletName?.trim().toUpperCase() === "CIJERAH" && date >= "2026-10-01") {
        if (!Object.hasOwn(sales, date)) throw Error(`Isi omzet CIJERAH tanggal ${date}.`);
        rate = sales[date] >= 800000 ? 100000 : 95000;
      } else if (!rate)
        throw Error(
          "Tarif harian belum tersedia. Atur tarif di Master Outlet sebelum membuat jadwal, atau isi tarif cadangan untuk jadwal lama/office.",
        );
    }
    let solo = 0;
    const a = day.attendance;
    const complete =
      a?.status === "HADIR" &&
      summary.paidUnits === 1 &&
      a.checkOutMinutes !== null &&
      day.endMinutes !== null &&
      a.checkOutMinutes + (a.checkOutNextDay ? 1440 : 0) >=
        day.endMinutes + (day.endMinutes <= (day.startMinutes ?? 0) ? 1440 : 0);
    if (isWarehouse(day.role) && complete && ["S1", "S2"].includes(day.shift || "")) {
      const otherPresent = coworkers.some(
        (other) =>
          other.employeeId !== day.employeeId &&
          other.date.getTime() === day.date.getTime() &&
          isWarehouse(other.role) &&
          (other.location || "GUDANG") === (day.location || "GUDANG") &&
          (other.shift === day.shift || other.shift === "FULL") &&
          attendanceSummary(other, other.attendance).paidUnits > 0,
      );
      if (!otherPresent) solo = 20000;
    }
    return {
      date,
      outlet: day.outletName || day.location || "—",
      units: summary.paidUnits,
      rate,
      base: Math.round(summary.paidUnits * rate),
      backup: day.role === "BACKUP" && summary.paidUnits > 0 ? backupRate : 0,
      standby: day.role === "BACKUP" && day.status === "STANBY" && date >= "2026-10-02" ? 50000 : 0,
      solo,
      fine: summary.lateFine,
      validation: summary.validation,
    };
  });
}
export const payrollStatuses = { DRAFT: "Draft", PAID: "Sudah dibayar", CANCELLED: "Dibatalkan" };
