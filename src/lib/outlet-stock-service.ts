import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { fifoShipment, outletStockChange, StockError, type StockCommand } from "@/lib/outlet-stock";
import { inventoryRound } from "@/lib/inventory";
import { todayWib } from "@/lib/placements";

export async function runStockCommand(db: PrismaClient, actorId: string, command: StockCommand) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ actorId, ...command }))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
      if (command.kind === "REQUEST") {
        const prior = await tx.outletStockOrder.findUnique({ where: { requestKey: command.key } });
        if (prior) {
          if (prior.requestHash !== hash)
            throw new StockError("Form sudah dipakai untuk permintaan berbeda.");
          return;
        }
        const outlet = await tx.outlet.findUnique({ where: { id: command.outletId } });
        if (!outlet?.active) throw new StockError("Outlet tidak aktif atau tidak ditemukan.");
        const items = await tx.inventoryItem.findMany({
          where: {
            id: { in: command.lines.map((l) => l.itemId) },
            active: true,
            kind: { in: ["RAW", "SUB", "FINISHED"] },
          },
        });
        if (items.length !== command.lines.length)
          throw new StockError(
            "Pilih bahan mentah, setengah jadi, atau bahan jadi aktif yang terdaftar.",
          );
        await tx.outletStockOrder.create({
          data: {
            requestKey: command.key,
            requestHash: hash,
            outletId: outlet.id,
            requesterName: command.requesterName,
            notes: command.notes,
            createdById: actorId,
            lines: {
              create: command.lines.map((l) => ({
                itemId: l.itemId,
                quantity: l.quantity,
                unit: items.find((i) => i.id === l.itemId)!.baseUnit,
              })),
            },
          },
        });
        return;
      }
      if ("orderId" in command) {
        const order = await tx.outletStockOrder.findUnique({
          where: { id: command.orderId },
          include: { outlet: true, lines: { include: { item: true } } },
        });
        if (!order) throw new StockError("Permintaan tidak ditemukan.");
        if (command.kind === "SEND" && order.sentKey === command.key && order.sentById === actorId)
          return;
        if (
          command.kind === "RECEIVE" &&
          order.receivedKey === command.key &&
          order.receivedById === actorId
        )
          return;
        if (
          command.kind === "CANCEL" &&
          order.cancelledKey === command.key &&
          order.cancelledById === actorId
        )
          return;
        if (order.version !== command.version)
          throw new StockError("Permintaan sudah berubah. Muat ulang halaman.");
        if (command.kind === "CANCEL") {
          if (order.status !== "REQUESTED")
            throw new StockError("Hanya permintaan yang belum dikirim yang dapat dibatalkan.");
          await tx.outletStockOrder.update({
            where: { id: order.id },
            data: {
              status: "CANCELLED",
              cancelledKey: command.key,
              cancelledById: actorId,
              cancelledAt: new Date(),
              version: { increment: 1 },
            },
          });
          return;
        }
        if (!order.outlet.active) throw new StockError("Outlet sudah tidak aktif.");
        if (command.kind === "SEND") {
          if (order.status !== "REQUESTED") throw new StockError("Permintaan ini sudah diproses.");
          const op = await tx.inventoryOperation.create({
            data: {
              postingKey: "OUTLET-SEND:" + command.key,
              requestHash: hash,
              kind: "TRANSFER_OUT",
              date: new Date(todayWib() + "T00:00:00Z"),
              notes: "Kirim ke " + order.outlet.name + " / " + order.id,
              createdById: actorId,
            },
          });
          for (const line of order.lines) {
            if (!line.item.active || line.item.baseUnit !== line.unit)
              throw new StockError("Data barang berubah. Batalkan dan buat permintaan baru.");
            const batches = await tx.inventoryBatch.findMany({
              where: { itemId: line.itemId, baseUnit: line.unit, remainingQuantity: { gt: 0 } },
              orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            });
            const planned = fifoShipment(
              batches.map((b) => ({
                id: b.id,
                quantity: Number(b.remainingQuantity),
                value: Number(b.remainingValue),
              })),
              Number(line.quantity),
            );
            let value = 0;
            for (const move of planned) {
              await tx.inventoryBatch.update({
                where: { id: move.id },
                data: {
                  remainingQuantity: move.after,
                  remainingValue: move.afterValue,
                  version: { increment: 1 },
                },
              });
              await tx.inventoryMovement.create({
                data: {
                  operationId: op.id,
                  batchId: move.id,
                  quantityBefore: move.before,
                  quantityAfter: move.after,
                  valueBefore: move.beforeValue,
                  valueAfter: move.afterValue,
                },
              });
              value = inventoryRound(value + move.value, 4);
            }
            await tx.outletStockOrderLine.update({ where: { id: line.id }, data: { value } });
          }
          await tx.outletStockOrder.update({
            where: { id: order.id },
            data: {
              status: "SENT",
              sentKey: command.key,
              sentById: actorId,
              sentAt: new Date(),
              shipmentId: op.id,
              version: { increment: 1 },
            },
          });
          return;
        }
        if (order.status !== "SENT")
          throw new StockError("Barang belum dikirim atau sudah diterima.");
        for (const line of order.lines) {
          const balance = await tx.outletStock.findUnique({
            where: {
              outletId_itemId_unit: {
                outletId: order.outletId,
                itemId: line.itemId,
                unit: line.unit,
              },
            },
          });
          if (!balance)
            throw new StockError(
              "Catat stok awal " +
                line.item.name +
                " di outlet sebelum menerima kiriman. Isi 0 jika sebelumnya kosong.",
            );
          const after = inventoryRound(Number(balance.quantity) + Number(line.quantity));
          if (after > 1_000_000_000) throw new StockError("Stok outlet melewati batas pencatatan.");
          const nextValue =
            balance.value === null || line.value === null
              ? null
              : inventoryRound(Number(balance.value) + Number(line.value), 4);
          await tx.outletStock.update({
            where: { id: balance.id },
            data: { quantity: after, value: nextValue, version: { increment: 1 } },
          });
          await tx.outletStockEvent.create({
            data: {
              requestKey: command.key,
              requestHash: hash,
              outletId: order.outletId,
              itemId: line.itemId,
              unit: line.unit,
              kind: "RECEIVE",
              quantityBefore: balance.quantity,
              quantityAfter: after,
              valueBefore: balance.value,
              valueAfter: nextValue,
              notes: "Penerimaan permintaan " + order.id,
              actorId,
              orderId: order.id,
            },
          });
        }
        await tx.outletStockOrder.update({
          where: { id: order.id },
          data: {
            status: "RECEIVED",
            receivedKey: command.key,
            receivedById: actorId,
            receivedAt: new Date(),
            version: { increment: 1 },
          },
        });
        return;
      }
      // Every outlet adjustment is audited and compared against the displayed stock version.
      const prior = await tx.outletStockEvent.findUnique({
        where: { requestKey_itemId: { requestKey: command.key, itemId: command.itemId } },
      });
      if (prior) {
        if (prior.requestHash !== hash)
          throw new StockError("Form sudah disimpan dengan data berbeda.");
        return;
      }
      const [outlet, item] = await Promise.all([
        tx.outlet.findUnique({ where: { id: command.outletId } }),
        tx.inventoryItem.findUnique({ where: { id: command.itemId } }),
      ]);
      if (!outlet?.active || !item?.active || !["RAW", "SUB", "FINISHED"].includes(item.kind))
        throw new StockError("Pilih outlet dan barang aktif yang terdaftar.");
      const where = { outletId: outlet.id, itemId: item.id, unit: item.baseUnit };
      const before = await tx.outletStock.findUnique({ where: { outletId_itemId_unit: where } });
      if ((before?.version ?? -1) !== command.version)
        throw new StockError("Stok sudah berubah. Tutup popup dan muat ulang sebelum mencatat.");
      const next = outletStockChange(
        command.kind,
        before ? Number(before.quantity) : null,
        before?.value == null ? null : Number(before.value),
        command.quantity,
      );
      if (next.value !== null && next.value > 1_000_000_000_000)
        throw new StockError("Nilai stok melebihi batas.");
      if (before)
        await tx.outletStock.update({
          where: { id: before.id },
          data: {
            ...next,
            ...(command.kind === "COUNT"
              ? {
                  lastCountAt: new Date(),
                  lastCountQuantity: next.quantity,
                  lastCountDifference: inventoryRound(next.quantity - Number(before.quantity)),
                }
              : {}),
            version: { increment: 1 },
          },
        });
      else
        await tx.outletStock.create({
          data: { ...where, ...next, lastCountQuantity: next.quantity, lastCountAt: new Date() },
        });
      await tx.outletStockEvent.create({
        data: {
          requestKey: command.key,
          requestHash: hash,
          ...where,
          kind: before ? command.kind : "OPENING",
          quantityBefore: before?.quantity ?? null,
          quantityAfter: next.quantity,
          valueBefore: before?.value ?? null,
          valueAfter: next.value,
          notes: command.notes,
          actorId,
        },
      });
    },
    { maxWait: 10000, timeout: 20000 },
  );
}
