import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { StockError } from "@/lib/outlet-stock";
import type { ReturnCommand } from "@/lib/stock-returns";
import { todayWib } from "@/lib/placements";
export async function runReturnCommand(db: PrismaClient, actorId: string, command: ReturnCommand) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ actorId, ...command }))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      // Kunci yang sama dengan pengiriman, produksi, susut dan pemakaian stok.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
      const prior = await tx.stockReturnAction.findUnique({ where: { requestKey: command.key } });
      if (prior) {
        if (prior.requestHash !== hash)
          throw new StockError("Form sudah dipakai untuk tindakan atau data berbeda.");
        return;
      }
      if (command.kind === "CREATE") {
        const outlet = await tx.outlet.findUnique({ where: { id: command.outletId } });
        if (!outlet) throw new StockError("Outlet tidak ditemukan.");
        for (const line of command.lines) {
          const item = await tx.inventoryItem.findUnique({ where: { id: line.itemId } });
          const balance = item
            ? await tx.outletStock.findUnique({
                where: {
                  outletId_itemId_unit: {
                    outletId: outlet.id,
                    itemId: line.itemId,
                    unit: item.baseUnit,
                  },
                },
              })
            : null;
          if (!item || !balance || !["RAW", "SUB", "FINISHED"].includes(item.kind))
            throw new StockError("Pilih barang gudang dengan stok outlet dan satuan yang sesuai.");
          if (balance.quantity.lessThan(line.quantity))
            throw new StockError("Jumlah retur melebihi stok outlet saat ini.");
        }
        const record = await tx.stockReturn.create({
          data: {
            requestKey: command.key,
            requestHash: hash,
            outletId: outlet.id,
            requesterName: command.requesterName,
            notes: command.notes,
            createdById: actorId,
          },
        });
        for (const line of command.lines) {
          const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: line.itemId } });
          await tx.stockReturnLine.create({
            data: {
              stockReturnId: record.id,
              itemId: line.itemId,
              unit: item.baseUnit,
              quantity: line.quantity,
            },
          });
        }
        await tx.stockReturnAction.create({
          data: {
            requestKey: command.key,
            requestHash: hash,
            stockReturnId: record.id,
            kind: "CREATE",
            actorId,
            notes: command.notes,
          },
        });
        return;
      }
      const record = await tx.stockReturn.findUnique({
        where: { id: command.id },
        include: { outlet: true, lines: { include: { item: true } } },
      });
      if (!record) throw new StockError("Retur tidak ditemukan.");
      if (record.version !== command.version)
        throw new StockError("Retur sudah berubah. Muat ulang halaman sebelum melanjutkan.");
      const log = {
        requestKey: command.key,
        requestHash: hash,
        stockReturnId: record.id,
        kind: command.kind,
        actorId,
        notes: command.notes,
      };
      if (command.kind === "APPROVE" || command.kind === "CANCEL" || command.kind === "REJECT") {
        const allowed =
          command.kind === "APPROVE" || command.kind === "REJECT"
            ? ["REQUESTED"]
            : ["REQUESTED", "APPROVED"];
        if (!allowed.includes(record.status))
          throw new StockError("Tindakan ini tidak tersedia pada status retur sekarang.");
        await tx.stockReturn.update({
          where: { id: record.id },
          data: {
            status:
              command.kind === "APPROVE"
                ? "APPROVED"
                : command.kind === "REJECT"
                  ? "REJECTED"
                  : "CANCELLED",
            version: { increment: 1 },
          },
        });
        await tx.stockReturnAction.create({ data: log });
        return;
      }
      if (command.kind === "SEND") {
        if (record.status !== "APPROVED")
          throw new StockError("Retur harus disetujui sebelum dikirim.");
        for (const line of record.lines) {
          const balance = await tx.outletStock.findUnique({
            where: {
              outletId_itemId_unit: {
                outletId: record.outletId,
                itemId: line.itemId,
                unit: line.unit,
              },
            },
          });
          if (!balance || balance.quantity.lessThan(line.quantity))
            throw new StockError(
              "Stok outlet tidak cukup untuk " +
                line.item.name +
                ". Periksa kembali stok sebelum mengirim.",
            );
          if (line.item.baseUnit !== line.unit)
            throw new StockError("Satuan barang berubah; buat pengajuan retur baru.");
          const quantity = balance.quantity.minus(line.quantity);
          const value =
            balance.value === null
              ? null
              : line.quantity.equals(balance.quantity)
                ? balance.value
                : balance.value.mul(line.quantity).div(balance.quantity).toDecimalPlaces(4);
          const remainingValue = quantity.isZero()
            ? new Prisma.Decimal(0)
            : balance.value === null
              ? null
              : balance.value.minus(value!);
          await tx.outletStock.update({
            where: { id: balance.id },
            data: { quantity, value: remainingValue, version: { increment: 1 } },
          });
          await tx.stockReturnLine.update({ where: { id: line.id }, data: { value } });
          await tx.outletStockEvent.create({
            data: {
              requestKey: command.key,
              requestHash: hash,
              stockReturnId: record.id,
              outletId: record.outletId,
              itemId: line.itemId,
              unit: line.unit,
              kind: "RETURN_SEND",
              quantityBefore: balance.quantity,
              quantityAfter: quantity,
              valueBefore: balance.value,
              valueAfter: remainingValue,
              actorId,
              notes: ("Retur " + record.id + " dikirim ke gudang pusat. " + record.notes).slice(
                0,
                2000,
              ),
            },
          });
        }
        await tx.stockReturn.update({
          where: { id: record.id },
          data: { status: "SENT", version: { increment: 1 } },
        });
        await tx.stockReturnAction.create({ data: log });
        return;
      }
      if (command.kind !== "RECEIVE" || !["SENT", "PARTIAL"].includes(record.status))
        throw new StockError("Retur belum dikirim atau sudah selesai.");
      if (command.lines.some((l) => !record.lines.some((row) => row.id === l.lineId)))
        throw new StockError("Daftar penerimaan tidak sesuai dengan retur.");
      const input = command.lines.filter((l) => l.quantity > 0);
      if (!input.length) throw new StockError("Isi jumlah barang yang benar-benar diterima.");
      const partial = record.lines.some((l) =>
        l.receivedQuantity
          .plus(input.find((row) => row.lineId === l.id)?.quantity || 0)
          .lessThan(l.quantity),
      );
      if (
        (partial ||
          input.some((l) => record.lines.find((row) => row.id === l.lineId)!.value === null)) &&
        command.notes.length < 3
      )
        throw new StockError(
          "Isi catatan penerimaan untuk jumlah parsial atau nilai perolehan manual.",
        );
      const action = await tx.stockReturnAction.create({ data: log });
      const operation = await tx.inventoryOperation.create({
        data: {
          postingKey: "OUTLET-RETURN:" + command.key,
          requestHash: hash,
          kind: "RETURN_IN",
          date: new Date(todayWib() + "T00:00:00Z"),
          createdById: actorId,
          notes: "Retur dari " + record.outlet.name + " / " + record.id + " / " + command.notes,
        },
      });
      for (const received of input) {
        const line = record.lines.find((l) => l.id === received.lineId)!,
          receivedQuantity = line.receivedQuantity.plus(received.quantity);
        if (line.item.baseUnit !== line.unit)
          throw new StockError(
            "Satuan barang berubah. Periksa data barang sebelum menerima retur.",
          );
        if (receivedQuantity.greaterThan(line.quantity))
          throw new StockError("Penerimaan melebihi sisa kiriman untuk " + line.item.name + ".");
        let value: Prisma.Decimal;
        if (line.value === null) {
          if (received.manualValue === null)
            throw new StockError(
              "Isi nilai perolehan barang yang diterima untuk " +
                line.item.name +
                " karena nilai asal belum tercatat.",
            );
          value = new Prisma.Decimal(received.manualValue);
        } else {
          if (received.manualValue !== null)
            throw new StockError(
              "Nilai asal barang sudah tersedia dan tidak dapat diganti manual.",
            );
          const cumulative = receivedQuantity.equals(line.quantity)
            ? line.value
            : line.value.mul(receivedQuantity).div(line.quantity).toDecimalPlaces(4);
          value = cumulative.minus(line.receivedValue);
        }
        const receivedValue = line.receivedValue.plus(value);
        if (value.isNegative() || receivedValue.greaterThan(1000000000000))
          throw new StockError("Nilai penerimaan tidak valid atau melebihi batas.");
        const batch = await tx.inventoryBatch.create({
          data: {
            itemId: line.itemId,
            productionId: operation.id,
            receivedAt: operation.date,
            baseUnit: line.unit,
            initialQuantity: received.quantity,
            remainingQuantity: received.quantity,
            initialValue: value,
            remainingValue: value,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            operationId: operation.id,
            batchId: batch.id,
            quantityBefore: 0,
            quantityAfter: received.quantity,
            valueBefore: 0,
            valueAfter: value,
          },
        });
        await tx.stockReturnReceiptLine.create({
          data: {
            actionId: action.id,
            lineId: line.id,
            batchId: batch.id,
            quantity: received.quantity,
            value,
            valueSource: line.value === null ? "MANUAL" : "CARRIED",
          },
        });
        await tx.stockReturnLine.update({
          where: { id: line.id },
          data: { receivedQuantity, receivedValue },
        });
        const balance = await tx.outletStock.findUniqueOrThrow({
          where: {
            outletId_itemId_unit: {
              outletId: record.outletId,
              itemId: line.itemId,
              unit: line.unit,
            },
          },
        });
        await tx.outletStockEvent.create({
          data: {
            requestKey: command.key,
            requestHash: hash,
            stockReturnId: record.id,
            outletId: record.outletId,
            itemId: line.itemId,
            unit: line.unit,
            kind: "RETURN_RECEIVE",
            quantityBefore: balance.quantity,
            quantityAfter: balance.quantity,
            valueBefore: balance.value,
            valueAfter: balance.value,
            actorId,
            notes: (
              "Gudang menerima " +
              received.quantity +
              " " +
              line.unit +
              " dari retur " +
              record.id +
              ". Stok outlet tidak dikurangi lagi. " +
              command.notes
            ).slice(0, 2000),
          },
        });
      }
      await tx.stockReturn.update({
        where: { id: record.id },
        data: { status: partial ? "PARTIAL" : "RECEIVED", version: { increment: 1 } },
      });
    },
    { maxWait: 10000, timeout: 20000 },
  );
}
