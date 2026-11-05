import "server-only";
import { isIP } from "node:net";
import { digest } from "@/lib/security";
import { getPrisma } from "@/lib/db";

// Trust the closest proxy value, never an arbitrary client-supplied prefix.
// Without a trusted deployment proxy use a shared bucket, not a spoofable header.
export function loginIpKey(headers: Headers) {
  let ip = "local-or-unknown";
  if (process.env.RENDER === "true") {
    const raw = headers.get("x-forwarded-for") || "";
    const candidate = raw.length <= 2048 ? raw.split(",").at(-1)?.trim() || "" : "";
    ip = isIP(candidate) ? candidate.toLowerCase() : "unknown-proxy";
  }
  return digest("login-network:" + ip);
}
export async function consumeLoginAttempt(email: string, ipHash: string) {
  const key = digest(email);
  return getPrisma().$transaction(async (tx) => {
    const now = new Date();
    // IP first: blocked clients cannot create unlimited account buckets.
    for (const [bucket, limit] of [
      ["ip:" + ipHash, 60],
      [key, 10],
    ] as const) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bucket}))`;
      const old = await tx.loginThrottle.findUnique({ where: { key: bucket } });
      if (
        old &&
        now.getTime() - old.windowStart.getTime() <= 15 * 60_000 &&
        old.attempts >= limit
      ) {
        if (old.attempts === limit) {
          await tx.loginThrottle.update({ where: { key: bucket }, data: { attempts: limit + 1 } });
          await tx.securityEvent.create({
            data: { action: "LOGIN_THROTTLED", outcome: "DENIED", ipHash },
          });
        }
        return false;
      }
      const attempts =
        !old || now.getTime() - old.windowStart.getTime() > 15 * 60_000 ? 1 : old.attempts + 1;
      await tx.loginThrottle.upsert({
        where: { key: bucket },
        create: { key: bucket, attempts, windowStart: now },
        update: { attempts, ...(attempts === 1 ? { windowStart: now } : {}) },
      });
    }
    return true;
  });
}
