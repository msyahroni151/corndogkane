import { getPrisma } from "@/lib/db";
import { employeeGroup, parseCivilDate } from "@/lib/placements";
import { WarehouseCalendar } from "@/components/warehouse-calendar";
export async function WarehouseCalendarData({ month, employee, route }: { month: string; employee?: string; route: string }) {
  const from = parseCivilDate(month + "-01"), to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)), db = getPrisma();
  const [crew, rows, placements] = await Promise.all([
    db.employee.findMany({ where: { active: true, ...(employee ? { id: employee } : {}) }, orderBy: { employeeCode: "asc" } }),
    db.schedule.findMany({ where: { role: { in: ["CREW_GUDANG", "LEADER_SHIFT"] }, date: { gte: from, lte: to }, ...(employee ? { employeeId: employee } : {}) }, include: { employee: { select: { employeeCode: true } }, attendance: { select: { id: true } } }, orderBy: [{ date: "asc" }, { employeeName: "asc" }] }),
    db.placement.findMany({ where: { role: { in: ["CREW_GUDANG", "LEADER_SHIFT"] }, startDate: { lte: to }, endDate: { gte: from } }, select: { employeeId: true, startDate: true, endDate: true, location: true } }),
  ]);
  return <WarehouseCalendar key={`${month}:${employee || "all"}`} month={month} route={route} crew={crew.filter(e => employeeGroup(e) === "warehouse").map(e => ({ id: e.id, name: e.employeeCode || e.fullName }))}
    placements={placements.map(p => ({ employeeId: p.employeeId, from: p.startDate.toISOString().slice(0, 10), to: p.endDate.toISOString().slice(0, 10), location: p.location || "GUDANG" }))}
    rows={rows.map(r => ({ id: r.id, employeeId: r.employeeId, name: r.employee.employeeCode || r.employeeName, date: r.date.toISOString().slice(0, 10), status: r.status, shift: r.shift, startMinutes: r.startMinutes, endMinutes: r.endMinutes, role: r.role, version: r.updatedAt.toISOString(), hasAttendance: !!r.attendance, notes: r.notes || "", location: r.location || "GUDANG" }))} />;
}
