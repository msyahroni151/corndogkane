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
  const rows = await getPrisma().outletOperation.findMany({
    where: {
      date: { gte: parseCivilDate(start), lte: parseCivilDate(end) },
      outlet: { active: true, closed: false },
    },
    include: { _count: { select: { sales: true } }, crew: { select: { employeeCode: true } } },
  });
  const crews = await getPrisma().saleTransaction.groupBy({
    by: ["operationId", "crewName"],
    where: {
      date: { gte: parseCivilDate(start), lte: parseCivilDate(end) },
      outletId: { in: local.map((o) => o.id) },
    },
  });
  const values: Record<string, OutletSales> = {};
  const reconciliations = rows.map((row) => {
    const value = (values[row.outletId] ||= {
      source: "manual",
      countKnown: true,
      cashKnown: true,
      total: 0,
      count: 0,
      cash: 0,
      qris: 0,
      online: 0,
      expense: 0,
      crewNames: [],
      days: 0,
      stockPending: 0,
    });
    const source = row.salesPending
      ? "review"
      : row.salesSource === "POS"
        ? "pos"
        : row.salesSource === "POS_MANUAL_ADD"
          ? "mixed"
          : "manual";
    value.source =
      value.source === "review" || source === "review"
        ? "review"
        : value.days
          ? value.source === source
            ? source
            : "mixed"
          : source;
    value.total += row.totalGross;
    value.qris += row.qris;
    value.online += row.gofood + row.grabfood + row.shopeefood;
    value.cash += operationalCash(row);
    value.expense = (value.expense || 0) + (row.expenseAmount ?? 0);
    value.count += row._count.sales;
    value.countKnown =
      value.countKnown &&
      ["POS", "POS_MANUAL_ADD", "MANUAL_ADD"].includes(row.salesSource) &&
      !row.salesPending;
    value.days = (value.days || 0) + 1;
    value.stockPending = (value.stockPending || 0) + row.stockPending;
    value.crewNames = [
      ...new Set(
        [
          ...(value.crewNames || []),
          row.crew.employeeCode || row.crewName,
          ...crews.filter((s) => s.operationId === row.id).map((s) => s.crewName),
          row.trainingCrewName || "",
        ].filter(Boolean),
      ),
    ];
    const manual =
      row.manualSales && typeof row.manualSales === "object" && !Array.isArray(row.manualSales)
        ? Number((row.manualSales as { totalGross?: number }).totalGross)
        : row.hasManual
          ? row.totalGross
          : null;
    return {
      id: row.id,
      outletId: row.outletId,
      outletName: row.outletName,
      date: row.date.toISOString().slice(0, 10),
      version: row.updatedAt.toISOString(),
      pos: row.posGross,
      additional: row.additionalGross,
      manual: Number.isFinite(manual) ? manual : null,
      current: row.totalGross,
      pending: row.salesPending,
      stockPending: row.stockPending,
    };
  });
  return json({
    status: "connected",
    start,
    end,
    outlets: values,
    schedules,
    reconciliations,
    fetchedAt: new Date().toISOString(),
  });
}
