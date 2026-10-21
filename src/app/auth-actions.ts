"use server";
import { isValidNewPassword, passwordError } from "@/lib/password-policy";
import { homeFor, rolePermissions } from "@/lib/permissions";
import { authNoticeCookie } from "@/lib/auth-notice";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { hashPassword, verifyPassword, digest } from "@/lib/security";
import { createSession, localSetupAllowed, sessionCookie } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
const text = (form: FormData, key: string) => String(form.get(key) || "").trim();

export async function setupAdmin(_: FormState, form: FormData): Promise<FormState> {
  if (!(await localSetupAllowed()))
    return { error: "Penyiapan hanya tersedia melalui localhost pada mode pengembangan." };
  const name = text(form, "name"),
    email = text(form, "email").toLowerCase();
  const password = String(form.get("password") || "");
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return { error: "Lengkapi nama dan email yang valid." };
  if (!isValidNewPassword(password)) return { error: passwordError };
  if (password !== form.get("confirmation")) return { error: "Konfirmasi password belum sama." };
  const passwordHash = await hashPassword(password);
  const id = await getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(714211)`;
    if (await tx.user.count()) return null;
    return (await tx.user.create({ data: { name, email, passwordHash, roleId: "ROLE-OWNER" } })).id;
  });
  if (!id) return { error: "Akun administrator sudah dibuat. Silakan masuk." };
  await createSession(id);
  redirect("/dashboard");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = text(form, "email").toLowerCase(),
    password = String(form.get("password") || "");
  if (!email || email.length > 254 || !password || password.length > 128)
    return { error: "Email atau password tidak sesuai." };
  const key = digest(email);
  const allowed = await getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const now = new Date();
    const record = await tx.loginThrottle.findUnique({ where: { key } });
    if (!record || now.getTime() - record.windowStart.getTime() > 15 * 60_000) {
      await tx.loginThrottle.upsert({
        where: { key },
        create: { key, attempts: 1, windowStart: now },
        update: { attempts: 1, windowStart: now },
      });
      return true;
    }
    if (record.attempts >= 10) return false;
    await tx.loginThrottle.update({ where: { key }, data: { attempts: { increment: 1 } } });
    return true;
  });
  if (!allowed) return { error: "Terlalu banyak percobaan. Silakan coba lagi setelah 15 menit." };
  const user = await getPrisma().user.findUnique({
    where: { email },
    include: { role: true, employee: { select: { active: true } } },
  });
  const valid = await verifyPassword(password, user?.passwordHash || "");
  if (!valid || !user?.active || !user.role?.active || user.employee?.active === false)
    return { error: "Email atau password tidak sesuai." };
  const permissions = rolePermissions(user.role!);
  if (!permissions.length)
    return { error: "Role akun belum memiliki hak akses. Hubungi pengelola." };
  await getPrisma().loginThrottle.deleteMany({ where: { key } });
  await createSession(user.id);
  (await cookies()).set(authNoticeCookie, "signed-in", {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
  });
  redirect(homeFor(permissions));
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await getPrisma().session.deleteMany({ where: { tokenHash: digest(token) } });
  jar.delete(sessionCookie);
  jar.set(authNoticeCookie, "signed-out", {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
  });
  redirect("/login");
}
