import { readOutletSchedulePeriods } from "@/lib/outlet-schedule-data";
import { operationalCash } from "@/lib/outlet-operations";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import { matchOutletSales, type OutletSales, type MonitoringSales } from "@/lib/outlet-sales";
export async function GET(request: Request) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  const user = await currentUser();
  if (!user) return json({ error: "Silakan masuk kembali." }, 401);
  if (!hasPermission(user, "monitoring-outlet")) return json({ error: "Akses ditolak." }, 403);
  const params = new URL(request.url).searchParams;
  const start = params.get("start") || "",
    end = params.get("end") || "";
  try {
    const from = parseCivilDate(start),
      to = parseCivilDate(end);
    if (to < from || to.getTime() - from.getTime() > 365 * 86400000) throw Error();
  } catch {
    return json({ error: "Pilih rentang tanggal yang valid, maksimal 366 hari." }, 400);
  }
  const local = await getPrisma().outlet.findMany({
    where: { active: true, closed: false },
    select: { id: true, name: true },
  });
  const schedules = await readOutletSchedulePeriods(
    local.map((o) => o.id),
    start,
    end,
  );
  const manualRows = await getPrisma().outletOperation.findMany({
    where: {
      date: { gte: parseCivilDate(start), lte: parseCivilDate(end) },
      outlet: { active: true, closed: false },
    },
    select: {
      outletId: true,
      totalGross: true,
      expenseAmount: true,
      qris: true,
      gofood: true,
      grabfood: true,
      shopeefood: true,
      crewName: true,
      crew: { select: { fullName: true, employeeCode: true } },
      trainingCrewName: true,
    },
  });
  const manual: Record<string, OutletSales> = {};
  const expenses: Record<string, number> = {};
  for (const row of manualRows) {
    const value = (manual[row.outletId] ||= {
      total: 0,
      count: 0,
      cash: 0,
      qris: 0,
      online: 0,
      expense: 0,
      source: "manual",
      countKnown: false,
      cashKnown: true,
      days: 0,
      crewNames: [],
    });
    value.total += row.totalGross;
    value.qris += row.qris;
    value.online += row.gofood + row.grabfood + row.shopeefood;
    value.cash += operationalCash(row);
    value.expense = (value.expense || 0) + (row.expenseAmount ?? 0);
    expenses[row.outletId] = (expenses[row.outletId] || 0) + (row.expenseAmount ?? 0);
    value.days = (value.days || 0) + 1;
    const crewName = [row.crew.fullName.trim() || row.crewName, row.crew.employeeCode?.trim()]
      .filter(Boolean)
      .join(" - ");
    value.crewNames = [
      ...new Set(
        [...(value.crewNames || []), crewName, row.trainingCrewName].filter(
          (name): name is string => !!name,
        ),
      ),
    ];
  }
  const empty: MonitoringSales = { status: "unconfigured", start, end, outlets: manual, schedules };
  const endpoint = process.env.POS_MONITORING_URL,
    key = process.env.POS_MONITORING_KEY;
  if (!endpoint || !key || key.length < 32) return json(empty);
  try {
    const url = new URL(endpoint);
    if (
      url.origin !== "https://script.google.com" ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)
    )
      throw Error();
    url.searchParams.set("action", "monitoring-sales");
    url.searchParams.set("key", key);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw Error();
    const text = await response.text();
    if (text.length > 2000000) throw Error();
    const data = JSON.parse(text);
    if (
      data.ok !== true ||
      data.start !== start ||
      data.end !== end ||
      !Array.isArray(data.outlets) ||
      data.outlets.length > 10000
    )
      throw Error();
    const source: { name: string; sales: OutletSales }[] = data.outlets.map(
      (entry: { name: unknown; sales: OutletSales }) => {
        if (
          typeof entry.name !== "string" ||
          !entry.sales ||
          !["total", "count", "cash", "qris", "online"].every(
            (field) =>
              Number.isSafeInteger(
                entry.sales[field as "total" | "count" | "cash" | "qris" | "online"],
              ) && entry.sales[field as "total" | "count" | "cash" | "qris" | "online"] >= 0,
          )
        )
          throw Error();
        return {
          name: entry.name,
          sales: {
            total: entry.sales.total,
            count: entry.sales.count,
            cash: entry.sales.cash,
            qris: entry.sales.qris,
            online: entry.sales.online,
          },
        };
      },
    );
    const posValues = matchOutletSales(source, local);
    for (const [id, value] of Object.entries(posValues)) {
      value.expense = expenses[id] || 0;
      value.cash = value.total - value.qris - value.online - value.expense;
      if (manual[id]?.crewNames) value.crewNames = manual[id].crewNames;
    }
    return json({
      status: "connected",
      schedules,
      start,
      end,
      outlets: { ...manual, ...posValues },
      fetchedAt: new Date().toISOString(),
    } satisfies MonitoringSales);
  } catch {
    return json({ ...empty, status: "error" } satisfies MonitoringSales);
  }
}
