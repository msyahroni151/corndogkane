import "server-only";
import * as OTPAuth from "otpauth";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getPrisma } from "@/lib/db";
import { digest } from "@/lib/security";
import { sealPrivate, openPrivate } from "@/lib/private-data";
export const mfaCookie = "ck_hris_mfa";
export function totp(secret: string, email = "account") {
  return new OTPAuth.TOTP({
    issuer: "Corndog Kane",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}
export function validCounter(secret: string, code: string, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = totp(secret).validate({ token: code, window: 1, timestamp });
  return delta === null ? null : Math.floor(timestamp / 30000) + delta;
}
export function newMfaSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}
export function newRecoveryCodes() {
  return Array.from({ length: 10 }, () =>
    randomBytes(12).toString("hex").match(/.{6}/g)!.join("-"),
  );
}
export function normalizeRecovery(code: string) {
  return code.replace(/[-\s]/g, "").toLowerCase();
}
export function recoveryMatches(code: string, hashes: string[]) {
  const hash = digest(normalizeRecovery(code));
  return hashes.findIndex(
    (candidate) =>
      /^[a-f0-9]{64}$/.test(candidate) &&
      timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex")),
  );
}
export async function beginMfa(userId: string) {
  const db = getPrisma(),
    token = randomBytes(32).toString("hex");
  const credential = await db.mfaCredential.findUnique({
    where: { userId },
    select: { userId: true },
  });
  await db.mfaChallenge.create({
    data: {
      tokenHash: digest(token),
      userId,
      expiresAt: new Date(Date.now() + 10 * 60000),
      setupCipher: credential ? null : sealPrivate(newMfaSecret(), "mfa-secret"),
    },
  });
  const host = (await headers()).get("host") || "";
  const local =
    process.env.RENDER !== "true" &&
    process.env.HRIS_LOCAL_MODE === "1" &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  (await cookies()).set(mfaCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !local,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}
export async function pendingMfa() {
  const token = (await cookies()).get(mfaCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const c = await getPrisma().mfaChallenge.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { include: { role: true, employee: { select: { active: true } } } } },
  });
  if (
    !c ||
    c.expiresAt <= new Date() ||
    (c.attempts >= 5 && !c.verifiedAt) ||
    !c.user.active ||
    !c.user.role?.active ||
    c.user.employee?.active === false
  )
    return null;
  return c;
}
export function setupSecret(cipher: Uint8Array) {
  return openPrivate(cipher, "mfa-secret").toString("utf8");
}

export async function cancelPendingMfa() {
  const jar = await cookies(),
    token = jar.get(mfaCookie)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token))
    await getPrisma().mfaChallenge.deleteMany({ where: { tokenHash: digest(token) } });
  jar.delete(mfaCookie);
}
