import { hasAction } from "@/lib/permission-actions";
import { sameOrigin } from "@/lib/request-origin";
import { boundedJsonText, RequestBodyError } from "@/lib/request-body";
import { InputError, saveOutletOperation, saveOutletClosure } from "@/lib/outlet-operation-write";
import { salesAmounts } from "@/lib/daily-sales";
import { SaleError } from "@/lib/sale-input";
import { revalidatePath } from "next/cache";
import { BonusSyncError } from "@/lib/outlet-bonus-ledger";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import { snapshotItems, canRecordOutletCrew } from "@/lib/outlet-operations";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function access() {
  const user = await currentUser();
  if (!user) return json({ error: "Silakan masuk kembali." }, 401);
  if (!hasPermission(user, "monitoring-outlet")) return json({ error: "Akses ditolak." }, 403);
  return user;
}
export async function GET(request: Request) {
  const user = await access();
  if (user instanceof Response) return user;
  const query = new URL(request.url).searchParams,
    outletId = query.get("outletId") || "";
  let date: Date;
  try {
    date = parseCivilDate(query.get("date") || "");
  } catch {
    return json({ error: "Tanggal operasional tidak valid." }, 400);
  }
  const db = getPrisma(),
    outlet = await db.outlet.findUnique({
      where: { id: outletId },
      select: { active: true, closed: true, dailyRate: true, name: true },
    });
  if (!outlet || !outlet.active || outlet.closed)
    return json({ error: "Outlet tidak aktif atau tidak ditemukan." }, 404);
  const entry = await db.outletOperation.findUnique({
    where: { outletId_date: { outletId, date } },
  });
  const selected = [entry?.crewId].filter((id): id is string => !!id);
  const employees = await db.employee.findMany({
    where: { OR: [{ active: true }, { id: { in: selected } }] },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      active: true,
      position: true,
      department: true,
    },
  });
  const manual = entry?.hasManual ? salesAmounts(entry.manualSales) : null;
  const items = snapshotItems(
    entry?.manualSales && typeof entry.manualSales === "object" && !Array.isArray(entry.manualSales)
      ? (entry.manualSales as { items?: unknown }).items || entry.items
      : entry?.items,
  );
  const ledger = entry
    ? await db.saleTransaction.findMany({
        where: { operationId: entry.id },
        select: { total: true, method: true },
      })
    : [];
  const live = {
    totalGross: ledger.reduce((n, r) => n + r.total, 0),
    qris: 0,
    gofood: 0,
    grabfood: 0,
    shopeefood: 0,
  };
  for (const row of ledger) {
    const key = (
      {
        QRIS: "qris",
        GoFood: "gofood",
        "Grab Food": "grabfood",
        "Shopee Food": "shopeefood",
      } as const
    )[row.method as "QRIS" | "GoFood" | "Grab Food" | "Shopee Food"];
    if (key) live[key] += row.total;
  }

  const dailyStatus = await db.outletDailyStatus.findUnique({
    where: { outletId_date: { outletId, date } },
  });
  return json({
    dailyStatus: dailyStatus
      ? {
          closed: dailyStatus.closed,
          notes: dailyStatus.notes,
          version: dailyStatus.updatedAt.toISOString(),
        }
      : null,
    liveSales: ledger.length ? live : null,
    dailyRate: outlet.dailyRate,
    outletName: outlet.name,
    entry: entry
      ? {
          hasManual: entry.hasManual,
          salesSource: entry.salesSource,
          version: entry.updatedAt.toISOString(),
          crewId: entry.crewId,
          crewLabel:
            employees.find((employee) => employee.id === entry.crewId)?.employeeCode?.trim() ||
            entry.crewName,
          trainingCrewName: entry.trainingCrewName,
          doughUsed: entry.doughUsed,
          expenseAmount: entry.expenseAmount,
          expenseNotes: entry.expenseNotes,
          cashReceived: entry.cashReceived,
          bonusDailyRate: entry.bonusDailyRate,
          quantities: Object.fromEntries(
            Object.entries(items).map(([key, item]) => [key, item.quantity]),
          ),
          unitPrices: Object.fromEntries(
            Object.entries(items).map(([key, item]) => [key, item.unitPrice]),
          ),
          qris: manual?.qris ?? entry.qris,
          gofood: manual?.gofood ?? entry.gofood,
          grabfood: manual?.grabfood ?? entry.grabfood,
          shopeefood: manual?.shopeefood ?? entry.shopeefood,
        }
      : null,
    employees: employees
      .filter(canRecordOutletCrew)
      .map((employee) => ({
        id: employee.id,
        name: employee.employeeCode?.trim() || "Kode belum diisi",
        active: employee.active,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id-ID", { numeric: true })),
  });
}
export async function POST(request: Request) {
  const user = await access();
  if (user instanceof Response) return user;
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  if (!hasAction(user, "monitoring-outlet", "create"))
    return Response.json({ error: "Izin aksi ditolak." }, { status: 403 });
  try {
    const raw = await boundedJsonText(request, 20000);
    if (raw.length > 20000) throw new InputError("Data terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new InputError("Data tidak valid.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new InputError("Data tidak valid.");
    if (body.action === "daily-status") {
      if (!hasAction(user, "monitoring-outlet", "edit"))
        return json({ error: "Izin edit status outlet diperlukan." }, 403);
      await saveOutletClosure(body, user.id);
    } else
      await saveOutletOperation(body, user.id, undefined, {
        createOnly: !hasAction(user, "monitoring-outlet", "edit"),
      });
    for (const path of [
      "/bonus",
      "/payroll",
      "/rekap-saldo",
      "/selisih-setor",
      "/menu-utama/dashboard",
      "/admin-malam/monitoring-outlet",
      "/finance/laporan-akuntansi",
    ])
      revalidatePath(path);
    return json({ success: "Rekap operasional berhasil disimpan." });
  } catch (error) {
    if (error instanceof RequestBodyError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SaleError) return json({ error: error.message }, 409);
    if (error instanceof BonusSyncError) return json({ error: error.message }, 409);
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    return json({ error: "Rekap belum tersimpan. Periksa koneksi dan coba kembali." }, 500);
  }
}
