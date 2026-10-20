import { hasPermission } from "@/lib/permissions";
import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { employeeGroup, parseCivilDate } from "@/lib/placements";
import type { WarehouseScheduleData } from "@/lib/warehouse-schedule-image";
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
  const [employees, rows] = await Promise.all([
    db.employee.findMany({
      where: { active: true },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        department: true,
        position: true,
        active: true,
      },
    }),
    db.schedule.findMany({
      where: { date: { gte: from, lte: to }, role: { in: ["CREW_GUDANG", "LEADER_SHIFT"] } },
      orderBy: [{ date: "asc" }, { employeeName: "asc" }],
      select: {
        employeeId: true,
        employeeName: true,
        date: true,
        status: true,
        shift: true,
        startMinutes: true,
        endMinutes: true,
        employee: { select: { employeeCode: true, fullName: true } },
      },
    }),
  ]);
  const crew = new Map(
    employees
      .filter((e) => employeeGroup(e) === "warehouse")
      .map((e) => [e.id, { id: e.id, name: e.employeeCode?.trim() || e.fullName }]),
  );
  for (const row of rows)
    if (!crew.has(row.employeeId))
      crew.set(row.employeeId, {
        id: row.employeeId,
        name: row.employee.employeeCode?.trim() || row.employeeName || row.employee.fullName,
      });
  const data: WarehouseScheduleData = {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    employees: [...crew.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "id-ID", { numeric: true }),
    ),
    rows: rows.map((r) => ({
      employeeId: r.employeeId,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      shift: r.shift,
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
    })),
  };
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
