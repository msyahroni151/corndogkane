import { requiresMfa } from "@/lib/mfa-policy";
import { roleActionPermissions, hasAction, type PermissionAction } from "@/lib/permission-actions";
import { hasPermission, rolePermissions, type PermissionKey } from "@/lib/permissions";
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { digest, nextMidnight } from "@/lib/security";
export const sessionCookie = "ck_hris_session";
// Deduplikasi hanya selama satu render request; sesi tetap diperiksa pada request berikutnya.
export const currentUser = cache(async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await getPrisma().session.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      expiresAt: true,
      mfaVerifiedAt: true,
      user: {
        select: {
          id: true,
          employeeId: true,
          mfaCredential: { select: { userId: true } },
          name: true,
          email: true,
          active: true,
          employee: { select: { active: true } },
          role: {
            select: {
              name: true,
              systemKey: true,
              active: true,
              permissions: true,
              mfaRequired: true,
            },
          },
        },
      },
    },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !session.user.active ||
    !session.user.role?.active ||
    session.user.employee?.active === false ||
    ((!!session.user.mfaCredential || (session.user.role && requiresMfa(session.user.role))) &&
      !session.mfaVerifiedAt)
  )
    return null;
  return {
    id: session.user.id,
    employeeId: session.user.employeeId,
    name: session.user.name,
    email: session.user.email,
    expiresAt: session.expiresAt.toISOString(),
    mfaEnabled: !!session.user.mfaCredential,
    mfaVerifiedAt: session.mfaVerifiedAt?.toISOString() || null,
    actionPermissions: roleActionPermissions(session.user.role),
    roleName: session.user.role.name,
    roleSystemKey: session.user.role.systemKey,
    permissions: rolePermissions(session.user.role),
  };
});
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function createSession(userId: string, mfaVerified = false) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = nextMidnight();
  const previous = (await cookies()).get(sessionCookie)?.value;
  await getPrisma().$transaction(async (tx) => {
    if (previous && /^[a-f0-9]{64}$/.test(previous))
      await tx.session.deleteMany({ where: { tokenHash: digest(previous) } });
    await tx.session.create({
      data: {
        tokenHash: digest(token),
        userId,
        expiresAt,
        mfaVerifiedAt: mfaVerified ? new Date() : null,
      },
    });
  });
  const host = (await headers()).get("host") || "";
  const localHttp =
    process.env.RENDER !== "true" &&
    process.env.HRIS_LOCAL_MODE === "1" &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
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

export async function requireAccess(key: PermissionKey, action: PermissionAction = "view") {
  const user = await requireUser();
  if (!hasPermission(user, key) || !hasAction(user, key, action)) redirect("/akses-ditolak");
  return user;
}
