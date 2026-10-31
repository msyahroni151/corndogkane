import { sameOrigin } from "@/lib/request-origin";
import { hasPermission } from "@/lib/permissions";
import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import type { ShareScheduleData } from "@/lib/share-schedule";
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return Response.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  if (!hasPermission(user, "jadwal"))
    return Response.json({ error: "Anda tidak memiliki akses jadwal." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  let from: Date, to: Date;
  try {
    from = parseCivilDate(params.get("from") || "");
    to = parseCivilDate(params.get("to") || "");
    if (to < from || to.getTime() - from.getTime() > 30 * 86400000) throw Error();
  } catch {
    return Response.json(
      { error: "Pilih tanggal mulai dan akhir yang valid, maksimal 31 hari." },
      { status: 400 },
    );
  }
  const db = getPrisma();
  const [areas, outlets, rows, areaNotes] = await Promise.all([
    db.area.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    db.outlet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, areaId: true, active: true },
    }),
    db.schedule.findMany({
      where: { date: { gte: from, lte: to }, role: { in: ["REGULER", "BACKUP"] } },
      orderBy: [{ date: "asc" }, { employeeName: "asc" }],
      select: {
        id: true,
        employeeId: true,
        employeeName: true,
        date: true,
        role: true,
        status: true,
        outletId: true,
        outletName: true,
        areaName: true,
        startMinutes: true,
        endMinutes: true,
        placement: { select: { areaId: true } },
      },
    }),
    db.scheduleAreaNote.findMany({
      where: { startDate: from, endDate: to },
      select: { areaId: true, note: true, updatedAt: true },
    }),
  ]);
  const referencedOutlets = new Set(rows.map((r) => r.outletId).filter(Boolean));
  const activeAreas = new Set(areas.filter((a) => a.active).map((a) => a.id));
  const visibleOutlets = outlets.filter(
    (o) => (o.active && activeAreas.has(o.areaId)) || referencedOutlets.has(o.id),
  );
  const referencedAreas = new Set([
    ...visibleOutlets.map((o) => o.areaId),
    ...rows.map((r) => r.placement.areaId),
  ]);
  const data: ShareScheduleData = {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    areas: areas
      .filter((a) => a.active || referencedAreas.has(a.id))
      .map((a) => ({ id: a.id, name: a.name })),
    outlets: visibleOutlets.map((o) => ({ id: o.id, name: o.name, areaId: o.areaId })),
    areaNotes: areaNotes.map((n) => ({
      areaId: n.areaId,
      note: n.note,
      version: n.updatedAt.toISOString(),
    })),
    rows: rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      name: r.employeeName,
      date: r.date.toISOString().slice(0, 10),
      role: r.role,
      status: r.status,
      outletId: r.outletId,
      outletName: r.outletName,
      homeAreaId: r.placement.areaId,
      homeAreaName: r.areaName,
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
    })),
  };
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Silakan login kembali." }, { status: 401 });
  if (!hasPermission(user, "jadwal") || !sameOrigin(request))
    return Response.json({ error: "Permintaan tidak diizinkan." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 100000) throw Error("Data terlalu besar.");
    const body = JSON.parse(raw),
      from = parseCivilDate(body.from),
      to = parseCivilDate(body.to);
    if (to < from || to.getTime() - from.getTime() > 30 * 86400000)
      throw Error("Periode maksimal 31 hari.");
    if (!Array.isArray(body.notes) || !body.notes.length || body.notes.length > 100)
      throw Error("Pilih catatan area yang akan disimpan.");
    const notes = body.notes.map((n: { areaId: string; note: string; version: string | null }) => {
      if (
        typeof n.areaId !== "string" ||
        typeof n.note !== "string" ||
        n.note.length > 500 ||
        (n.version !== null && typeof n.version !== "string")
      )
        throw Error("Catatan area tidak valid.");
      return { areaId: n.areaId, note: n.note.trim(), version: n.version };
    });
    if (new Set(notes.map((n: { areaId: string }) => n.areaId)).size !== notes.length)
      throw Error("Area tidak boleh berulang.");
    const saved = await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"schedule-area-notes"}))`;
        const result = [];
        for (const n of notes) {
          if (!(await tx.area.findUnique({ where: { id: n.areaId }, select: { id: true } })))
            throw Error("Area tidak ditemukan.");
          const key = { areaId: n.areaId, startDate: from, endDate: to },
            old = await tx.scheduleAreaNote.findUnique({
              where: { areaId_startDate_endDate: key },
            });
          if ((old?.updatedAt.toISOString() || null) !== n.version)
            throw Error(
              "Catatan berubah oleh pengguna lain. Tampilkan jadwal kembali sebelum menyimpan.",
            );
          const row = old
            ? await tx.scheduleAreaNote.update({
                where: { id: old.id },
                data: { note: n.note, updatedById: user.id },
              })
            : await tx.scheduleAreaNote.create({
                data: { ...key, note: n.note, updatedById: user.id },
              });
          result.push({ areaId: row.areaId, note: row.note, version: row.updatedAt.toISOString() });
        }
        return result;
      },
      { timeout: 20000 },
    );
    return Response.json({ notes: saved });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && !("code" in e)
            ? e.message
            : "Catatan belum tersimpan. Coba kembali.",
      },
      { status: 400 },
    );
  }
}
