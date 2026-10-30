import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { changedBatch, inventoryNumber } from "@/lib/inventory";
import { parseCivilDate, todayWib } from "@/lib/placements";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "InventoryValidation";
  throw e;
}
export async function consumeRemainder(
  tx: Prisma.TransactionClient,
  command: {
    batchId: string;
    version: number;
    itemId: string;
    quantity: number;
    date: string;
    operationId: string;
  },
) {
  const batch = await tx.inventoryBatch.findUnique({
    where: { id: command.batchId },
    include: {
      remainderStock: true,
      movements: { include: { operation: { select: { date: true } } } },
    },
  });
  if (!batch?.remainderStock || batch.itemId !== command.itemId)
    invalid("Pilih sisa dengan bahan dan satuan hasil produksi yang sama.");
  if (batch.version !== command.version)
    invalid("Stok sisa sudah berubah. Tutup lalu buka kembali form produksi.");
  if (
    batch.receivedAt > parseCivilDate(command.date) ||
    batch.movements.some((m) => m.operation.date > parseCivilDate(command.date))
  )
    invalid("Tanggal produksi mendahului pencatatan atau pemakaian sisa terakhir.");
  let next;
  try {
    inventoryNumber(command.quantity);
    next = changedBatch(
      "LOSS",
      Number(batch.remainingQuantity),
      Number(batch.remainingValue),
      command.quantity,
      Number(batch.initialQuantity),
      Number(batch.initialValue),
    );
  } catch {
    invalid("Jumlah sisa yang dipakai melebihi stok atau tidak valid.");
  }
  await tx.inventoryBatch.update({
    where: { id: batch.id },
    data: { remainingQuantity: next.after, remainingValue: next.value, version: { increment: 1 } },
  });
  await tx.inventoryMovement.create({
    data: {
      operationId: command.operationId,
      batchId: batch.id,
      quantityBefore: batch.remainingQuantity,
      quantityAfter: next.after,
      valueBefore: batch.remainingValue,
      valueAfter: next.value,
    },
  });
  return Number(batch.remainingValue) - next.value;
}
export async function registerProductionRemainder(
  db: PrismaClient,
  actorId: string,
  command: {
    sourceBatchId: string;
    version: number;
    quantity: number;
    date: string;
    location: string;
    notes: string;
    postingKey: string;
  },
) {
  const date = parseCivilDate(command.date);
  if (
    command.date > todayWib() ||
    !/^[a-f0-9-]{36}$/i.test(command.postingKey) ||
    command.location.length > 160 ||
    command.notes.length > 2000 ||
    !Number.isSafeInteger(command.version)
  )
    invalid("Data pencatatan sisa tidak valid.");
  try {
    inventoryNumber(command.quantity);
  } catch {
    invalid("Jumlah sisa harus lebih dari nol dan valid.");
  }
  const hash = createHash("sha256")
    .update(JSON.stringify({ actorId, ...command }))
    .digest("hex");
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
      const prior = await tx.inventoryOperation.findUnique({
        where: { postingKey: command.postingKey },
      });
      if (prior) {
        if (prior.requestHash !== hash)
          invalid("Form sudah disimpan dengan data berbeda. Buka form baru.");
        return;
      }
      const source = await tx.inventoryBatch.findUnique({
        where: { id: command.sourceBatchId },
        include: {
          production: true,
          item: true,
          remainderStock: true,
          movements: { include: { operation: { select: { date: true } } } },
        },
      });
      if (
        !source ||
        source.production?.kind !== "PRODUCTION" ||
        source.remainderStock ||
        !source.item.active ||
        !["SUB", "FINISHED"].includes(source.item.kind) ||
        source.baseUnit !== source.item.baseUnit
      )
        invalid("Pilih batch hasil produksi aktif yang belum menjadi batch sisa.");
      if (source.version !== command.version)
        invalid("Batch produksi sudah berubah. Tutup dan buka kembali form sisa.");
      if (source.receivedAt > date || source.movements.some((m) => m.operation.date > date))
        invalid("Tanggal sisa mendahului perubahan stok batch terakhir.");
      let next;
      try {
        next = changedBatch(
          "LOSS",
          Number(source.remainingQuantity),
          Number(source.remainingValue),
          command.quantity,
          Number(source.initialQuantity),
          Number(source.initialValue),
        );
      } catch {
        invalid("Jumlah sisa melebihi stok hasil produksi yang masih tersedia.");
      }
      const operation = await tx.inventoryOperation.create({
        data: {
          postingKey: command.postingKey,
          requestHash: hash,
          kind: "REMAINDER_SPLIT",
          date,
          createdById: actorId,
          notes:
            "Pisahkan sisa produksi " +
            source.item.name +
            (command.notes ? "\n" + command.notes : ""),
        },
      });
      await tx.inventoryBatch.update({
        where: { id: source.id },
        data: {
          remainingQuantity: next.after,
          remainingValue: next.value,
          version: { increment: 1 },
        },
      });
      const stock = await tx.inventoryBatch.create({
        data: {
          itemId: source.itemId,
          productionId: source.productionId,
          receivedAt: date,
          baseUnit: source.baseUnit,
          initialQuantity: command.quantity,
          remainingQuantity: command.quantity,
          initialValue: Number(source.remainingValue) - next.value,
          remainingValue: Number(source.remainingValue) - next.value,
        },
      });
      await tx.inventoryMovement.createMany({
        data: [
          {
            operationId: operation.id,
            batchId: source.id,
            quantityBefore: source.remainingQuantity,
            quantityAfter: next.after,
            valueBefore: source.remainingValue,
            valueAfter: next.value,
          },
          {
            operationId: operation.id,
            batchId: stock.id,
            quantityBefore: 0,
            quantityAfter: command.quantity,
            valueBefore: 0,
            valueAfter: stock.remainingValue,
          },
        ],
      });
      await tx.productionRemainder.create({
        data: {
          sourceBatchId: source.id,
          stockBatchId: stock.id,
          operationId: operation.id,
          date,
          location: command.location,
          notes: command.notes,
        },
      });
    },
    { timeout: 20000 },
  );
}
