"use server";
import { requiresMfa } from "@/lib/mfa-policy";
import { beginMfa, cancelPendingMfa } from "@/lib/mfa";
import { isValidNewPassword, passwordError } from "@/lib/password-policy";
import { homeFor, rolePermissions } from "@/lib/permissions";
import { authNoticeCookie } from "@/lib/auth-notice";
import { cookies, headers } from "next/headers";
import { consumeLoginAttempt, loginIpKey } from "@/lib/login-rate-limit";
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
  await beginMfa(id);
  redirect("/verifikasi-keamanan");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = text(form, "email").toLowerCase(),
    password = String(form.get("password") || "");
  if (!email || email.length > 254 || !password || password.length > 128)
    return { error: "Email atau password tidak sesuai." };
  const key = digest(email);
  const ipHash = loginIpKey(await headers());
  let allowed: boolean;
  try {
    allowed = await consumeLoginAttempt(email, ipHash);
  } catch {
    return { error: "Login sementara tidak tersedia. Silakan coba kembali." };
  }
  if (!allowed) return { error: "Terlalu banyak percobaan. Silakan coba lagi setelah 15 menit." };
  await cancelPendingMfa();
  const user = await getPrisma().user.findUnique({
    where: { email },
    include: {
      role: true,
      mfaCredential: { select: { userId: true } },
      employee: { select: { active: true } },
    },
  });
  const valid = await verifyPassword(password, user?.passwordHash || "");
  if (!valid || !user?.active || !user.role?.active || user.employee?.active === false) {
    // No email, password, session token, or biometric data in the audit trail.
    await getPrisma().securityEvent.create({
      data: { action: "LOGIN_FAILED", outcome: "DENIED", ipHash },
    });
    return { error: "Email atau password tidak sesuai." };
  }
  const permissions = rolePermissions(user.role!);
  if (!permissions.length)
    return { error: "Role akun belum memiliki hak akses. Hubungi pengelola." };
  if (user.mfaCredential || requiresMfa(user.role!)) {
    await beginMfa(user.id);
    redirect("/verifikasi-keamanan");
  }
  await getPrisma().loginThrottle.deleteMany({ where: { key } });
  await getPrisma().securityEvent.create({
    data: { userId: user.id, action: "LOGIN", outcome: "SUCCESS", ipHash },
  });
  await createSession(user.id);
  (await cookies()).set(authNoticeCookie, "signed-in", {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
  });
  redirect(homeFor(permissions));
}
export async function logout() {
  await cancelPendingMfa();
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await getPrisma().$transaction(async (tx) => {
      const tokenHash = digest(token);
      const session = await tx.session.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      await tx.session.deleteMany({ where: { tokenHash } });
      if (session)
        await tx.securityEvent.create({
          data: { userId: session.userId, action: "LOGOUT", outcome: "SUCCESS" },
        });
    });
  }
  jar.delete(sessionCookie);
  jar.set(authNoticeCookie, "signed-out", {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
  });
  redirect("/login");
}
