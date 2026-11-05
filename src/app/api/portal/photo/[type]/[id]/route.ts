import { openPrivate } from "@/lib/private-data";
import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const { type, id } = await params;
  const reviewer = user.permissions.includes("portal-review");
  if (
    !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
    !["face", "selfie", "cart"].includes(type) ||
    (!reviewer && (!user.permissions.includes("portal-karyawan") || !user.employeeId))
  )
    return new Response(null, { status: 404 });
  if (type === "face" && !reviewer && id !== user.employeeId)
    return new Response(null, { status: 404 });
  const db = getPrisma();
  const record =
    type === "face"
      ? await db.portalFace.findUnique({
          where: { employeeId: id },
          select: { employeeId: true, photo: true },
        })
      : await db.portalCapture.findFirst({
          where: { id, ...(reviewer ? {} : { employeeId: user.employeeId! }) },
          select: { employeeId: true, facePhoto: true, cartPhoto: true },
        });
  if (!record) return new Response(null, { status: 404 });
  const bytes =
    "photo" in record ? record.photo : type === "cart" ? record.cartPhoto : record.facePhoto;
  return new Response(new Uint8Array(openPrivate(bytes, "portal-photo", true)), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
