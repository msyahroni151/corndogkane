import "server-only";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import { outletSchedulePeriods } from "@/lib/outlet-schedule-status";
export async function readOutletSchedulePeriods(ids: string[], from: string, to: string) {
  const rows = ids.length
    ? await getPrisma().schedule.findMany({
        where: {
          outletId: { in: ids },
          date: { gte: parseCivilDate(from), lte: parseCivilDate(to) },
          status: "KERJA",
          role: { not: "CREW_GUDANG" },
        },
        select: {
          outletId: true,
          date: true,
          status: true,
          role: true,
          employeeName: true,
          employee: { select: { employeeCode: true } },
        },
        orderBy: [{ date: "asc" }, { employeeName: "asc" }],
      })
    : [];
  return outletSchedulePeriods(
    ids,
    from,
    to,
    rows.map((r) => ({
      outletId: r.outletId,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      role: r.role,
      crewName: r.employee.employeeCode?.trim() || r.employeeName,
    })),
  );
}
