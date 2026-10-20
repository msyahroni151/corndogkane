import { revalidatePath } from "next/cache";
import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";
import { syncOutletBonus, BonusSyncError } from "@/lib/outlet-bonus-ledger";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import {
  operationalCash,
  operationalProducts,
  operationalPayments,
  snapshotItems,
  canRecordOutletCrew,
} from "@/lib/outlet-operations";
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
  const items = snapshotItems(entry?.items);
  return json({
    dailyRate: outlet.dailyRate,
    outletName: outlet.name,
    entry: entry
      ? {
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
          qris: entry.qris,
          gofood: entry.gofood,
          grabfood: entry.grabfood,
          shopeefood: entry.shopeefood,
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
class InputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function POST(request: Request) {
  const user = await access();
  if (user instanceof Response) return user;
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || "");
    sameOrigin =
      parsed.origin === origin &&
      parsed.host === request.headers.get("host") &&
      ["http:", "https:"].includes(parsed.protocol);
  } catch {
    /* Missing or invalid origins cannot submit records. */
  }
  if (!sameOrigin) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 20000) throw new InputError("Data terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new InputError("Data tidak valid.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new InputError("Data tidak valid.");
    const str = (key: string) => (typeof body[key] === "string" ? body[key].trim() : "");
    const outletId = str("outletId"),
      crewId = str("crewId"),
      trainingCrewName = str("trainingCrewName") || null;
    if (body.trainingCrewName != null && typeof body.trainingCrewName !== "string")
      throw new InputError("Nama crew training tidak valid.");
    if (trainingCrewName && trainingCrewName.length > 100)
      throw new InputError("Nama crew training maksimal 100 karakter.");
    let date: Date;
    try {
      date = parseCivilDate(str("date"));
    } catch {
      throw new InputError("Tanggal operasional tidak valid.");
    }
    if (!outletId || !crewId) throw new InputError("Pilih outlet dan nama crew.");
    const integer = (value: unknown, max: number) => {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max)
        throw new InputError("Jumlah harus bilangan bulat positif atau nol, sesuai batas input.");
      return value;
    };
    const doughUsed = body.doughUsed == null ? null : integer(body.doughUsed, 10000);
    const cashReceived = body.cashReceived == null ? null : integer(body.cashReceived, 1000000000);
    const expenseAmount =
      body.expenseAmount == null ? null : integer(body.expenseAmount, 1000000000);
    if (body.expenseNotes != null && typeof body.expenseNotes !== "string")
      throw new InputError("Keterangan pengeluaran tidak valid.");
    const expenseNotes = str("expenseNotes") || null;
    if (expenseNotes && expenseNotes.length > 1000)
      throw new InputError("Keterangan pengeluaran maksimal 1.000 karakter.");
    const quantities = Object.fromEntries(
      operationalProducts.map((p) => [p.key, integer(body.quantities?.[p.key] ?? 0, 10000)]),
    );
    const payments = Object.fromEntries(
      operationalPayments.map((p) => [p.key, integer(body[p.key] ?? 0, 1000000000)]),
    );
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${outletId + "|" + str("date")}, 0))`;
      const existing = await tx.outletOperation.findUnique({
        where: { outletId_date: { outletId, date } },
      });
      if ((existing?.updatedAt.toISOString() || null) !== (body.version ?? null))
        throw new InputError(
          "Rekap sudah berubah. Tutup lalu buka kembali agar data terbaru terbaca.",
          409,
        );
      await tx.$executeRaw`SELECT id FROM outlets WHERE id=${outletId} FOR SHARE`;
      const outlet = await tx.outlet.findUnique({ where: { id: outletId } });
      if (!outlet || !outlet.active || outlet.closed)
        throw new InputError("Outlet tidak aktif atau tidak ditemukan.");
      const crew = await tx.employee.findUnique({ where: { id: crewId } });
      if (!crew || (!crew.active && crew.id !== existing?.crewId))
        throw new InputError("Pilih crew aktif yang terdaftar.");
      if (!canRecordOutletCrew(crew) && crew.id !== existing?.crewId)
        throw new InputError(
          "Pilih CREW OUTLET, CREW BACKUP, atau AREA SUPERVISOR yang aktif dan memiliki kode nama.",
        );
      const old = snapshotItems(existing?.items);
      const items = Object.fromEntries(
        operationalProducts.map((p) => [
          p.key,
          { quantity: quantities[p.key], unitPrice: existing ? old[p.key].unitPrice : p.price },
        ]),
      );
      const totalGross = Object.values(items).reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      if (!Number.isSafeInteger(totalGross) || totalGross > 2000000000)
        throw new InputError("Total rekap melebihi batas nominal.");
      const bonusDailyRate = outletBonusRate(
        outlet.name,
        str("date"),
        existing?.bonusDailyRate ?? outlet.dailyRate,
        totalGross,
      );
      // Editing a deposit on an old report must not implicitly post historical bonus.
      const legacyFinancialsUnchanged =
        existing &&
        existing.bonusAmount == null &&
        existing.totalGross === totalGross &&
        existing.crewId === crewId;
      const bonusAmount = legacyFinancialsUnchanged
        ? null
        : outletBonus(totalGross, bonusDailyRate);
      const data = {
        bonusAmount,
        bonusDailyRate,
        doughUsed: Object.hasOwn(body, "doughUsed") ? doughUsed : (existing?.doughUsed ?? null),
        outletId,
        outletName: outlet.name,
        date,
        crewId,
        crewName: crew.fullName,
        trainingCrewId: null,
        trainingCrewName,
        expenseAmount: Object.hasOwn(body, "expenseAmount")
          ? expenseAmount
          : (existing?.expenseAmount ?? null),
        expenseNotes: Object.hasOwn(body, "expenseNotes")
          ? expenseNotes
          : (existing?.expenseNotes ?? null),
        cashReceived: Object.hasOwn(body, "cashReceived")
          ? cashReceived
          : (existing?.cashReceived ?? null),
        items,
        totalGross,
        qris: payments.qris,
        gofood: payments.gofood,
        grabfood: payments.grabfood,
        shopeefood: payments.shopeefood,
        updatedById: user.id,
      };
      if (existing) {
        const approved = await tx.settlementReview.findFirst({
          where: { operationId: existing.id, status: "APPROVED" },
        });
        if (
          approved &&
          (approved.employeeId !== crewId ||
            approved.expectedCash !== operationalCash(data) ||
            approved.receivedCash !== data.cashReceived)
        )
          throw new InputError(
            "Selisih setoran sudah disetujui. CASH, REAL, dan crew pada rekap ini tidak dapat diubah.",
            409,
          );
      }
      const saved = existing
        ? await tx.outletOperation.update({ where: { id: existing.id }, data })
        : await tx.outletOperation.create({ data: { ...data, createdById: user.id } });
      await syncOutletBonus(tx, saved, user.id);
    });
    for (const path of ["/bonus", "/payroll", "/rekap-saldo", "/selisih-setor"])
      revalidatePath(path);
    return json({ success: "Rekap operasional berhasil disimpan." });
  } catch (error) {
    if (error instanceof BonusSyncError) return json({ error: error.message }, 409);
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    return json({ error: "Rekap belum tersimpan. Periksa koneksi dan coba kembali." }, 500);
  }
}
