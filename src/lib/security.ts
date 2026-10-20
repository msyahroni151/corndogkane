import { randomBytes, pbkdf2, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(pbkdf2);
const iterations = 600_000;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, iterations, 32, "sha256");
  return "pbkdf2-sha256:" + iterations + ":" + salt + ":" + key.toString("hex");
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, cost, salt, expected] = stored.split(":");
  const wellFormed =
    algorithm === "pbkdf2-sha256" &&
    cost === String(iterations) &&
    /^[a-f0-9]{32}$/.test(salt || "") &&
    /^[a-f0-9]{64}$/.test(expected || "");
  const key = await derive(
    password,
    wellFormed ? salt : "invalid-password-salt",
    iterations,
    32,
    "sha256",
  );
  const target = Buffer.from(wellFormed ? expected : "00".repeat(32), "hex");
  return timingSafeEqual(target, key) && wellFormed;
}
export function nextMidnight(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600_000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - 7 * 3600_000,
  );
}
