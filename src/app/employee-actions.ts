"use server";
import { allocateBusinessId } from "@/lib/business-id";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { departments, usesOutletDailyRate, outletPositions } from "@/lib/employee-fields";
import type { FormState } from "@/lib/form-state";
function read(form: FormData) {
  const get = (key: string) => String(form.get(key) || "").trim();
  const optional = (key: string) => get(key) || null;
  const date = (key: string) => {
    const raw = get(key);
    if (!raw) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Tanggal tidak valid.");
    const value = new Date(raw + "T00:00:00.000Z");
    if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== raw)
      throw new Error("Tanggal tidak valid.");
    return value;
  };
  const fullName = get("fullName"),
    department = get("department"),
    position = get("position");
  if (!fullName || !department || !position)
    throw new Error("Nama lengkap, departemen, dan jabatan wajib diisi.");
  if (department === "OPERASIONAL OUTLET" && !outletPositions.includes(position as never))
    throw new Error("Jabatan Operasional Outlet hanya Crew Outlet, Crew Backup, atau SPV.");
  for (const [key, value] of form.entries())
    if (typeof value === "string" && value.length > (key === "notes" ? 2000 : 254))
      throw new Error("Isian terlalu panjang.");
  const activityStatus = get("activityStatus");
  if (!["AKTIF", "RESIGN"].includes(activityStatus)) throw new Error("Status aktif tidak valid.");
  const outletDailyRate = usesOutletDailyRate({
    position,
  });
  const salaryBasis =
      outletDailyRate || get("employeeType") === "HARIAN"
        ? "HARIAN"
        : get("employeeType") === "TETAP"
          ? "BULANAN"
          : optional("salaryBasis"),
    employmentStatus = optional("employmentStatus");
  if (salaryBasis && !["HARIAN", "BULANAN"].includes(salaryBasis))
    throw new Error("Basis gaji tidak valid.");
  if (employmentStatus && !["KONTRAK", "PEGAWAI TETAP"].includes(employmentStatus))
    throw new Error("Status kerja tidak valid.");
  const employeeType = optional("employeeType");
  if (employeeType && !["HARIAN", "TETAP"].includes(employeeType))
    throw new Error("Tipe karyawan tidak valid.");
  const salary = get("baseSalary");
  const baseSalary = outletDailyRate || salary === "" ? null : Number(salary);
  if (
    baseSalary !== null &&
    (!/^\d+$/.test(salary) ||
      !Number.isSafeInteger(baseSalary) ||
      baseSalary < 0 ||
      baseSalary > 1000000000)
  )
    throw new Error("Gaji pokok harus berupa nominal rupiah yang valid.");
  const joinedAt = date("joinedAt"),
    leftAt = date("leftAt");
  if (joinedAt && leftAt && leftAt < joinedAt)
    throw new Error("Tanggal keluar tidak boleh sebelum tanggal masuk.");
  return {
    fullName,
    ...(form.has("employeeType") ? { employeeType } : {}),
    ...(!outletDailyRate && form.has("baseSalary") ? { baseSalary } : {}),
    department,
    position,
    activityStatus,
    active: activityStatus === "AKTIF",
    salaryBasis,
    employmentStatus,
    joinedAt,
    leftAt,
    nik: optional("nik"),
    employeeCode: optional("employeeCode"),
    ...(form.has("workPattern") ? { workPattern: optional("workPattern") } : {}),
    phone: optional("phone"),
    bankName: optional("bankName"),
    bankAccountNumber: optional("bankAccountNumber"),
    bankAccountName: optional("bankAccountName"),
    notes: optional("notes"),
  };
}
export async function saveEmployee(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("karyawan");
  let data: ReturnType<typeof read>;
  try {
    data = read(form);
  } catch (error) {
    return { error: (error as Error).message };
  }
  const existingId = String(form.get("existingId") || "");
  if (!departments.some((department) => department === data.department)) {
    if (!existingId) return { error: "Pilih departemen dari daftar yang tersedia." };
    const existing = await getPrisma().employee.findUnique({
      where: { id: existingId },
      select: { department: true },
    });
    if (!existing || existing.department !== data.department)
      return { error: "Pilih departemen dari daftar yang tersedia." };
  }
  try {
    if (existingId) {
      await getPrisma().$transaction(async (tx) => {
        if (!data.active) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(816031)`;
          const owner = await tx.user.findFirst({
            where: { employeeId: existingId, active: true, role: { systemKey: "OWNER" } },
            select: { id: true, roleId: true },
          });
          if (
            owner &&
            !(await tx.user.count({
              where: {
                id: { not: owner.id },
                active: true,
                roleId: owner.roleId,
                OR: [{ employeeId: null }, { employee: { active: true } }],
              },
            }))
          ) {
            const error = new Error(
              "Minimal satu akun Owner harus tetap aktif. Atur akun pengganti sebelum mengubah status karyawan ini.",
            );
            error.name = "EmployeeAccessValidation";
            throw error;
          }
        }
        await tx.employee.update({ where: { id: existingId }, data });
        if (!data.active)
          await tx.session.deleteMany({ where: { user: { employeeId: existingId } } });
      });
    } else {
      await getPrisma().$transaction(async (tx) => {
        const id = await allocateBusinessId(tx, "employee");
        await tx.employee.create({ data: { id, ...data } });
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "EmployeeAccessValidation")
      return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return { error: "ID, NIK, atau kode nama sudah digunakan. Periksa data karyawan yang ada." };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
      return { error: "Data karyawan tidak ditemukan." };
    return { error: "Data belum tersimpan. Periksa koneksi database lalu coba lagi." };
  }
  revalidatePath("/karyawan");
  revalidatePath("/dashboard");
  return { success: "Biodata berhasil disimpan." };
}
