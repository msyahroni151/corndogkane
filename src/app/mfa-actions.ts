"use server";
import { cookies, headers } from "next/headers";
import { consumeLoginAttempt, loginIpKey } from "@/lib/login-rate-limit";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { currentUser, createSession } from "@/lib/auth";
import { digest, verifyPassword } from "@/lib/security";
import { homeFor, rolePermissions } from "@/lib/permissions";
import {
  beginMfa,
  pendingMfa,
  mfaCookie,
  setupSecret,
  validCounter,
  newRecoveryCodes,
  normalizeRecovery,
  recoveryMatches,
} from "@/lib/mfa";
import { sealPrivate } from "@/lib/private-data";
import type { FormState } from "@/lib/form-state";
export async function verifyMfa(_: FormState, form: FormData): Promise<FormState> {
  const pending = await pendingMfa();
  if (!pending) return { error: "Verifikasi kedaluwarsa atau percobaan habis. Masuk kembali." };
  const code = String(form.get("code") || "").trim();
  if (code.length > 80 || pending.verifiedAt) return { error: "Kode verifikasi tidak valid." };
  let result: "failed" | "enrolled" | "verified";
  try {
    result = await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"mfa:" + pending.userId}))`;
      const c = await tx.mfaChallenge.findUnique({ where: { tokenHash: pending.tokenHash } });
      if (!c || c.expiresAt <= new Date() || c.attempts >= 5 || c.verifiedAt) return "failed";
      await tx.mfaChallenge.update({
        where: { tokenHash: c.tokenHash },
        data: { attempts: { increment: 1 } },
      });
      const credential = await tx.mfaCredential.findUnique({ where: { userId: c.userId } });
      let valid = false,
        usedRecovery = false;
      if (c.setupCipher && !credential) {
        const counter = validCounter(setupSecret(c.setupCipher), code);
        if (counter !== null) {
          const codes = newRecoveryCodes();
          await tx.mfaCredential.create({
            data: {
              userId: c.userId,
              secretCipher: c.setupCipher,
              lastCounter: counter,
              recoveryHashes: codes.map((v) => digest(normalizeRecovery(v))),
            },
          });
          await tx.mfaChallenge.update({
            where: { tokenHash: c.tokenHash },
            data: {
              verifiedAt: new Date(),
              recoveryCipher: sealPrivate(JSON.stringify(codes), "mfa-recovery"),
            },
          });
          await tx.securityEvent.create({
            data: { userId: c.userId, action: "MFA_ENROLLED", outcome: "SUCCESS" },
          });
          return "enrolled";
        }
      } else if (credential && !c.setupCipher) {
        const counter = validCounter(setupSecret(credential.secretCipher), code);
        if (counter !== null && counter > credential.lastCounter) {
          await tx.mfaCredential.update({
            where: { userId: c.userId },
            data: { lastCounter: counter },
          });
          valid = true;
        } else if (!/^\d{6}$/.test(code)) {
          const hashes = Array.isArray(credential.recoveryHashes)
            ? credential.recoveryHashes.filter((v): v is string => typeof v === "string")
            : [];
          const index = recoveryMatches(code, hashes);
          if (index >= 0) {
            hashes.splice(index, 1);
            await tx.mfaCredential.update({
              where: { userId: c.userId },
              data: { recoveryHashes: hashes },
            });
            valid = true;
            usedRecovery = true;
          }
        }
      }
      if (!valid) {
        await tx.securityEvent.create({
          data: { userId: c.userId, action: "MFA_FAILED", outcome: "DENIED" },
        });
        return "failed";
      }
      await tx.mfaChallenge.delete({ where: { tokenHash: c.tokenHash } });
      await tx.securityEvent.create({
        data: {
          userId: c.userId,
          action: usedRecovery ? "MFA_RECOVERY_USED" : "MFA_VERIFIED",
          outcome: "SUCCESS",
        },
      });
      return "verified";
    });
  } catch {
    return { error: "Verifikasi sementara tidak tersedia. Coba kembali." };
  }
  if (result === "failed")
    return { error: "Kode salah, sudah dipakai, atau kedaluwarsa. Maksimal 5 percobaan." };
  if (result === "enrolled") redirect("/verifikasi-keamanan");
  await getPrisma().loginThrottle.deleteMany({ where: { key: digest(pending.user.email) } });
  await createSession(pending.userId, true);
  (await cookies()).delete(mfaCookie);
  redirect(homeFor(rolePermissions(pending.user.role!)));
}
export async function finishMfaEnrollment() {
  const c = await pendingMfa();
  if (!c?.verifiedAt || !c.recoveryCipher) redirect("/login");
  const deleted = await getPrisma().mfaChallenge.deleteMany({
    where: { tokenHash: c.tokenHash, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
  });
  if (!deleted.count) redirect("/login");
  await getPrisma().loginThrottle.deleteMany({ where: { key: digest(c.user.email) } });
  await createSession(c.userId, true);
  (await cookies()).delete(mfaCookie);
  redirect(homeFor(rolePermissions(c.user.role!)));
}
export async function enrollOwnMfa(_: FormState, form: FormData): Promise<FormState> {
  const actor = await currentUser();
  if (!actor) return { error: "Masuk kembali." };
  if (!(await consumeLoginAttempt(actor.email, loginIpKey(await headers()))))
    return { error: "Terlalu banyak percobaan. Coba lagi setelah 15 menit." };
  const user = await getPrisma().user.findUnique({
    where: { id: actor.id },
    select: { passwordHash: true, mfaCredential: { select: { userId: true } } },
  });
  const password = String(form.get("password") || "");
  if (
    !user ||
    user.mfaCredential ||
    password.length > 128 ||
    !(await verifyPassword(password, user.passwordHash))
  )
    return { error: "Password tidak sesuai atau MFA sudah aktif." };
  await beginMfa(actor.id);
  redirect("/verifikasi-keamanan");
}
