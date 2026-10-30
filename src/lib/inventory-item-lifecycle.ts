import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { warehouseKinds } from "@/lib/inventory";
export const lifecycleCounts = {
  batches: true,
  lines: true,
  usedIn: true,
  outletStocks: true,
  outletStockEvents: true,
  outletStockOrderLines: true,
  recipe: true,
} as const;
export function permanentDeletionReason(counts: {
  batches: number;
  lines: number;
  usedIn: number;
  outletStocks: number;
  outletStockEvents: number;
  outletStockOrderLines: number;
}) {
  if (
    counts.batches ||
    counts.lines ||
    counts.outletStocks ||
    counts.outletStockEvents ||
    counts.outletStockOrderLines
  )
    return "Bahan memiliki stok atau riwayat transaksi. Tetap simpan di Sampah agar riwayat tidak hilang.";
  if (counts.usedIn)
    return "Bahan masih digunakan dalam resep lain. Lepaskan dari resep tersebut sebelum menghapus permanen.";
  return "";
}
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "InventoryValidation";
  throw e;
}
export async function runInventoryItemLifecycle(
  db: PrismaClient,
  actorId: string,
  command: {
    id: string;
    version: string;
    operation: string;
    postingKey: string;
    date: string;
    confirmationName: string;
  },
) {
  if (
    !["ARCHIVE", "RESTORE", "DELETE"].includes(command.operation) ||
    !/^[a-f0-9-]{36}$/i.test(command.postingKey)
  )
    invalid("Form tidak valid. Tutup lalu buka kembali.");
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ actorId, ...command }))
    .digest("hex");
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
      const previous = await tx.inventoryOperation.findUnique({
        where: { postingKey: command.postingKey },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          invalid("Form sudah digunakan dengan data berbeda. Buka form baru.");
        return;
      }
      let item = await tx.inventoryItem.findUnique({
        where: { id: command.id },
        include: { _count: { select: lifecycleCounts } },
      });
      if (!item || item.updatedAt.toISOString() !== command.version)
        invalid("Data bahan sudah berubah. Tutup form dan muat ulang.");
      if (!(warehouseKinds as readonly string[]).includes(item.kind))
        invalid("Tindakan ini hanya untuk bahan gudang.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-item:" + item.key}))`;
      // Receipts use the item-key lock; reload dependencies after waiting for them.
      item = await tx.inventoryItem.findUnique({
        where: { id: command.id },
        include: { _count: { select: lifecycleCounts } },
      });
      if (!item || item.updatedAt.toISOString() !== command.version)
        invalid("Data bahan sudah berubah. Tutup form dan muat ulang.");
      if (command.operation === "ARCHIVE" ? !item.active : item.active)
        invalid(
          command.operation === "ARCHIVE"
            ? "Bahan sudah berada di Sampah."
            : "Bahan harus dipindahkan ke Sampah terlebih dahulu.",
        );
      if (command.operation === "DELETE") {
        if (command.confirmationName !== item.name)
          invalid("Ketik nama bahan dengan tepat untuk menghapus permanen.");
        const reason = permanentDeletionReason(item._count);
        if (reason) invalid(reason);
        await tx.inventoryRecipe.deleteMany({ where: { outputId: item.id } });
        await tx.inventoryItem.delete({ where: { id: item.id } });
      } else
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { active: command.operation === "RESTORE" },
        });
      await tx.inventoryOperation.create({
        data: {
          postingKey: command.postingKey,
          requestHash,
          kind: "ITEM_" + command.operation,
          date: new Date(command.date + "T00:00:00.000Z"),
          createdById: actorId,
          notes: JSON.stringify({
            id: item.id,
            name: item.name,
            kind: item.kind,
            activeBefore: item.active,
            operation: command.operation,
          }),
        },
      });
    },
    { timeout: 15000 },
  );
}
