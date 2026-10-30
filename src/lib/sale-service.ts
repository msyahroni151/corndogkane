import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { SaleError, type SaleInput } from "@/lib/sale-input";
import { refreshDailySales, salesAmounts } from "@/lib/daily-sales";
import { canRecordOutletCrew } from "@/lib/outlet-operations";
import { parseCivilDate, todayWib } from "@/lib/placements";
export async function postSale(
  db: PrismaClient,
  actor: { id: string; name: string; canManage: boolean },
  input: SaleInput,
) {
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ actorId: actor.id, ...input }))
    .digest("hex");
  const id = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
      const prior = await tx.saleTransaction.findUnique({ where: { postingKey: input.key } });
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw new SaleError(
            "Kunci transaksi sudah dipakai untuk data lain. Periksa riwayat sebelum membuat transaksi baru.",
          );
        return prior.id;
      }
      const today = todayWib();
      if (input.date > today || (input.source === "POS" && input.date !== today))
        throw new SaleError(
          "Transaksi POS harus bertanggal hari ini. Muat ulang POS bila hari sudah berganti.",
        );
      if (input.source === "MANUAL_ADD" && !actor.canManage)
        throw new SaleError("Tambahan manual hanya dapat dicatat pengelola Monitoring Outlet.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.outletId + "|" + input.date},0))`;
      const [outlet, crew] = await Promise.all([
        tx.outlet.findUnique({
          where: { id: input.outletId },
          include: { area: { select: { active: true } } },
        }),
        tx.employee.findUnique({ where: { id: input.crewId } }),
      ]);
      if (
        !outlet?.active ||
        !outlet.area.active ||
        outlet.closed ||
        !crew ||
        !canRecordOutletCrew(crew)
      )
        throw new SaleError("Pilih outlet dan crew operasional aktif yang terdaftar.");
      if (!actor.canManage) {
        const user = await tx.user.findUnique({
          where: { id: actor.id },
          select: { employeeId: true },
        });
        const schedule = await tx.schedule.findFirst({
          where: {
            employeeId: user?.employeeId || "NONE",
            outletId: outlet.id,
            date: parseCivilDate(input.date),
            status: "KERJA",
          },
        });
        if (user?.employeeId !== crew.id || !schedule)
          throw new SaleError("POS hanya dapat digunakan pada outlet sesuai jadwal kerja Anda.");
      }
      const products = await tx.inventoryItem.findMany({
        where: { id: { in: input.items.map((i) => i.productId) }, kind: "PRODUCT", active: true },
        include: { recipe: { include: { ingredient: true } } },
      });
      if (products.length !== input.items.length)
        throw new SaleError("Menu berubah atau tidak aktif. Muat ulang daftar menu.");
      const total = input.items.reduce(
        (sum, line) =>
          sum + products.find((p) => p.id === line.productId)!.sellingPrice * line.quantity,
        0,
      );
      if (
        !Number.isSafeInteger(total) ||
        total <= 0 ||
        total > 1000000000 ||
        products.some((p) => p.sellingPrice <= 0)
      )
        throw new SaleError("Harga jual menu belum valid. Periksa Setting Menu.");
      if (total !== input.quotedTotal)
        throw new SaleError("Harga menu berubah. Muat ulang POS dan periksa ulang pembayaran.");
      if (
        (input.method === "TUNAI" && input.received < total) ||
        (input.method !== "TUNAI" && input.received !== total)
      )
        throw new SaleError("Nominal pembayaran tidak sesuai total transaksi.");
      let day = await tx.outletOperation.findUnique({
        where: { outletId_date: { outletId: outlet.id, date: parseCivilDate(input.date) } },
      });
      if (!day)
        day = await tx.outletOperation.create({
          data: {
            outletId: outlet.id,
            outletName: outlet.name,
            date: parseCivilDate(input.date),
            crewId: crew.id,
            crewName: crew.fullName,
            items: {},
            totalGross: 0,
            hasManual: false,
            createdById: actor.id,
            updatedById: actor.id,
            salesSource: input.source,
          },
        });
      if (day.hasManual && day.manualSales === null)
        await tx.outletOperation.update({
          where: { id: day.id },
          data: {
            manualSales: { ...salesAmounts(day)!, items: day.items } as Prisma.InputJsonValue,
          },
        });
      const sale = await tx.saleTransaction.create({
        data: {
          postingKey: input.key,
          requestHash,
          operationId: day.id,
          outletId: outlet.id,
          crewId: crew.id,
          crewName: crew.fullName,
          cashierName: actor.name,
          createdById: actor.id,
          date: day.date,
          source: input.source,
          method: input.method,
          total,
          received: input.received,
          notes: input.notes,
        },
      });
      const required = new Map<string, { quantity: Prisma.Decimal; unit: string; name: string }>();
      let complete = true;
      for (const line of input.items) {
        const product = products.find((p) => p.id === line.productId)!;
        const reason =
          input.date < today ? "BACKDATED" : !product.recipe.length ? "NO_RECIPE" : null;
        if (reason) complete = false;
        for (const recipe of product.recipe) {
          if (
            !recipe.ingredient.active ||
            !["RAW", "SUB", "FINISHED"].includes(recipe.ingredient.kind) ||
            recipe.baseUnit !== recipe.ingredient.baseUnit
          )
            throw new SaleError(
              "Resep " +
                product.name +
                " memakai bahan tidak aktif atau satuan tidak sesuai. Periksa Resep & HPP.",
            );
          if (!reason) {
            const previous = required.get(recipe.ingredientId);
            required.set(recipe.ingredientId, {
              quantity: (previous?.quantity || new Prisma.Decimal(0)).plus(
                recipe.quantity.mul(line.quantity),
              ),
              unit: recipe.baseUnit,
              name: recipe.ingredient.name,
            });
          }
        }
        await tx.saleLine.create({
          data: {
            saleId: sale.id,
            productId: product.id,
            productName: product.name,
            quantity: line.quantity,
            unitPrice: product.sellingPrice,
            total: product.sellingPrice * line.quantity,
            recipe: product.recipe.map((r) => ({
              itemId: r.ingredientId,
              quantity: r.quantity.toString(),
              unit: r.baseUnit,
            })),
            stockApplied: !reason,
            pendingReason: reason,
          },
        });
      }
      let cost = new Prisma.Decimal(0);
      for (const [itemId, ingredient] of [...required].sort(([a], [b]) => a.localeCompare(b))) {
        const balance = await tx.outletStock.findUnique({
          where: { outletId_itemId_unit: { outletId: outlet.id, itemId, unit: ingredient.unit } },
        });
        if (!balance || balance.quantity.lessThan(ingredient.quantity))
          throw new SaleError(
            "Stok outlet tidak cukup untuk " +
              ingredient.name +
              ". Periksa Control Stok; transaksi belum disimpan.",
          );
        const quantity = balance.quantity.minus(ingredient.quantity),
          value =
            balance.value === null
              ? null
              : quantity.isZero()
                ? new Prisma.Decimal(0)
                : balance.value.mul(quantity).div(balance.quantity).toDecimalPlaces(4);
        if (balance.value === null) complete = false;
        else cost = cost.plus(balance.value.minus(value!));
        await tx.outletStock.update({
          where: { id: balance.id },
          data: { quantity, value, version: { increment: 1 } },
        });
        await tx.outletStockEvent.create({
          data: {
            requestKey: input.key,
            requestHash,
            saleId: sale.id,
            outletId: outlet.id,
            itemId,
            unit: ingredient.unit,
            kind: "SALE_USE",
            quantityBefore: balance.quantity,
            quantityAfter: quantity,
            valueBefore: balance.value,
            valueAfter: value,
            actorId: actor.id,
            notes: ("Penjualan " + input.source + " / " + sale.id + " / " + input.notes).slice(
              0,
              2000,
            ),
          },
        });
      }
      await tx.saleTransaction.update({
        where: { id: sale.id },
        data: { costTotal: complete ? cost : null },
      });
      await tx.outletOperation.update({
        where: { id: day.id },
        data: { salesRevision: { increment: 1 } },
      });
      await refreshDailySales(tx, day.id, actor.id);
      return sale.id;
    },
    { maxWait: 10000, timeout: 20000 },
  );
  const sale = await db.saleTransaction.findUniqueOrThrow({
    where: { id },
    include: { lines: true, outlet: { select: { name: true } } },
  });
  return {
    id: sale.id,
    dateISO: sale.createdAt.toISOString(),
    outletId: sale.outletId,
    outlet: sale.outlet.name,
    cashier: sale.cashierName,
    crew: sale.crewName,
    method: sale.method,
    source: sale.source,
    total: sale.total,
    received: sale.received,
    preview: false,
    stockPending: sale.lines.filter((l) => !l.stockApplied).length,
    items: sale.lines.map((l) => ({
      name: l.productName,
      quantity: l.quantity,
      price: l.unitPrice,
    })),
  };
}
