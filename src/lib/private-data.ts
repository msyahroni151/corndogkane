import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
const prefix = Buffer.from("CKENC1:");
function key(purpose: string) {
  const raw = process.env.SECURITY_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/.test(raw)) throw new Error("Konfigurasi enkripsi keamanan belum tersedia.");
  return Buffer.from(hkdfSync("sha256", Buffer.from(raw, "hex"), "corndog-kane-v1", purpose, 32));
}
export function sealPrivate(value: Uint8Array | string, purpose: string): Buffer<ArrayBuffer> {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([prefix, iv, cipher.getAuthTag(), data]);
}
export function openPrivate(value: Uint8Array, purpose: string, allowLegacy = false): Buffer {
  const bytes = Buffer.from(value);
  if (!bytes.subarray(0, prefix.length).equals(prefix)) {
    if (allowLegacy) return bytes;
    throw new Error("Data terenkripsi tidak valid.");
  }
  if (bytes.length < prefix.length + 28) throw new Error("Data terenkripsi tidak valid.");
  const offset = prefix.length,
    decipher = createDecipheriv("aes-256-gcm", key(purpose), bytes.subarray(offset, offset + 12));
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28));
  return Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()]);
}
export function sealDescriptor(value: number[]) {
  return { encrypted: sealPrivate(JSON.stringify(value), "face-descriptor").toString("base64") };
}
export function openDescriptor(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "encrypted" in value &&
    typeof value.encrypted === "string"
  )
    return JSON.parse(
      openPrivate(Buffer.from(value.encrypted, "base64"), "face-descriptor").toString("utf8"),
    );
  return value;
}
