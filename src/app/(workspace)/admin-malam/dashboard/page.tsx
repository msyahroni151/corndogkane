import Link from "next/link";
import { readOutletSchedulePeriods } from "@/lib/outlet-schedule-data";
import { requireAccess } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate } from "@/lib/placements";
import { buildOutletDashboard } from "@/lib/outlet-dashboard";
import { OutletIncomeDashboard } from "@/components/outlet-income-dashboard";
export default async function NightOperationsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; area?: string }>;
}) {
  const user = await requireAccess("admin-malam-dashboard"),
    query = await searchParams;
  const today = todayWib();
  const from = typeof query.from === "string" ? query.from : today,
    to = typeof query.to === "string" ? query.to : today,
    area = typeof query.area === "string" ? query.area : "";
  let error = "",
    start = new Date(today + "T00:00:00Z"),
    end = start;
  try {
    start = parseCivilDate(from);
    end = parseCivilDate(to);
    if (end < start || end.getTime() - start.getTime() > 365 * 86400000) throw Error();
  } catch {
    error = "Pilih rentang tanggal yang valid, maksimal 366 hari.";
  }
  const db = getPrisma();
  const areas = await db.area.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (area && !areas.some((a) => a.id === area))
    error = "Area tidak ditemukan. Pilih area yang terdaftar.";
  const outlets = error
    ? []
    : await db.outlet.findMany({
        where: {
          ...(area ? { areaId: area } : {}),
          OR: [
            { active: true, closed: false },
            { operations: { some: { date: { gte: start, lte: end } } } },
          ],
        },
        select: { id: true, name: true, closed: true, area: { select: { name: true } } },
        orderBy: { name: "asc" },
      });
  const entries = error
    ? []
    : await db.outletOperation.findMany({
        where: { date: { gte: start, lte: end }, outletId: { in: outlets.map((o) => o.id) } },
        select: {
          outletId: true,
          date: true,
          totalGross: true,
          bonusAmount: true,
          expenseAmount: true,
          qris: true,
          gofood: true,
          grabfood: true,
          shopeefood: true,
          cashReceived: true,
          doughUsed: true,
          crewName: true,
          trainingCrewName: true,
          crew: { select: { employeeCode: true } },
        },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      });
  const schedules = error
    ? {}
    : await readOutletSchedulePeriods(
        outlets.map((o) => o.id),
        from,
        to,
      );
  const rows = buildOutletDashboard(
    outlets.map((o) => ({
      id: o.id,
      name: o.name,
      closed: o.closed,
      areaName: o.area.name,
      schedule: schedules[o.id],
    })),
    entries.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
      crewCode: e.crew.employeeCode,
    })),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Ringkasan pendapatan dan crew dari rekap operasional outlet.
        </p>
        {hasPermission(user, "monitoring-outlet") && (
          <Link className="button-secondary" href="/admin-malam/monitoring-outlet">
            Monitoring Outlet →
          </Link>
        )}
      </div>
      <OutletIncomeDashboard
        rows={rows}
        from={from}
        to={to}
        area={area}
        areas={areas}
        error={error}
      />
    </div>
  );
}
