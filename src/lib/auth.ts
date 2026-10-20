import { hasPermission, rolePermissions, type PermissionKey } from "@/lib/permissions";
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { digest, nextMidnight } from "@/lib/security";
export const sessionCookie = "ck_hris_session";
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await getPrisma().session.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          employee: { select: { active: true } },
          role: { select: { name: true, systemKey: true, active: true, permissions: true } },
        },
      },
    },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !session.user.active ||
    !session.user.role?.active ||
    session.user.employee?.active === false
  )
    return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    expiresAt: session.expiresAt.toISOString(),
    roleName: session.user.role.name,
    permissions: rolePermissions(session.user.role),
  };
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = nextMidnight();
  await getPrisma().session.create({ data: { tokenHash: digest(token), userId, expiresAt } });
  const host = (await headers()).get("host") || "";
  const localHttp =
    process.env.HRIS_LOCAL_MODE === "1" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !localHttp,
    path: "/",
    expires: expiresAt,
  });
}
export async function localSetupAllowed() {
  const host = (await headers()).get("host") || "";
  return process.env.NODE_ENV === "development" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

export async function requireAccess(key: PermissionKey) {
  const user = await requireUser();
  if (!hasPermission(user, key)) redirect("/akses-ditolak");
  return user;
}
