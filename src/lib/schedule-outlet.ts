import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { isWarehouse, isWorkingSchedule } from "@/lib/schedules";
export class ScheduleOutletError extends Error {}
export type LockedSchedule = Prisma.ScheduleGetPayload<{ include: { attendance: true } }>;
export async function lockSchedule(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<LockedSchedule> {
  const first = await tx.schedule.findUnique({ where: { id }, select: { employeeId: true } });
  if (!first) throw new ScheduleOutletError("Jadwal tidak ditemukan.");
  await tx.$executeRaw`SELECT id FROM employees WHERE id=${first.employeeId} FOR UPDATE`;
  await tx.$executeRaw`SELECT id FROM schedules WHERE id=${id} FOR UPDATE`;
  const record = await tx.schedule.findUnique({ where: { id }, include: { attendance: true } });
  if (!record) throw new ScheduleOutletError("Jadwal tidak ditemukan.");
  return record;
}
/** Daily assignment correction. Actual punches, planned hours and placement history stay intact. */
export async function changeLockedScheduleOutlet(
  tx: Prisma.TransactionClient,
  record: LockedSchedule,
  outletId: string,
  version: string,
) {
  if (record.updatedAt.toISOString() !== version)
    throw new ScheduleOutletError(
      "Jadwal sudah berubah. Tutup popup dan muat ulang sebelum menyimpan.",
    );
  if (isWarehouse(record.role) || !isWorkingSchedule(record.status))
    throw new ScheduleOutletError(
      "Ubah outlet bertugas hanya untuk jadwal Kerja atau Openingan crew outlet.",
    );
  if (!outletId || outletId.length > 200)
    throw new ScheduleOutletError("Pilih outlet bertugas yang aktif.");
  if (
    await tx.payroll.findFirst({
      where: {
        employeeId: record.employeeId,
        status: "PAID",
        startDate: { lte: record.date },
        endDate: { gte: record.date },
      },
      select: { id: true },
    })
  )
    throw new ScheduleOutletError(
      "Periode ini sudah menjadi arsip payroll dibayar. Outlet tidak dapat diubah.",
    );
  if (record.outletId === outletId) return record;
  if (
    await tx.portalCapture.findFirst({
      where: { scheduleId: record.id, status: "PENDING" },
      select: { id: true },
    })
  )
    throw new ScheduleOutletError(
      "Masih ada bukti absensi portal menunggu persetujuan. Selesaikan pemeriksaannya sebelum mengubah outlet.",
    );
  await tx.$executeRaw`SELECT id FROM outlets WHERE id=${outletId} FOR SHARE`;
  const outlet = await tx.outlet.findUnique({
    where: { id: outletId },
  });
  if (!outlet?.active || outlet.closed)
    throw new ScheduleOutletError("Pilih outlet bertugas yang aktif dan belum ditutup.");
  await tx.$executeRaw`SELECT id FROM areas WHERE id=${outlet.areaId} FOR SHARE`;
  const area = await tx.area.findUnique({ where: { id: outlet.areaId }, select: { active: true } });
  if (!area?.active) throw new ScheduleOutletError("Area outlet yang dipilih tidak aktif.");
  return tx.schedule.update({
    where: { id: record.id },
    data: { outletId: outlet.id, outletName: outlet.name, outletDailyRate: outlet.dailyRate },
    include: { attendance: true },
  });
}
export async function saveScheduleOutlet(db: PrismaClient, form: FormData) {
  const id = String(form.get("scheduleId") || "").trim(),
    outletId = String(form.get("outletId") || "").trim(),
    version = String(form.get("scheduleVersion") || "");
  return db.$transaction(
    async (tx) => changeLockedScheduleOutlet(tx, await lockSchedule(tx, id), outletId, version),
    { timeout: 10000 },
  );
}
