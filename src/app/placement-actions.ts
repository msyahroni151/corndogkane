"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  employeeGroup,
  operationalRoles,
  parseCivilDate,
  type OperationalRole,
} from "@/lib/placements";
import type { FormState } from "@/lib/form-state";
function reject(message: string): never {
  const error = new Error(message);
  error.name = "ValidationError";
  throw error;
}
export async function savePlacement(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("jadwal");
  const get = (key: string) => String(form.get(key) || "").trim();
  let startDate: Date, endDate: Date;
  const role = get("role");
  if (!operationalRoles.includes(role as OperationalRole))
    return { error: "Role operasional tidak valid." };
  try {
    startDate = parseCivilDate(get("startDate"));
    endDate = parseCivilDate(get("endDate"));
    if (endDate < startDate) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    if (endDate.getTime() - startDate.getTime() > 365 * 86400_000)
      throw new Error("Periode maksimal satu tahun. Periksa kembali tanggalnya.");
  } catch (error) {
    return { error: (error as Error).message };
  }
  const employeeId = get("employeeId"),
    areaId = get("areaId"),
    outletId = get("outletId"),
    location = get("location"),
    notes = get("notes");
  if (!employeeId || notes.length > 2000 || location.length > 100)
    return { error: "Pilih karyawan dan isi keterangan/lokasi sesuai batas panjang." };
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employeeId} FOR UPDATE`;
        const employee = await tx.employee.findUnique({ where: { id: employeeId } });
        if (!employee) reject("Karyawan tidak ditemukan.");
        const group = employeeGroup(employee);
        if (!group)
          reject("Hanya crew outlet/backup dan leader/crew gudang yang aktif dapat ditempatkan.");
        const warehouse = role === "LEADER_SHIFT" || role === "CREW_GUDANG";
        if ((group === "warehouse") !== warehouse)
          reject("Role penempatan tidak sesuai departemen dan jabatan karyawan.");
        if (
          warehouse &&
          employee.position.toUpperCase().includes("LEADER") !== (role === "LEADER_SHIFT")
        )
          reject("Jabatan gudang harus sesuai biodata karyawan.");
        if (
          await tx.placement.findFirst({
            where: { employeeId, startDate: { lte: endDate }, endDate: { gte: startDate } },
          })
        )
          reject("Periode bertumpang tindih dengan penempatan karyawan yang sudah tersimpan.");
        let areaName: string | null = null,
          outletName: string | null = null,
          areaColor: string | null = null;
        if (warehouse) {
          if (!location) reject("Isi lokasi kerja gudang.");
          if (areaId || outletId) reject("Penempatan gudang tidak menggunakan area atau outlet.");
        } else {
          if (!areaId) reject("Pilih area asal karyawan.");
          await tx.$executeRaw`SELECT id FROM areas WHERE id=${areaId} FOR SHARE`;
          const area = await tx.area.findUnique({ where: { id: areaId } });
          if (!area?.active) reject("Area asal tidak aktif atau tidak ditemukan.");
          areaName = area.name;
          areaColor = area.color;
          if (role === "BACKUP") {
            if (outletId)
              reject(
                "Crew backup tidak memakai outlet default. Outlet harian ditentukan pada jadwal.",
              );
          } else {
            if (!outletId) reject("Pilih outlet default untuk crew reguler.");
            await tx.$executeRaw`SELECT id FROM outlets WHERE id=${outletId} FOR SHARE`;
            const outlet = await tx.outlet.findUnique({
              where: { id: outletId },
              include: { area: true },
            });
            if (!outlet?.active || !outlet.area.active)
              reject("Outlet default atau area outlet tidak aktif.");
            outletName = outlet.name;
          }
        }
        await tx.placement.create({
          data: {
            employeeId,
            role: role as OperationalRole,
            startDate,
            endDate,
            employeeName: employee.employeeCode || employee.fullName,
            areaId: warehouse ? null : areaId,
            areaName,
            areaColor,
            outletId: role === "REGULER" ? outletId : null,
            outletName,
            location: warehouse ? location : null,
            notes: notes || null,
            createdById: user.id,
          },
        });
      },
      { timeout: 10_000 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") return { error: error.message };
    return { error: "Penempatan belum tersimpan. Periksa koneksi database lalu coba lagi." };
  }
  revalidatePath("/penempatan");
  revalidatePath("/dashboard");
  return { success: "Penempatan periode berhasil disimpan. Riwayat sebelumnya tetap." };
}
