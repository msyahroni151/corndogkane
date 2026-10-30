import type { OutletSchedulePeriod } from "@/lib/outlet-schedule-status";
import { readOutletSchedulePeriods } from "@/lib/outlet-schedule-data";
import { requireAccess } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate } from "@/lib/placements";
import { buildOutletDashboard } from "@/lib/outlet-dashboard";
import { previousDashboardPeriod, monthlyHistory } from "@/lib/business-dashboard";
import { loadBusinessSnapshot, type BusinessSnapshot } from "@/lib/business-dashboard-data";
import { BusinessDashboard } from "@/components/business-dashboard";
export default async function NightOperationsDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    area?: string;
    outlet?: string;
    compare?: string;
    period?: string;
  }>;
}) {
  const user = await requireAccess("admin-malam-dashboard"),
    query = await searchParams,
    today = todayWib(),
    from = typeof query.from === "string" && query.from ? query.from : today.slice(0, 8) + "01",
    to = typeof query.to === "string" && query.to ? query.to : today,
    area = typeof query.area === "string" ? query.area : "",
    outlet = typeof query.outlet === "string" ? query.outlet : "",
    compare = query.compare === "year" ? "year" : "previous",
    period = ["today", "week", "month", "year"].includes(query.period || "")
      ? query.period!
      : !query.from
        ? "month"
        : "";
  let error = "",
    previous = { from: today, to: today },
    historyFrom = today;
  try {
    const start = parseCivilDate(from),
      end = parseCivilDate(to);
    if (end < start || end.getTime() - start.getTime() > 365 * 86400000 || to > today)
      throw Error();
    previous = previousDashboardPeriod(from, to, compare, period);
    historyFrom = monthlyHistory([], to).from;
  } catch {
    error = "Pilih rentang tanggal yang valid, maksimal 366 hari dan tidak melewati hari ini.";
  }
  const db = getPrisma();
  const [areas, allOutlets] = await Promise.all([
    db.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.outlet.findMany({
      select: {
        id: true,
        name: true,
        areaId: true,
        closed: true,
        active: true,
        address: true,
        latitude: true,
        longitude: true,
        area: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  if (area && !areas.some((a) => a.id === area))
    error = "Area tidak ditemukan. Pilih area yang terdaftar.";
  if (outlet && !allOutlets.some((o) => o.id === outlet && (!area || o.areaId === area)))
    error = "Outlet tidak ditemukan atau tidak sesuai area. Pilih ulang outlet / area.";
  const filtered = allOutlets.filter(
      (o) => (!area || o.areaId === area) && (!outlet || o.id === outlet),
    ),
    ids = filtered.map((o) => o.id),
    earliest = [from, previous.from, historyFrom].sort()[0];
  const records = error
    ? []
    : await db.outletOperation.findMany({
        where: {
          date: { gte: parseCivilDate(earliest), lte: parseCivilDate(to) },
          outletId: { in: ids },
        },
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
  const allEntries = records.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
      crewCode: e.crew.employeeCode,
    })),
    entries = allEntries.filter((e) => e.date >= from && e.date <= to),
    previousEntries = allEntries.filter((e) => e.date >= previous.from && e.date <= previous.to),
    visible = filtered.filter(
      (o) =>
        (o.active && !o.closed) ||
        entries.some((e) => e.outletId === o.id) ||
        previousEntries.some((e) => e.outletId === o.id),
    );
  const [schedules, snapshot] = error
    ? [
        {} as Record<string, OutletSchedulePeriod>,
        { modules: [], alerts: [], losses: {}, canSeeLoss: false } as BusinessSnapshot,
      ]
    : await Promise.all([
        readOutletSchedulePeriods(
          visible.map((o) => o.id),
          from,
          to,
        ),
        loadBusinessSnapshot(db, user.permissions, from, to, ids),
      ]);
  const rows = buildOutletDashboard(
    visible.map((o) => ({
      id: o.id,
      name: o.name,
      closed: o.closed,
      areaName: o.area.name,
      schedule: schedules[o.id],
    })),
    entries,
  );
  return (
    <BusinessDashboard
      userName={user.name}
      locations={filtered.map((o) => {
        const row = rows.find((r) => r.id === o.id);
        return {
          id: o.id,
          name: o.name,
          areaName: o.area.name,
          latitude: o.latitude,
          longitude: o.longitude,
          address: o.address,
          active: o.active,
          closed: o.closed,
          gross: row?.records ? row.gross : null,
          crew: row?.crew || row?.schedule?.crewNames.join(", ") || "",
        };
      })}
      canEditLocations={hasPermission(user, "master-outlet")}
      rows={rows}
      entries={entries}
      previousEntries={previousEntries}
      history={allEntries.filter((e) => e.date >= historyFrom)}
      from={from}
      to={to}
      previousFrom={previous.from}
      previousTo={previous.to}
      area={area}
      outlet={outlet}
      areas={areas}
      outlets={allOutlets.map((o) => ({ id: o.id, name: o.name, areaId: o.areaId }))}
      compare={compare}
      period={period}
      today={today}
      snapshot={snapshot}
      error={error}
      canFinance={hasPermission(user, "master-akun")}
      updated={new Date().toISOString()}
    />
  );
}
