import { hasPermission } from "@/lib/permissions";
import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import type { ShareScheduleData } from "@/lib/share-schedule";
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return Response.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  if (!hasPermission(user, "jadwal")) return Response.json({ error: "Anda tidak memiliki akses jadwal." }, { status: 403 });
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
  const [areas, outlets, rows] = await Promise.all([
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
