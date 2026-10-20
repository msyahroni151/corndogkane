"use server";
import { attendanceDateError } from "@/lib/attendance-date";
import { todayWib } from "@/lib/placements";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isWarehouse, parseTime } from "@/lib/schedules";
import { attendanceLabels } from "@/lib/attendance";
import type { FormState } from "@/lib/form-state";
import type { AttendanceStatus } from "@/generated/prisma/client";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "AttendanceValidation";
  throw e;
}
export async function saveAttendance(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("absensi");
  const get = (key: string) => String(form.get(key) || "").trim();
  const status = get("status");
  if (!Object.hasOwn(attendanceLabels, status)) return { error: "Status kehadiran tidak valid." };
  let checkInMinutes: number | null, checkOutMinutes: number | null;
  try {
    checkInMinutes = get("checkIn") ? parseTime(get("checkIn")) : null;
    checkOutMinutes = get("checkOut") ? parseTime(get("checkOut")) : null;
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (status === "HADIR" && checkInMinutes === null)
    return { error: "Isi check-in untuk status Hadir, atau pilih status ketidakhadiran." };
  const checkInNextDay = form.get("checkInNextDay") === "on",
    checkOutNextDay = form.get("checkOutNextDay") === "on";
  if (checkOutMinutes !== null && checkInMinutes === null)
    return { error: "Isi check-in terlebih dahulu. Check-out boleh menyusul." };
  if (
    checkOutMinutes !== null &&
    checkInMinutes !== null &&
    checkOutMinutes + (checkOutNextDay ? 1440 : 0) <= checkInMinutes + (checkInNextDay ? 1440 : 0)
  )
    return {
      error:
        "Check-out harus setelah check-in. Centang Hari berikutnya bila pulang lewat tengah malam.",
    };
  if (
    ["IZIN", "SAKIT", "ALPA"].includes(status) &&
    (checkInMinutes !== null || checkOutMinutes !== null)
  )
    return {
      error:
        "Status tidak hadir harus tanpa check-in dan check-out. Periksa kembali jam yang sudah dicatat.",
    };
  if (get("notes").length > 2000) return { error: "Catatan maksimal 2000 karakter." };
  try {
    await getPrisma().$transaction(
      async (tx) => {
        const initial = await tx.schedule.findUnique({ where: { id: get("scheduleId") } });
        if (!initial) invalid("Jadwal tidak ditemukan.");
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${initial.employeeId} FOR UPDATE`;
        await tx.$executeRaw`SELECT id FROM schedules WHERE id=${get("scheduleId")} FOR UPDATE`;
        const schedule = await tx.schedule.findUnique({
          where: { id: get("scheduleId") },
          include: { attendance: true },
        });
        if (!schedule) invalid("Jadwal tidak ditemukan.");
        const dateError = attendanceDateError(
          schedule.date,
          todayWib(),
          checkInMinutes !== null && checkInNextDay,
        );
        if (dateError) invalid(dateError);
        if (
          await tx.payroll.findFirst({
            where: {
              employeeId: schedule.employeeId,
              status: "PAID",
              startDate: { lte: schedule.date },
              endDate: { gte: schedule.date },
            },
          })
        )
          invalid(
            "Absensi periode ini sudah menjadi arsip payroll dibayar dan tidak dapat diubah.",
          );
        if (schedule.status !== "KERJA")
          invalid("Absensi jam hanya untuk jadwal KERJA. Libur/standby mengikuti jadwal.");
        if (schedule.role === "BACKUP" && status === "HADIR" && !schedule.outletId)
          invalid("Atur outlet backup di Jadwal harian sebelum mencatat kehadiran.");
        if (status === "SETENGAH_HARI" && !isWarehouse(schedule.role))
          invalid("Setengah hari hanya untuk karyawan gudang.");
        if (status === "SETENGAH_HARI" && checkInMinutes === null)
          invalid("Setengah hari harus memiliki check-in.");
        if ((schedule.attendance?.updatedAt.toISOString() || "") !== get("version"))
          invalid(
            "Absensi sudah diperbarui dari halaman lain. Tutup popup dan muat ulang untuk melihat data terbaru.",
          );
        const data = {
          status: status as AttendanceStatus,
          checkInMinutes,
          checkOutMinutes,
          checkInNextDay: checkInMinutes !== null && checkInNextDay,
          checkOutNextDay: checkOutMinutes !== null && checkOutNextDay,
          notes: get("notes") || null,
          updatedById: user.id,
        };
        await tx.attendance.upsert({
          where: { scheduleId: schedule.id },
          create: { ...data, scheduleId: schedule.id },
          update: data,
        });
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return {
      error:
        e instanceof Error && e.name === "AttendanceValidation"
          ? e.message
          : "Absensi belum tersimpan. Periksa koneksi database lalu coba lagi.",
    };
  }
  revalidatePath("/absensi");
  revalidatePath("/jadwal");
  return { success: "Absensi tersimpan." };
}
