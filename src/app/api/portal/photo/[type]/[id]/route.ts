import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const { type, id } = await params;
  const db = getPrisma();
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { employeeId: true },
  });
  const record =
    type === "face"
      ? await db.portalFace.findUnique({
          where: { employeeId: id },
          select: { employeeId: true, photo: true },
        })
      : ["selfie", "cart"].includes(type)
        ? await db.portalCapture.findUnique({
            where: { id },
            select: { employeeId: true, facePhoto: true, cartPhoto: true },
          })
        : null;
  if (
    !record ||
    (!user.permissions.includes("portal-review") &&
      (!user.permissions.includes("portal-karyawan") || record.employeeId !== account?.employeeId))
  )
    return new Response(null, { status: 404 });
  const bytes =
    "photo" in record ? record.photo : type === "cart" ? record.cartPhoto : record.facePhoto;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
