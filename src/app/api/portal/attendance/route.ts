import { sealDescriptor, openDescriptor } from "@/lib/private-data";
import { hasAction } from "@/lib/permission-actions";
import { boundedJsonText, RequestBodyError } from "@/lib/request-body";
import { sameOrigin } from "@/lib/request-origin";
import { PortalInputError } from "@/lib/portal-input-error";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { jpegOf } from "@/lib/portal-access";
import { descriptorOf, faceDistance, portalWindow } from "@/lib/employee-portal";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !user.permissions.includes("portal-karyawan"))
    return NextResponse.json(
      { error: "Masuk kembali dengan akun portal karyawan." },
      { status: 401 },
    );
  if (!hasAction(user, "portal-karyawan", "create"))
    return Response.json({ error: "Izin aksi ditolak." }, { status: 403 });
  try {
    if (!sameOrigin(req))
      return NextResponse.json({ error: "Permintaan kamera tidak valid." }, { status: 403 });
    const raw = await boundedJsonText(req, 650000);
    const body = JSON.parse(raw),
      db = getPrisma(),
      account = await db.user.findUnique({
        where: { id: user.id },
        select: { employee: { select: { id: true, active: true } } },
      });
    const employee = account?.employee;
    if (!employee?.active) throw new PortalInputError("Akun belum terhubung ke karyawan aktif.");
    if (body.step === "ENROLL") {
      if (body.consent !== true)
        throw new PortalInputError("Persetujuan penggunaan wajah diperlukan.");
      const descriptor = sealDescriptor(descriptorOf(body.descriptor)),
        photo = jpegOf(body.photo);
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employee.id} FOR UPDATE`;
        const existing = await tx.portalFace.findUnique({ where: { employeeId: employee.id } });
        if (existing && existing.status !== "REJECTED")
          throw new PortalInputError("Wajah sudah terdaftar atau menunggu persetujuan admin.");
        await tx.portalFace.upsert({
          where: { employeeId: employee.id },
          create: { employeeId: employee.id, descriptor, photo, requestedById: user.id },
          update: {
            descriptor,
            photo,
            status: "PENDING",
            requestedById: user.id,
            reviewedById: null,
            reviewedAt: null,
            decisionNotes: null,
          },
        });
      });
      return NextResponse.json({
        success:
          "Pendaftaran wajah terkirim. Admin perlu memeriksa identitas Anda sebelum absensi wajah dapat digunakan.",
      });
    }
    if (body.step === "START") {
      if (!["IN", "OUT"].includes(body.kind) || typeof body.scheduleId !== "string")
        throw new PortalInputError("Pilih jadwal dan jenis absensi.");
      await db.portalChallenge.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
      });
      const challenge = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employee.id} FOR UPDATE`;
        if (
          (await tx.portalChallenge.count({
            where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 15 * 60000) } },
          })) >= 10
        )
          throw new PortalInputError("Terlalu banyak percobaan. Coba lagi setelah 15 menit.");
        const face = await tx.portalFace.findUnique({ where: { employeeId: employee.id } });
        if (face?.status !== "APPROVED")
          throw new PortalInputError("Pendaftaran wajah belum disetujui admin.");
        const s = await tx.schedule.findFirst({
          where: { id: body.scheduleId, employeeId: employee.id },
          include: { attendance: true },
        });
        if (!s) throw new PortalInputError("Jadwal tidak tersedia.");
        portalWindow(s, body.kind);
        if (body.kind === "IN" && s.attendance)
          throw new PortalInputError(
            "Absensi masuk sudah tercatat. Hubungi admin jika perlu koreksi.",
          );
        if (
          body.kind === "OUT" &&
          (!s.attendance ||
            s.attendance.checkInMinutes === null ||
            s.attendance.checkOutMinutes !== null)
        )
          throw new PortalInputError(
            "Absensi masuk harus disetujui terlebih dahulu dan belum tercatat pulang.",
          );
        if (
          await tx.portalCapture.findFirst({
            where: { scheduleId: s.id, kind: body.kind, status: { in: ["PENDING", "APPROVED"] } },
          })
        )
          throw new PortalInputError("Bukti absensi ini sudah dikirim.");
        if (
          await tx.payroll.findFirst({
            where: {
              employeeId: employee.id,
              status: "PAID",
              startDate: { lte: s.date },
              endDate: { gte: s.date },
            },
          })
        )
          throw new PortalInputError("Periode absensi sudah ditutup payroll.");
        return tx.portalChallenge.create({
          data: {
            employeeId: employee.id,
            userId: user.id,
            scheduleId: s.id,
            kind: body.kind,
            scheduleVersion: s.updatedAt.toISOString(),
            attendanceVersion: s.attendance?.updatedAt.toISOString() || "",
            expiresAt: new Date(Date.now() + 3 * 60000),
          },
        });
      });
      return NextResponse.json({ id: challenge.id });
    }
    if (!["VERIFY", "COMPLETE"].includes(body.step) || typeof body.id !== "string")
      throw new PortalInputError("Tahap absensi tidak valid.");
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employee.id} FOR UPDATE`;
        await tx.$executeRaw`SELECT id FROM portal_challenges WHERE id=${body.id} FOR UPDATE`;
        const c = await tx.portalChallenge.findUnique({ where: { id: body.id } });
        if (!c || c.userId !== user.id || c.employeeId !== employee.id)
          throw new PortalInputError("Sesi kamera tidak tersedia.");
        if (c.consumedAt) {
          if (body.step === "COMPLETE") return { success: "Bukti absensi sudah terkirim." };
          throw new PortalInputError("Sesi kamera sudah digunakan.");
        }
        if (c.expiresAt < new Date())
          throw new PortalInputError("Sesi kamera kedaluwarsa. Mulai kembali.");
        const s = await tx.schedule.findFirst({
          where: { id: c.scheduleId, employeeId: employee.id },
          include: { attendance: true },
        });
        if (
          !s ||
          s.updatedAt.toISOString() !== c.scheduleVersion ||
          (s.attendance?.updatedAt.toISOString() || "") !== c.attendanceVersion
        )
          throw new PortalInputError("Jadwal atau absensi berubah. Mulai kembali.");
        portalWindow(s, c.kind);
        if (body.step === "VERIFY") {
          if (c.attempts >= 5 || c.verifiedAt)
            throw new PortalInputError(
              "Batas percobaan tercapai atau wajah sudah diverifikasi. Mulai kembali.",
            );
          const face = await tx.portalFace.findUnique({ where: { employeeId: employee.id } });
          if (face?.status !== "APPROVED")
            throw new PortalInputError("Wajah belum disetujui admin.");
          const descriptor = descriptorOf(body.descriptor),
            photo = jpegOf(body.photo),
            distance = faceDistance(descriptorOf(openDescriptor(face.descriptor)), descriptor);
          await tx.portalChallenge.update({
            where: { id: c.id },
            data: {
              attempts: { increment: 1 },
              ...(distance <= 0.48 ? { verifiedAt: new Date(), facePhoto: photo, distance } : {}),
            },
          });
          return distance <= 0.48
            ? { success: "Wajah sesuai. Foto gerobak atau area kerja dengan kamera belakang." }
            : { error: "Wajah belum cocok. Pastikan pencahayaan cukup dan coba kembali." };
        }
        if (!c.verifiedAt || !c.facePhoto || c.distance === null)
          throw new PortalInputError("Verifikasi wajah harus diselesaikan terlebih dahulu.");
        const cartPhoto = jpegOf(body.photo);
        if (
          await tx.portalCapture.findFirst({
            where: {
              scheduleId: c.scheduleId,
              kind: c.kind,
              status: { in: ["PENDING", "APPROVED"] },
            },
          })
        )
          throw new PortalInputError("Bukti absensi sudah dikirim dari sesi lain.");
        await tx.portalCapture.create({
          data: {
            challengeId: c.id,
            employeeId: employee.id,
            scheduleId: c.scheduleId,
            kind: c.kind,
            scheduleVersion: c.scheduleVersion,
            attendanceVersion: c.attendanceVersion,
            facePhoto: c.facePhoto,
            cartPhoto,
            distance: c.distance,
            capturedAt: c.verifiedAt,
          },
        });
        await tx.portalChallenge.update({
          where: { id: c.id },
          data: { consumedAt: new Date(), facePhoto: null },
        });
        return {
          success:
            "Bukti absensi terkirim. Jam disimpan dari server saat wajah terverifikasi; menunggu pemeriksaan admin.",
        };
      },
      { timeout: 15000 },
    );
    return NextResponse.json(result, result.error ? { status: 400 } : undefined);
  } catch (e) {
    if (e instanceof RequestBodyError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json(
      {
        error: e instanceof PortalInputError ? e.message : "Absensi belum tersimpan. Coba kembali.",
      },
      { status: e instanceof PortalInputError || e instanceof SyntaxError ? 400 : 500 },
    );
  }
}
