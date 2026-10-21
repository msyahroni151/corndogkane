"use server";
import { isValidNewPassword, passwordError } from "@/lib/password-policy";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { permissionMenus, rolePermissions } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { FormState } from "@/lib/form-state";
function invalid(message: string): never {
  const error = new Error(message);
  error.name = "RoleValidation";
  throw error;
}
function failure(error: unknown): FormState {
  if (error instanceof Error && error.name === "RoleValidation") return { error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return { error: "Nama role, email, atau akun karyawan sudah digunakan." };
  return { error: "Perubahan belum tersimpan. Periksa koneksi dan coba lagi." };
}
export async function saveAccessRole(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("role");
  const get = (key: string) => String(form.get(key) || "").trim();
  try {
    const name = get("name").replace(/\s+/g, " ");
    if (!name || name.length > 100 || get("description").length > 1000)
      invalid("Isi nama role maksimal 100 karakter dan deskripsi maksimal 1000 karakter.");
    if (!["true", "false"].includes(get("active"))) invalid("Status role tidak valid.");
    const selected = form.getAll("permission").map(String);
    if (selected.some((key) => !permissionMenus.some((item) => item.key === key)))
      invalid("Hak akses menu tidak valid.");
    const permissions = Object.fromEntries(
      permissionMenus.map((item) => [item.key, selected.includes(item.key)]),
    );
    const active = get("active") === "true";
    if (active && !selected.length && !get("id"))
      invalid("Pilih minimal satu hak akses untuk role aktif.");
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(816031)`;
      const old = get("id") ? await tx.accessRole.findUnique({ where: { id: get("id") } }) : null;
      if (get("id") && (!old || old.updatedAt.toISOString() !== get("version")))
        invalid("Role sudah berubah. Tutup popup dan muat ulang sebelum mengedit.");
      if (old?.systemKey === "OWNER" && (!active || name !== old.name))
        invalid("Role Owner harus tetap aktif dan namanya tetap Owner.");
      if (active && !selected.length && old?.systemKey !== "OWNER")
        invalid("Pilih minimal satu hak akses untuk role aktif.");
      const duplicate = await tx.accessRole.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          ...(old ? { id: { not: old.id } } : {}),
        },
      });
      if (duplicate) invalid("Nama role sudah digunakan.");
      const data = {
        name,
        description: get("description") || null,
        active,
        ...(old?.systemKey === "OWNER" ? {} : { permissions }),
      };
      if (old) {
        await tx.accessRole.update({ where: { id: old.id }, data });
        if (
          !active ||
          JSON.stringify(rolePermissions(old)) !==
            JSON.stringify(rolePermissions({ permissions, systemKey: old.systemKey }))
        ) {
          await tx.session.deleteMany({ where: { user: { roleId: old.id } } });
        }
      } else await tx.accessRole.create({ data: { ...data, permissions } });
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/role");
  return { success: "Pengaturan role berhasil disimpan." };
}
export async function saveLoginAccount(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("role");
  const get = (key: string) => String(form.get(key) || "").trim();
  try {
    const email = get("email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      invalid("Isi email login yang valid.");
    const password = String(form.get("password") || "");
    if ((!get("id") || password) && !isValidNewPassword(password)) invalid(passwordError);
    if (password && password !== form.get("confirmation"))
      invalid("Konfirmasi password belum sama.");
    if (!["true", "false"].includes(get("active"))) invalid("Status akun tidak valid.");
    const passwordHash = password ? await hashPassword(password) : undefined;
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(816031)`;
        const old = get("id") ? await tx.user.findUnique({ where: { id: get("id") } }) : null;
        if (get("id") && (!old || old.updatedAt.toISOString() !== get("version")))
          invalid("Akun sudah berubah. Tutup popup dan muat ulang sebelum mengedit.");
        const role = await tx.accessRole.findUnique({ where: { id: get("roleId") } });
        const active = get("active") === "true";
        if (!role || (active && (!role.active || !rolePermissions(role).length)))
          invalid("Pilih role aktif yang memiliki hak akses menu.");
        const employeeId = old ? old.employeeId : get("employeeId");
        if (!old && !employeeId) invalid("Pilih karyawan yang akan diberikan akun login.");
        const employee = employeeId
          ? await tx.employee.findUnique({
              where: { id: employeeId },
              select: { id: true, fullName: true, active: true },
            })
          : null;
        if (employeeId && !employee) invalid("Karyawan tidak ditemukan.");
        if (active && employee && !employee.active)
          invalid("Karyawan resign/tidak aktif tidak dapat diberi akun aktif.");
        const ownerRole = await tx.accessRole.findUnique({ where: { systemKey: "OWNER" } });
        if (old?.active && old.roleId === ownerRole?.id && (!active || role.id !== ownerRole?.id)) {
          const otherOwners = await tx.user.count({
            where: {
              id: { not: old.id },
              roleId: ownerRole!.id,
              active: true,
              OR: [{ employeeId: null }, { employee: { active: true } }],
            },
          });
          if (!otherOwners) invalid("Minimal satu akun Owner harus tetap aktif.");
        }
        const data = {
          email,
          name: employee?.fullName || old!.name,
          roleId: role.id,
          active,
          ...(passwordHash ? { passwordHash } : {}),
        };
        if (old) {
          await tx.user.update({ where: { id: old.id }, data });
          if (
            passwordHash ||
            old.email !== email ||
            old.roleId !== role.id ||
            old.active !== active
          )
            await tx.session.deleteMany({ where: { userId: old.id } });
        } else
          await tx.user.create({
            data: { ...data, employeeId: employee!.id, passwordHash: passwordHash! },
          });
      },
      { timeout: 10000 },
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/role");
  return { success: "Pengaturan akun login berhasil disimpan." };
}
