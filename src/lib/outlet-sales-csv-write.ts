import { Prisma } from "@/generated/prisma/client";
import { allocateBusinessIds } from "@/lib/business-id";
import { isCurrentBonusDate } from "@/lib/bonus-period";
import { InputError } from "@/lib/outlet-operation-write";
import { canImportOutletCrew, operationalProducts } from "@/lib/outlet-operations";
import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";
import type { HistoricalImportOptions, ResolvedSalesCsvRow } from "@/lib/outlet-sales-csv-service";

/** Only called after parsing, locking every day/crew and rechecking occupied days. */
export async function writeSalesImportBatch(
  tx: Prisma.TransactionClient,
  rows: ResolvedSalesCsvRow[],
  userId: string,
  options: HistoricalImportOptions,
) {
  if (!rows.length) return;
  const outletIds = [...new Set(rows.map((row) => row.outletId))].sort();
  // Hold master references stable while inserting, including archived outlets allowed by a trusted import.
  await tx.$executeRaw(Prisma.sql`SELECT o.id FROM outlets o JOIN areas a ON a.id=o."areaId"
    WHERE o.id IN (${Prisma.join(outletIds)}) ORDER BY o.id FOR SHARE OF o,a`);
  const [outlets, crew] = await Promise.all([
    tx.outlet.findMany({
      where: { id: { in: outletIds } },
      include: { area: { select: { active: true } } },
    }),
    tx.employee.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.crewId).filter(Boolean))] } },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        department: true,
        position: true,
        active: true,
      },
    }),
  ]);
  const outletMap = new Map(outlets.map((o) => [o.id, o]));
  const crewMap = new Map(crew.map((e) => [e.id, e]));
  const operations: Prisma.OutletOperationCreateManyInput[] = [];
  const closures: Prisma.OutletDailyStatusCreateManyInput[] = [];
  const lineNumbers = new Map<string, number>();
  const fail = (row: ResolvedSalesCsvRow, message: string): never => {
    throw new InputError(`Baris ${row.row}: ${message}`);
  };
  for (const row of rows) {
    const outlet = outletMap.get(row.outletId);
    if (
      !outlet ||
      ((!outlet.active || outlet.closed || !outlet.area.active) &&
        !options.historicalOutletIds?.has(row.outletId))
    )
      fail(row, "Outlet tidak aktif atau tidak ditemukan.");
    const date = new Date(row.date + "T00:00:00Z");
    if (row.operationalStatus === "TUTUP") {
      closures.push({
        outletId: row.outletId,
        date,
        closed: true,
        notes: row.operationalNotes,
        updatedById: userId,
      });
      continue;
    }
    const employee = crewMap.get(row.crewId);
    if (
      !employee ||
      (!canImportOutletCrew(employee) &&
        !(employee.employeeCode?.trim() && options.historicalCrewIds?.has(employee.id)))
    )
      fail(row, "Crew tidak ditemukan atau tidak memenuhi syarat impor historis.");
    const items = Object.fromEntries(
      operationalProducts.map((p) => [
        p.key,
        { quantity: row.quantities[p.key], unitPrice: row.unitPrices[p.key] },
      ]),
    );
    const gross = Object.values(items).reduce((n, item) => n + item.quantity * item.unitPrice, 0);
    if (gross !== row.totalGross || row.qris + row.gofood + row.grabfood + row.shopeefood > gross)
      fail(row, "Rincian penjualan atau pembayaran tidak sesuai total.");
    const rate = outletBonusRate(outlet!.name, row.date, outlet!.dailyRate, gross);
    const manualSales = {
      totalGross: gross,
      qris: row.qris,
      gofood: row.gofood,
      grabfood: row.grabfood,
      shopeefood: row.shopeefood,
      items,
    };
    lineNumbers.set(row.outletId + "|" + row.date, row.row);
    operations.push({
      outletId: row.outletId,
      outletName: outlet!.name,
      date,
      crewId: row.crewId,
      crewName: employee!.fullName,
      trainingCrewId: null,
      trainingCrewName: row.trainingCrewName,
      doughUsed: row.doughUsed,
      expenseAmount: row.expenseAmount,
      expenseNotes: row.expenseNotes,
      cashReceived: row.cashReceived,
      ...manualSales,
      manualSales,
      hasManual: true,
      salesRevision: 1,
      bonusDailyRate: rate,
      bonusAmount: outletBonus(gross, rate),
      createdById: userId,
      updatedById: userId,
    });
  }
  const bonusRows = operations.filter(
    (r) => r.bonusAmount != null && r.bonusAmount > 0 && isCurrentBonusDate(r.date as Date),
  );
  if (bonusRows.length) {
    const identities = bonusRows.map((r) => ({ employeeId: r.crewId, date: r.date as Date }));
    const [paid, manual] = await Promise.all([
      tx.payroll.findMany({
        where: {
          employeeId: { in: [...new Set(bonusRows.map((r) => r.crewId))] },
          status: "PAID",
          endDate: { gte: new Date(Math.min(...bonusRows.map((r) => (r.date as Date).getTime()))) },
        },
        select: { employeeId: true, endDate: true },
      }),
      tx.moneyEntry.findMany({
        where: {
          OR: identities,
          kind: "BONUS_EARNED",
          postingKey: null,
          status: { not: "REJECTED" },
        },
        select: { employeeId: true, date: true },
      }),
    ]);
    for (const r of bonusRows) {
      const line = lineNumbers.get(r.outletId + "|" + (r.date as Date).toISOString().slice(0, 10));
      if (paid.some((p) => p.employeeId === r.crewId && p.endDate >= (r.date as Date)))
        throw new InputError(
          `Baris ${line}: Bonus tidak dapat ditambahkan karena tanggal tersebut sudah tercakup payroll yang dibayar.`,
        );
      if (
        manual.some(
          (m) => m.employeeId === r.crewId && m.date.getTime() === (r.date as Date).getTime(),
        )
      )
        throw new InputError(
          `Baris ${line}: Sudah ada bonus manual pada crew dan tanggal ini. Periksa menu Bonus agar tidak tercatat ganda.`,
        );
    }
  }
  // No skipDuplicates: any race or constraint failure must roll back the entire file.
  const saved = operations.length
    ? await tx.outletOperation.createManyAndReturn({
        data: operations,
        select: {
          id: true,
          outletName: true,
          crewId: true,
          crewName: true,
          date: true,
          totalGross: true,
          bonusAmount: true,
        },
      })
    : [];
  if (closures.length) await tx.outletDailyStatus.createMany({ data: closures });
  const earned = saved.filter(
    (r) => r.bonusAmount != null && r.bonusAmount > 0 && isCurrentBonusDate(r.date),
  );
  if (earned.length) {
    const ids = await allocateBusinessIds(tx, "bonus", earned.length);
    await tx.moneyEntry.createMany({
      data: earned.map((r, i) => ({
        id: ids[i],
        postingKey: `OUTLET-BONUS:${r.id}`,
        employeeId: r.crewId,
        employeeName: r.crewName,
        date: r.date,
        kind: "BONUS_EARNED",
        amount: r.bonusAmount!,
        notes: `Bonus omzet otomatis · ${r.outletName} · omzet Rp ${r.totalGross.toLocaleString("id-ID")} · rekap ${r.id}`,
        status: "APPROVED",
        createdById: userId,
        decidedById: userId,
        decidedAt: new Date(),
        decisionNotes: "Bonus otomatis langsung masuk saldo crew.",
      })),
    });
  }
}
