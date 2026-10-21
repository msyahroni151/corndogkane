import "server-only";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
export async function portalIdentity() {
  const user = await requireAccess("portal-karyawan");
  const account = await getPrisma().user.findUnique({
    where: { id: user.id },
    select: { employee: { select: { id: true, fullName: true, active: true } } },
  });
  if (!account?.employee?.active)
    throw Error("Akun belum terhubung ke karyawan aktif. Hubungi admin melalui Role & Akun Login.");
  return { user, employee: account.employee };
}
export function jpegOf(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("data:image/jpeg;base64,") ||
    value.length > 300000
  )
    throw Error("Foto harus JPEG dengan ukuran maksimal 200 KB.");
  const b = Buffer.from(value.slice(23), "base64");
  if (
    b.length < 1000 ||
    b.length > 200000 ||
    b[0] !== 255 ||
    b[1] !== 216 ||
    b[2] !== 255 ||
    b[b.length - 2] !== 255 ||
    b[b.length - 1] !== 217
  )
    throw Error("Foto kamera tidak valid.");
  return b;
}
