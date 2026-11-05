import { refreshDailySales, salesAmounts } from "@/lib/daily-sales";
import { Prisma } from "@/generated/prisma/client";
import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";
import { syncOutletBonus } from "@/lib/outlet-bonus-ledger";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import {
  operationalCash,
  operationalProducts,
  operationalPayments,
  snapshotItems,
  canRecordOutletCrew,
  canImportOutletCrew,
} from "@/lib/outlet-operations";
export class InputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
/** Shared writer for the manual form and validated CSV imports. */
export async function saveOutletOperation(
  body: Record<string, unknown>,
  userId: string,
  transaction?: Prisma.TransactionClient,
  options: {
    createOnly?: boolean;
    allowInactiveCrew?: boolean;
    historicalCrewIds?: ReadonlySet<string>;
    historicalOutletIds?: ReadonlySet<string>;
    initialBonusId?: string;
  } = {},
) {
  const createOnly = options.createOnly === true;
  // This exception is supplied by the CSV service, never from request body fields.
  const allowInactiveCrew = createOnly && options.allowInactiveCrew === true;
  const str = (key: string) => (typeof body[key] === "string" ? body[key].trim() : "");
  const salesMode = body.salesMode === "POS" ? "POS" : "TOTAL";
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
  const expenseAmount = body.expenseAmount == null ? null : integer(body.expenseAmount, 1000000000);
  if (body.expenseNotes != null && typeof body.expenseNotes !== "string")
    throw new InputError("Keterangan pengeluaran tidak valid.");
  const expenseNotes = str("expenseNotes") || null;
  if (expenseNotes && expenseNotes.length > 1000)
    throw new InputError("Keterangan pengeluaran maksimal 1.000 karakter.");
  const quantities = Object.fromEntries(
    operationalProducts.map((p) => [
      p.key,
      integer((body.quantities as Record<string, unknown> | undefined)?.[p.key] ?? 0, 10000),
    ]),
  );
  const payments = Object.fromEntries(
    operationalPayments.map((p) => [p.key, integer(body[p.key] ?? 0, 1000000000)]),
  );
  const write = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${outletId + "|" + str("date")}, 0))`;
    const closure = await tx.outletDailyStatus.findUnique({
      where: { outletId_date: { outletId, date } },
    });
    if (closure?.closed)
      throw new InputError(
        "Outlet tercatat TUTUP pada tanggal ini. Ubah status menjadi Buka di Monitoring Outlet terlebih dahulu.",
        409,
      );
    const existing = await tx.outletOperation.findUnique({
      where: { outletId_date: { outletId, date } },
    });
    if (createOnly && existing)
      throw new InputError("Rekap outlet dan tanggal ini sudah ada.", 409);
    if ((existing?.updatedAt.toISOString() || null) !== (body.version ?? null))
      throw new InputError(
        "Rekap sudah berubah. Tutup lalu buka kembali agar data terbaru terbaca.",
        409,
      );
    await tx.$executeRaw`SELECT id FROM outlets WHERE id=${outletId} FOR SHARE`;
    const outlet = await tx.outlet.findUnique({ where: { id: outletId } });
    const verifiedHistoricalOutlet = createOnly && options.historicalOutletIds?.has(outletId);
    if (!outlet || ((!outlet.active || outlet.closed) && !verifiedHistoricalOutlet))
      throw new InputError("Outlet tidak aktif atau tidak ditemukan.");
    const crew = await tx.employee.findUnique({ where: { id: crewId } });
    if (!crew || (!crew.active && !allowInactiveCrew && crew.id !== existing?.crewId))
      throw new InputError("Pilih crew aktif yang terdaftar.");
    // A trusted historical import may name explicitly verified employees whose current job differs.
    const verifiedHistoricalCrew =
      createOnly && !!crew.employeeCode?.trim() && options.historicalCrewIds?.has(crew.id);
    if (
      !(allowInactiveCrew ? canImportOutletCrew(crew) : canRecordOutletCrew(crew)) &&
      !verifiedHistoricalCrew &&
      crew.id !== existing?.crewId
    )
      throw new InputError(
        "Pilih CREW OUTLET, CREW BACKUP, atau AREA SUPERVISOR yang memiliki kode nama" +
          (allowInactiveCrew ? "." : " dan masih aktif."),
      );
    const old = snapshotItems(existing?.items);
    const items = Object.fromEntries(
      operationalProducts.map((p) => [
        p.key,
        {
          quantity: quantities[p.key],
          unitPrice: existing
            ? old[p.key].unitPrice
            : createOnly && body.unitPrices
              ? integer((body.unitPrices as Record<string, unknown>)[p.key] ?? p.price, 1000000000)
              : p.price,
        },
      ]),
    );
    const totalGross = Object.values(items).reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    if (!Number.isSafeInteger(totalGross) || totalGross > 2000000000)
      throw new InputError("Total rekap melebihi batas nominal.");
    if (
      salesMode === "TOTAL" &&
      payments.qris + payments.gofood + payments.grabfood + payments.shopeefood > totalGross
    )
      throw new InputError("Pembayaran non-tunai melebihi total penjualan manual.");
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
    const bonusAmount = legacyFinancialsUnchanged ? null : outletBonus(totalGross, bonusDailyRate);
    // A create-only import has no existing day or committed sales ledger to reconcile.
    const hasLedger = createOnly
      ? 0
      : await tx.saleTransaction.count({
          where: { operationId: existing?.id || "NONE" },
        });
    if (salesMode === "POS" && !hasLedger)
      throw new InputError("Belum ada transaksi POS atau tambahan manual untuk dipakai.");
    const manualSales = {
      totalGross,
      qris: payments.qris,
      gofood: payments.gofood,
      grabfood: payments.grabfood,
      shopeefood: payments.shopeefood,
      items,
    };
    const previousManual = existing?.hasManual
      ? {
          ...(salesAmounts(existing.manualSales) || salesAmounts(existing)!),
          items: snapshotItems(
            existing.manualSales &&
              typeof existing.manualSales === "object" &&
              !Array.isArray(existing.manualSales)
              ? (existing.manualSales as { items?: unknown }).items || existing.items
              : existing.items,
          ),
        }
      : null;
    const manualChanged = JSON.stringify(previousManual) !== JSON.stringify(manualSales);
    const data = {
      bonusAmount: hasLedger ? (existing?.bonusAmount ?? null) : bonusAmount,
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
      totalGross: hasLedger ? existing!.totalGross : totalGross,
      qris: hasLedger ? existing!.qris : payments.qris,
      gofood: hasLedger ? existing!.gofood : payments.gofood,
      grabfood: hasLedger ? existing!.grabfood : payments.grabfood,
      shopeefood: hasLedger ? existing!.shopeefood : payments.shopeefood,
      ...(salesMode === "TOTAL"
        ? {
            hasManual: true,
            manualSales: manualSales as Prisma.InputJsonValue,
            ...(manualChanged ? { salesRevision: { increment: 1 } } : {}),
          }
        : {}),
      updatedById: userId,
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
    let saved;
    if (existing) saved = await tx.outletOperation.update({ where: { id: existing.id }, data });
    else {
      saved = await tx.outletOperation.create({
        data: { ...data, salesRevision: 1, createdById: userId },
      });
    }
    if (!createOnly)
      saved = await refreshDailySales(
        tx,
        saved.id,
        userId,
        salesMode === "POS"
          ? {
              choice: "POS",
              notes: "Konfirmasi rekap menggunakan transaksi POS / tambahan manual.",
            }
          : undefined,
      );
    if (!saved.salesPending && !legacyFinancialsUnchanged) {
      const rate = outletBonusRate(
        outlet.name,
        str("date"),
        saved.bonusDailyRate ?? outlet.dailyRate,
        saved.totalGross,
      );
      if (!createOnly)
        saved = await tx.outletOperation.update({
          where: { id: saved.id },
          data: { bonusDailyRate: rate, bonusAmount: outletBonus(saved.totalGross, rate) },
        });
      await syncOutletBonus(tx, saved, userId, createOnly ? options.initialBonusId : undefined);
    }
  };
  if (transaction) await write(transaction);
  else await getPrisma().$transaction(write);
}

/** Daily status writes share the sales lock, so a closure cannot race a transaction. */
export async function saveOutletClosure(
  body: Record<string, unknown>,
  userId: string,
  transaction?: Prisma.TransactionClient,
  createOnly = false,
  historicalOutletIds?: ReadonlySet<string>,
) {
  const outletId = typeof body.outletId === "string" ? body.outletId.trim() : "";
  let date: Date;
  try {
    date = parseCivilDate(typeof body.date === "string" ? body.date : "");
  } catch {
    throw new InputError("Tanggal operasional tidak valid.");
  }
  if (!outletId) throw new InputError("Pilih outlet.");
  if (body.operationalStatus !== "TUTUP" && body.operationalStatus !== "BUKA")
    throw new InputError("Status operasional tidak valid.");
  const notes = typeof body.operationalNotes === "string" ? body.operationalNotes.trim() : "";
  if (notes.length > 1000) throw new InputError("Keterangan maksimal 1.000 karakter.");
  const write = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${outletId + "|" + date.toISOString().slice(0, 10)},0))`;
    await tx.$executeRaw`SELECT id FROM outlets WHERE id=${outletId} FOR SHARE`;
    const outlet = await tx.outlet.findUnique({
      where: { id: outletId },
      include: { area: { select: { active: true } } },
    });
    const verifiedHistoricalOutlet = createOnly && historicalOutletIds?.has(outletId);
    if (
      !outlet ||
      ((!outlet.active || outlet.closed || !outlet.area.active) && !verifiedHistoricalOutlet)
    )
      throw new InputError("Outlet tidak aktif atau tidak ditemukan.");
    const old = await tx.outletDailyStatus.findUnique({
      where: { outletId_date: { outletId, date } },
    });
    if (createOnly && old)
      throw new InputError("Status outlet dan tanggal ini sudah tercatat.", 409);
    if (!createOnly && (old?.updatedAt.toISOString() || null) !== (body.closureVersion ?? null))
      throw new InputError("Status outlet sudah berubah. Tutup dan buka kembali formulir.", 409);
    if (body.operationalStatus === "BUKA") {
      if (!old?.closed) throw new InputError("Outlet tidak sedang tercatat tutup.", 409);
      await tx.outletDailyStatus.update({
        where: { id: old.id },
        data: { closed: false, updatedById: userId },
      });
      return;
    }
    const existing = await tx.outletOperation.findUnique({
      where: { outletId_date: { outletId, date } },
    });
    if (existing)
      throw new InputError(
        "Sudah ada rekap atau transaksi penjualan pada tanggal ini. Data yang ada tidak diubah menjadi TUTUP.",
        409,
      );
    const data = { closed: true, notes, updatedById: userId };
    if (old) await tx.outletDailyStatus.update({ where: { id: old.id }, data });
    else await tx.outletDailyStatus.create({ data: { ...data, outletId, date } });
  };
  if (transaction) await write(transaction);
  else await getPrisma().$transaction(write);
}
