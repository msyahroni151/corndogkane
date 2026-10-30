"use server";
import { warehouseKinds } from "@/lib/inventory";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate } from "@/lib/placements";
import { itemKey, parseGoodsReceipt } from "@/lib/goods-receipts";
import type { FormState } from "@/lib/form-state";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "ReceiptValidation";
  throw e;
}
export async function createGoodsReceipt(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("barang-masuk");
  let data: ReturnType<typeof parseGoodsReceipt>;
  try {
    data = parseGoodsReceipt(form, todayWib());
  } catch (e) {
    return {
      error:
        e instanceof SyntaxError
          ? "Data barang tidak valid. Muat ulang form dan coba lagi."
          : (e as Error).message,
    };
  }
  const requestHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"GOODS:" + data.postingKey}))`;
        const existing = await tx.goodsReceipt.findUnique({
          where: { postingKey: data.postingKey },
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            invalid("Form ini sudah disimpan dengan data berbeda. Buka form baru.");
          return;
        }
        if (data.supplierId)
          await tx.$executeRaw`SELECT id FROM partners WHERE id=${data.supplierId} FOR UPDATE`;
        const supplier = data.supplierId
          ? await tx.partner.findUnique({ where: { id: data.supplierId } })
          : null;
        if (data.supplierId && (!supplier || supplier.kind !== "SUPPLIER"))
          invalid("Supplier tidak ditemukan. Pilih supplier yang terdaftar.");
        const itemIds = new Map<string, string>();
        for (const line of [...data.lines].sort((a, b) =>
          itemKey(a.name).localeCompare(itemKey(b.name)),
        )) {
          const key = itemKey(line.name);
          if (itemIds.has(key)) continue;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-item:" + key}))`;
          const item = await tx.inventoryItem.upsert({
            where: { key },
            update: {},
            create: {
              key,
              name: line.name,
              category: "Persediaan Gudang",
              packagingUnit: line.packagingUnit,
              baseUnit: line.baseUnit,
            },
          });
          if (!warehouseKinds.some((k) => k === item.kind))
            invalid(
              "Barang ini merupakan menu jual. Pilih atau buat barang stok gudang terlebih dahulu.",
            );
          if (!item.active)
            invalid(
              "Barang " +
                item.name +
                " berada di Sampah. Kembalikan melalui Stok & Inventori terlebih dahulu.",
            );
          itemIds.set(key, item.id);
        }
        const receipt = await tx.goodsReceipt.create({
          data: {
            postingKey: data.postingKey,
            requestHash,
            date: parseCivilDate(data.date),
            supplierId: supplier?.id || null,
            supplierName: supplier?.name || null,
            paymentMethod: data.paymentMethod,
            paid: data.paid,
            porterFee: data.porterFee,
            total: data.total,
            notes: data.notes || null,
            createdById: user.id,
            lines: {
              create: data.lines.map((line) => ({
                itemId: itemIds.get(itemKey(line.name))!,
                itemName: line.name,
                packCount: line.packCount,
                packagingUnit: line.packagingUnit,
                quantityPerPack: line.quantityPerPack,
                inputUnit: line.inputUnit,
                quantity: line.quantity,
                baseUnit: line.baseUnit,
                amount: line.amount,
              })),
            },
          },
          include: { lines: true },
        });
        await tx.inventoryBatch.createMany({
          data: receipt.lines.map((line) => ({
            itemId: line.itemId,
            sourceLineId: line.id,
            receivedAt: receipt.date,
            baseUnit: line.baseUnit,
            initialQuantity: line.quantity,
            remainingQuantity: line.quantity,
            initialValue: line.amount,
            remainingValue: line.amount,
          })),
        });
        if (supplier && !data.paid) {
          if (supplier.outstandingDebt + data.total > 1_000_000_000)
            invalid("Saldo hutang supplier melewati batas Rp1 miliar.");
          await tx.partner.update({
            where: { id: supplier.id },
            data: { outstandingDebt: { increment: data.total } },
          });
        }
      },
      { timeout: 15000 },
    );
  } catch (e) {
    return {
      error:
        e instanceof Error && e.name === "ReceiptValidation"
          ? e.message
          : "Barang masuk belum tersimpan. Periksa koneksi dan coba lagi.",
    };
  }
  for (const path of ["/barang-masuk", "/stok-inventory", "/supplier"]) revalidatePath(path);
  return { success: "Barang masuk berhasil disimpan." };
}
