import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import { snapshotItems } from "@/lib/outlet-operations";
import type { OutletRecapRow } from "@/lib/outlet-recap";
export async function GET(request: Request) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  const user = await currentUser();
  if (!user) return json({ error: "Silakan masuk kembali." }, 401);
  if (!hasPermission(user, "monitoring-outlet")) return json({ error: "Akses ditolak." }, 403);
  const params = new URL(request.url).searchParams,
    start = params.get("start") || "",
    end = params.get("end") || "";
  let from: Date, to: Date;
  try {
    from = parseCivilDate(start);
    to = parseCivilDate(end);
    if (to < from || to.getTime() - from.getTime() > 365 * 86400000) throw Error();
  } catch {
    return json({ error: "Pilih rentang tanggal yang valid, maksimal 366 hari." }, 400);
  }
  const entries = await getPrisma().outletOperation.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: [{ date: "desc" }, { outletName: "asc" }, { id: "asc" }],
    take: 10001,
    select: {
      id: true,
      date: true,
      outletId: true,
      outletName: true,
      crewId: true,
      crewName: true,
      trainingCrewName: true,
      doughUsed: true,
      expenseAmount: true,
      expenseNotes: true,
      cashReceived: true,
      bonusAmount: true,
      bonusDailyRate: true,
      items: true,
      totalGross: true,
      qris: true,
      gofood: true,
      grabfood: true,
      shopeefood: true,
      outlet: {
        select: {
          nameCode: true,
          dailyRate: true,
          name: true,
          areaId: true,
          area: { select: { name: true } },
        },
      },
      crew: { select: { employeeCode: true } },
    },
  });
  if (entries.length > 10000)
    return json(
      { error: "Rekap melebihi 10.000 baris. Pilih rentang tanggal yang lebih pendek." },
      400,
    );
  const rows: OutletRecapRow[] = entries.map((entry) => {
    const date = entry.date.toISOString().slice(0, 10),
      items = snapshotItems(entry.items);
    return {
      id: entry.id,
      reference: `RKP-${date.replaceAll("-", "")}-${entry.outletId}`,
      date,
      outletId: entry.outletId,
      outletName: entry.outletName,
      outletCode: entry.outlet.nameCode,
      areaId: entry.outlet.areaId,
      areaName: entry.outlet.area.name,
      crewId: entry.crewId,
      crewCode: entry.crew.employeeCode,
      crewName: entry.crewName,
      trainingCrewName: entry.trainingCrewName,
      doughUsed: entry.doughUsed,
      expenseAmount: entry.expenseAmount,
      expenseNotes: entry.expenseNotes,
      cashReceived: entry.cashReceived,
      bonusAmount:
        entry.bonusAmount ??
        outletBonus(
          entry.totalGross,
          entry.bonusDailyRate ??
            outletBonusRate(entry.outlet.name, date, entry.outlet.dailyRate, entry.totalGross),
        ),
      quantities: Object.fromEntries(
        Object.entries(items).map(([key, item]) => [key, item.quantity]),
      ),
      totalGross: entry.totalGross,
      qris: entry.qris,
      gofood: entry.gofood,
      grabfood: entry.grabfood,
      shopeefood: entry.shopeefood,
    };
  });
  return json({ start, end, rows });
}
