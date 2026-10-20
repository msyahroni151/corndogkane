"use server";
import { parseBackupSchedule } from "@/lib/backup-schedules";
import type { Prisma } from "@/generated/prisma/client";
import { outletHoursForDate } from "@/lib/outlet-settings";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { employeeGroup, isBackupEmployee, parseCivilDate } from "@/lib/placements";
import { isWarehouse, parseTime, shiftTimes } from "@/lib/schedules";
import type { FormState } from "@/lib/form-state";
import type { WarehouseShift, ScheduleStatus } from "@/generated/prisma/client";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "ScheduleValidation";
  throw e;
}
function failure(e: unknown): FormState {
  return {
    error:
      e instanceof Error && e.name === "ScheduleValidation"
        ? e.message
        : "Jadwal belum tersimpan. Periksa data dan koneksi, lalu coba lagi.",
  };
}
export async function createSchedules(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("jadwal");
  const get = (key: string) => String(form.get(key) || "").trim();
  if (get("scheduleMode") === "backup") return createBackupScheduleRows(form, user.id);
  let start: Date, end: Date, holidays: Date[];
  const requestedStatus = get("status");
  if (!["KERJA", "STANBY"].includes(requestedStatus))
    return { error: "Pilih status Kerja atau Stanby." };
  try {
    start = parseCivilDate(get("startDate"));
    end = parseCivilDate(get("endDate"));
    if (end < start || end.getTime() - start.getTime() > 30 * 86400000)
      throw Error("Periode jadwal maksimal 31 hari dan tanggal selesai tidak boleh sebelum mulai.");
    holidays = form
      .getAll("holiday")
      .map((v) => String(v).trim())
      .filter(Boolean)
      .map((v) => parseCivilDate(v));
    if (holidays.some((d) => d < start || d > end))
      throw Error("Tanggal libur khusus harus berada di dalam periode jaga.");
    if (new Set(holidays.map((d) => d.getTime())).size !== holidays.length)
      throw Error("Tanggal libur khusus tidak boleh berulang.");
  } catch (e) {
    return { error: (e as Error).message };
  }
  try {
    await getPrisma().$transaction(
      async (tx) => {
        const employeeId = get("employeeId");
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employeeId} FOR UPDATE`;
        const employee = await tx.employee.findUnique({ where: { id: employeeId } });
        const group = employee && employeeGroup(employee);
        if (!employee || !group) invalid("Pilih karyawan outlet atau gudang yang aktif.");
        const warehouse = group === "warehouse";
        if (warehouse && requestedStatus === "STANBY")
          invalid("Status Stanby berlaku untuk karyawan outlet. Gudang menggunakan status Kerja.");
        if (
          await tx.payroll.findFirst({
            where: { employeeId, status: "PAID", startDate: { lte: end }, endDate: { gte: start } },
          })
        )
          invalid(
            "Periode ini sudah diarsipkan sebagai payroll dibayar. Jadwal baru tidak dapat ditambahkan.",
          );
        if (await tx.schedule.findFirst({ where: { employeeId, date: { gte: start, lte: end } } }))
          invalid(
            "Sudah ada jadwal pada periode ini. Ubah melalui tombol Edit; data sebelumnya tidak ditimpa.",
          );
        const outletId = get("outletId");
        if (warehouse && outletId) invalid("Jadwal gudang tidak menggunakan outlet.");
        if (!warehouse) await tx.$executeRaw`SELECT id FROM outlets WHERE id=${outletId} FOR SHARE`;
        const outlet = warehouse
          ? null
          : await tx.outlet.findUnique({ where: { id: outletId }, include: { area: true } });
        if (!warehouse && (!outlet?.active || outlet.closed || !outlet.area.active))
          invalid("Pilih outlet aktif dari Master Outlet.");
        if (outlet) await tx.$executeRaw`SELECT id FROM areas WHERE id=${outlet.areaId} FOR SHARE`;
        const location = warehouse ? get("location") || "GUDANG" : null;
        if (location && location.length > 100) invalid("Lokasi gudang maksimal 100 karakter.");
        let warehouseTimes: { startMinutes: number; endMinutes: number } | null = null;
        if (warehouse) {
          try {
            warehouseTimes = shiftTimes(get("shift"));
          } catch (e) {
            invalid((e as Error).message);
          }
        }
        const placements = await tx.placement.findMany({
          where: { employeeId, startDate: { lte: end }, endDate: { gte: start } },
          orderBy: { startDate: "asc" },
        });
        const defaultRole = warehouse
          ? employee.position.toUpperCase().includes("LEADER")
            ? ("LEADER_SHIFT" as const)
            : ("CREW_GUDANG" as const)
          : isBackupEmployee(employee)
            ? ("BACKUP" as const)
            : ("REGULER" as const);
        const dates = [];
        const holidaySet = new Set(holidays.map((d) => d.getTime()));
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          const covering = placements.filter((p) => p.startDate <= d && p.endDate >= d);
          if (covering.length > 1)
            invalid(
              "Ada penempatan bertumpang tindih. Periksa riwayat penempatan karyawan terlebih dahulu.",
            );
          let placement = covering[0];
          if (placement && isWarehouse(placement.role) !== warehouse)
            invalid(
              "Penempatan tersimpan berbeda jenis pekerjaan dengan biodata. Periksa riwayat penempatan terlebih dahulu.",
            );
          if (placement && warehouse && location !== placement.location)
            invalid(
              "Lokasi gudang berbeda dari penempatan periode ini. Gunakan lokasi yang sudah tersimpan.",
            );
          if (!placement) {
            // Fill only uncovered dates. Existing placements and their home areas remain intact.
            const gapEnd = new Date(end);
            const next = placements.find((p) => p.startDate > d);
            if (next) {
              gapEnd.setTime(next.startDate.getTime());
              gapEnd.setUTCDate(gapEnd.getUTCDate() - 1);
            }
            placement = await tx.placement.create({
              data: {
                employeeId,
                employeeName: employee.employeeCode || employee.fullName,
                startDate: new Date(d),
                endDate: gapEnd,
                role: defaultRole,
                areaId: outlet?.areaId ?? null,
                areaName: outlet?.area.name ?? null,
                areaColor: outlet?.area.color ?? null,
                outletId: defaultRole === "REGULER" ? outlet!.id : null,
                outletName: defaultRole === "REGULER" ? outlet!.name : null,
                location,
                createdById: user.id,
              },
            });
            placements.push(placement);
            placements.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
          }
          let off = holidaySet.has(d.getTime());
          let startMinutes: number | null = null,
            endMinutes: number | null = null;
          if (!off && requestedStatus === "KERJA") {
            try {
              const daily = warehouse
                ? { ...warehouseTimes!, closed: false }
                : outletHoursForDate(outlet!.operatingHours, d);
              off = daily.closed;
              if (!off) {
                startMinutes = daily.startMinutes;
                endMinutes = daily.endMinutes;
              }
            } catch (e) {
              invalid((e as Error).message);
            }
          }
          const working = !off && requestedStatus === "KERJA";
          dates.push({
            employeeId,
            placementId: placement.id,
            date: new Date(d),
            employeeName: employee.employeeCode || employee.fullName,
            role: placement.role,
            areaName: placement.areaName,
            areaColor: placement.areaColor,
            location: placement.location,
            outletId: !off ? (outlet?.id ?? null) : null,
            outletName: !off ? (outlet?.name ?? null) : null,
            outletDailyRate: working ? (outlet?.dailyRate ?? null) : null,
            status: off ? ("LIBUR" as const) : (requestedStatus as "KERJA" | "STANBY"),
            shift: warehouse && working ? (get("shift") as WarehouseShift) : null,
            startMinutes,
            endMinutes,
            createdById: user.id,
          });
        }
        await tx.schedule.createMany({ data: dates });
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/jadwal");
  revalidatePath("/absensi");
  revalidatePath("/penempatan");
  revalidatePath("/dashboard");
  return { success: "Jadwal harian berhasil dibuat." };
}
async function createBackupScheduleRows(form: FormData, userId: string): Promise<FormState> {
  const employeeId = String(form.get("employeeId") || "").trim();
  let assignments: ReturnType<typeof parseBackupSchedule>;
  try {
    assignments = parseBackupSchedule(form);
  } catch (e) {
    return { error: (e as Error).message };
  }
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employeeId} FOR UPDATE`;
        const employee = await tx.employee.findUnique({ where: { id: employeeId } });
        if (!employee || employeeGroup(employee) !== "outlet" || !isBackupEmployee(employee))
          invalid(
            "Jadwal per outlet dan tanggal hanya berlaku untuk Crew Backup atau Area Supervisor yang aktif.",
          );
        const dates = assignments.map((row) => row.date),
          first = dates[0],
          last = dates[dates.length - 1];
        const paid = await tx.payroll.findMany({
          where: { employeeId, status: "PAID", startDate: { lte: last }, endDate: { gte: first } },
          select: { startDate: true, endDate: true },
        });
        if (paid.some((p) => dates.some((d) => d >= p.startDate && d <= p.endDate)))
          invalid(
            "Tanggal yang dipilih sudah diarsipkan dalam payroll dibayar. Jadwal baru tidak dapat ditambahkan.",
          );
        if (await tx.schedule.findFirst({ where: { employeeId, date: { in: dates } } }))
          invalid(
            "Sudah ada jadwal pada salah satu tanggal yang dipilih. Ubah melalui tombol Edit; jadwal lama tidak ditimpa.",
          );
        const outletIds = [...new Set(assignments.map((row) => row.outletId))].sort();
        for (const id of outletIds)
          await tx.$executeRaw`SELECT id FROM outlets WHERE id=${id} FOR SHARE`;
        const outlets = await tx.outlet.findMany({
          where: { id: { in: outletIds } },
          include: { area: true },
        });
        if (outlets.length !== outletIds.length || outlets.some((o) => !o.active || o.closed))
          invalid("Pilih outlet aktif dari Master Outlet pada setiap baris.");
        const areaIds = [...new Set(outlets.map((o) => o.areaId))].sort();
        for (const id of areaIds)
          await tx.$executeRaw`SELECT id FROM areas WHERE id=${id} FOR SHARE`;
        const activeAreas = await tx.area.count({ where: { id: { in: areaIds }, active: true } });
        if (activeAreas !== areaIds.length) invalid("Area outlet yang dipilih tidak aktif.");
        const placements = await tx.placement.findMany({
          where: { employeeId, startDate: { lte: last }, endDate: { gte: first } },
          orderBy: { startDate: "asc" },
        });
        const schedules: Prisma.ScheduleCreateManyInput[] = [];
        for (const assignment of assignments) {
          const status = assignment.status;
          const outlet = outlets.find((o) => o.id === assignment.outletId)!;
          const covering = placements.filter(
            (p) => p.startDate <= assignment.date && p.endDate >= assignment.date,
          );
          if (covering.length > 1)
            invalid(
              "Ada penempatan bertumpang tindih pada tanggal jaga. Periksa riwayat penempatan terlebih dahulu.",
            );
          let placement = covering[0];
          if (placement && placement.role !== "BACKUP")
            invalid(
              "Penempatan pada tanggal jaga belum berstatus Crew Backup. Periksa riwayat penempatan karyawan terlebih dahulu.",
            );
          if (!placement) {
            placement = await tx.placement.create({
              data: {
                employeeId,
                employeeName: employee.employeeCode || employee.fullName,
                role: "BACKUP",
                startDate: assignment.date,
                endDate: assignment.date,
                areaId: outlet.areaId,
                areaName: outlet.area.name,
                areaColor: outlet.area.color,
                createdById: userId,
              },
            });
            placements.push(placement);
          }
          let off = assignment.holiday,
            startMinutes: number | null = null,
            endMinutes: number | null = null;
          if (!off && status === "KERJA") {
            try {
              const daily = outletHoursForDate(outlet.operatingHours, assignment.date);
              off = daily.closed;
              if (!off) {
                startMinutes = daily.startMinutes;
                endMinutes = daily.endMinutes;
              }
            } catch (e) {
              invalid((e as Error).message);
            }
          }
          const working = !off && status === "KERJA";
          schedules.push({
            employeeId,
            employeeName: employee.employeeCode || employee.fullName,
            placementId: placement.id,
            date: assignment.date,
            role: "BACKUP",
            areaName: placement.areaName,
            areaColor: placement.areaColor,
            location: placement.location,
            outletId: off ? null : outlet.id,
            outletName: off ? null : outlet.name,
            outletDailyRate: working ? outlet.dailyRate : null,
            status: off ? "LIBUR" : (status as "KERJA" | "STANBY"),
            shift: null,
            startMinutes,
            endMinutes,
            createdById: userId,
          });
        }
        await tx.schedule.createMany({ data: schedules });
      },
      { timeout: 20000 },
    );
  } catch (e) {
    return failure(e);
  }
  for (const path of ["/jadwal", "/absensi", "/penempatan", "/dashboard"]) revalidatePath(path);
  return { success: "Jadwal crew backup berhasil dibuat sesuai outlet dan tanggal jaga." };
}
export async function updateSchedule(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("jadwal");
  const get = (key: string) => String(form.get(key) || "").trim();
  try {
    await getPrisma().$transaction(
      async (tx) => {
        const initial = await tx.schedule.findUnique({ where: { id: get("id") } });
        if (!initial) invalid("Jadwal tidak ditemukan.");
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${initial.employeeId} FOR UPDATE`;
        await tx.$executeRaw`SELECT id FROM schedules WHERE id=${get("id")} FOR UPDATE`;
        const record = await tx.schedule.findUnique({
          where: { id: get("id") },
          include: { attendance: true },
        });
        if (!record) invalid("Jadwal tidak ditemukan.");
        if (
          await tx.payroll.findFirst({
            where: {
              employeeId: record.employeeId,
              status: "PAID",
              startDate: { lte: record.date },
              endDate: { gte: record.date },
            },
          })
        )
          invalid("Jadwal periode ini sudah menjadi arsip payroll dibayar.");
        if (record.attendance)
          invalid(
            "Jadwal sudah memiliki absensi. Perubahan jadwal ditahan agar rekapan kehadiran tetap konsisten.",
          );
        const status = get("status");
        if (!["KERJA", "LIBUR", "STANBY"].includes(status)) invalid("Status jadwal tidak valid.");
        if (status === "STANBY" && isWarehouse(record.role))
          invalid("Status Stanby berlaku untuk karyawan outlet.");
        if (get("notes").length > 2000) invalid("Catatan maksimal 2000 karakter.");
        const working = status === "KERJA",
          warehouse = isWarehouse(record.role);
        let startMinutes: number | null = null,
          endMinutes: number | null = null,
          outletId: string | null = null,
          outletName: string | null = null,
          outletDailyRate: number | null = null;
        if (working) {
          try {
            if (warehouse) {
              const times = shiftTimes(get("shift"));
              startMinutes = times.startMinutes;
              endMinutes = times.endMinutes;
            } else {
              const outlet = await tx.outlet.findUnique({
                where: { id: get("outletId") },
                include: { area: true },
              });
              if (!outlet?.active || !outlet.area.active) invalid("Pilih outlet kerja yang aktif.");
              outletId = outlet.id;
              outletName = outlet.name;
              outletDailyRate =
                record.outletId === outlet.id
                  ? (record.outletDailyRate ?? outlet.dailyRate)
                  : outlet.dailyRate;
              if (get("timeMode") === "outlet") {
                const hours = outletHoursForDate(outlet.operatingHours, record.date);
                if (hours.closed)
                  invalid(
                    "Outlet tutup pada hari ini. Pilih LIBUR atau gunakan jam manual untuk jadwal khusus.",
                  );
                startMinutes = hours.startMinutes;
                endMinutes = hours.endMinutes;
              } else {
                startMinutes = parseTime(get("startTime"));
                endMinutes = parseTime(get("endTime"));
              }
            }
            if (startMinutes === endMinutes) invalid("Jam masuk dan pulang tidak boleh sama.");
          } catch (e) {
            invalid((e as Error).message);
          }
        }
        if (status === "STANBY") {
          const outlet = await tx.outlet.findUnique({
            where: { id: get("outletId") },
            include: { area: true },
          });
          if (!outlet?.active || outlet.closed || !outlet.area.active)
            invalid("Pilih outlet aktif untuk lokasi Stanby.");
          outletId = outlet.id;
          outletName = outlet.name;
        }
        await tx.schedule.update({
          where: { id: record.id },
          data: {
            status: status as ScheduleStatus,
            outletId,
            outletName,
            outletDailyRate,
            startMinutes,
            endMinutes,
            shift: warehouse && working ? (get("shift") as WarehouseShift) : null,
            notes: get("notes") || null,
          },
        });
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/jadwal");
  revalidatePath("/absensi");
  return { success: "Jadwal diperbarui." };
}
