"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { portalMinutes } from "@/lib/employee-portal";
import type { FormState } from "@/lib/form-state";
export async function reviewPortalRequest(_: FormState, f: FormData): Promise<FormState> {
  const user = await requireAccess("portal-review"),
    id = String(f.get("id") || ""),
    type = String(f.get("type") || ""),
    decision = String(f.get("decision") || ""),
    notes = String(f.get("notes") || "").trim();
  if (
    !["APPROVED", "REJECTED"].includes(decision) ||
    notes.length > 1000 ||
    (decision === "REJECTED" && !notes)
  )
    return { error: "Pilih keputusan dan isi alasan bila ditolak (maksimal 1000 karakter)." };
  try {
    await getPrisma().$transaction(
      async (tx) => {
        const target =
          type === "FACE"
            ? await tx.portalFace.findUnique({ where: { employeeId: id } })
            : type === "LEAVE"
              ? await tx.portalLeave.findUnique({ where: { id } })
              : type === "ATTENDANCE"
                ? await tx.portalCapture.findUnique({ where: { id } })
                : null;
        if (!target) throw Error("Pengajuan tidak tersedia.");
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${target.employeeId} FOR UPDATE`;
        const employee = await tx.employee.findUnique({ where: { id: target.employeeId } });
        if (!employee?.active && decision === "APPROVED") throw Error("Karyawan tidak aktif.");
        const data = {
          status: decision,
          reviewedById: user.id,
          reviewedAt: new Date(),
          decisionNotes: notes || null,
        };
        if (type === "FACE") {
          const changed = await tx.portalFace.updateMany({
            where: {
              employeeId: id,
              status: "PENDING",
              updatedAt: new Date(String(f.get("version"))),
            },
            data,
          });
          if (!changed.count)
            throw Error("Pendaftaran wajah sudah berubah atau diproses. Muat ulang.");
        } else if (type === "LEAVE") {
          const leave = await tx.portalLeave.findUniqueOrThrow({ where: { id } });
          if (leave.status !== "PENDING") throw Error("Pengajuan sudah diproses.");
          if (decision === "APPROVED") {
            const working = await tx.schedule.findMany({
              where: {
                employeeId: leave.employeeId,
                date: { gte: leave.startDate, lte: leave.endDate },
              },
            });
            if (
              await tx.payroll.findFirst({
                where: {
                  employeeId: leave.employeeId,
                  status: "PAID",
                  startDate: { lte: leave.endDate },
                  endDate: { gte: leave.startDate },
                },
              })
            )
              throw Error("Tanggal sudah termasuk payroll dibayar.");
            for (const s of working) {
              await tx.$executeRaw`SELECT id FROM schedules WHERE id=${s.id} FOR UPDATE`;
              if (
                (await tx.attendance.findUnique({ where: { scheduleId: s.id } })) ||
                (await tx.portalCapture.findFirst({
                  where: { scheduleId: s.id, status: { in: ["PENDING", "APPROVED"] } },
                }))
              )
                throw Error(
                  "Sudah ada absensi pada tanggal pengajuan. Periksa dan selesaikan catatan tersebut terlebih dahulu.",
                );
            }
            if (leave.kind === "CUTI" || leave.kind === "LIBUR")
              await tx.schedule.updateMany({
                where: { id: { in: working.map((s) => s.id) } },
                data: {
                  status: "LIBUR",
                  notes: "Pengajuan " + leave.kind + " disetujui: " + leave.reason,
                },
              });
            else
              for (const s of working.filter((s) => s.status === "KERJA"))
                await tx.attendance.create({
                  data: {
                    scheduleId: s.id,
                    status: leave.kind === "SAKIT" ? "SAKIT" : "IZIN",
                    notes: leave.reason,
                    updatedById: user.id,
                  },
                });
          }
          await tx.portalLeave.update({ where: { id }, data });
        } else {
          const capture = await tx.portalCapture.findUniqueOrThrow({ where: { id } });
          if (capture.status !== "PENDING") throw Error("Absensi sudah diproses.");
          if (decision === "APPROVED") {
            await tx.$executeRaw`SELECT id FROM schedules WHERE id=${capture.scheduleId} FOR UPDATE`;
            const s = await tx.schedule.findUniqueOrThrow({
              where: { id: capture.scheduleId },
              include: { attendance: true },
            });
            if (
              s.employeeId !== capture.employeeId ||
              s.status !== "KERJA" ||
              s.updatedAt.toISOString() !== capture.scheduleVersion ||
              (s.attendance?.updatedAt.toISOString() || "") !== capture.attendanceVersion
            )
              throw Error(
                "Jadwal atau absensi sudah berubah. Tolak bukti ini dan lakukan koreksi melalui Absensi admin.",
              );
            if (
              await tx.payroll.findFirst({
                where: {
                  employeeId: s.employeeId,
                  status: "PAID",
                  startDate: { lte: s.date },
                  endDate: { gte: s.date },
                },
              })
            )
              throw Error("Periode sudah termasuk payroll dibayar.");
            const time = portalMinutes(capture.capturedAt, s.date);
            if (capture.kind === "IN") {
              if (s.attendance) throw Error("Absensi masuk sudah tercatat.");
              await tx.attendance.create({
                data: {
                  scheduleId: s.id,
                  status: "HADIR",
                  checkInMinutes: time.minutes,
                  checkInNextDay: time.next,
                  updatedById: user.id,
                  notes: "Portal karyawan: bukti wajah dan lokasi kerja diperiksa admin.",
                },
              });
            } else {
              if (
                !s.attendance ||
                s.attendance.checkInMinutes === null ||
                s.attendance.checkOutMinutes !== null
              )
                throw Error("Absensi masuk belum disetujui atau sudah pulang.");
              if (
                time.minutes + (time.next ? 1440 : 0) <=
                s.attendance.checkInMinutes + (s.attendance.checkInNextDay ? 1440 : 0)
              )
                throw Error("Jam pulang harus setelah jam masuk.");
              await tx.attendance.update({
                where: { scheduleId: s.id },
                data: {
                  checkOutMinutes: time.minutes,
                  checkOutNextDay: time.next,
                  updatedById: user.id,
                },
              });
            }
          }
          await tx.portalCapture.update({ where: { id }, data });
        }
      },
      { timeout: 15000 },
    );
    revalidatePath("/portal-karyawan", "layout");
    revalidatePath("/absensi");
    revalidatePath("/jadwal");
    return { success: "Keputusan tersimpan." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Keputusan belum tersimpan." };
  }
}
