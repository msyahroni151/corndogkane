"use server";
import { registerProductionRemainder, consumeRemainder } from "@/lib/production-remainders";
import { runInventoryItemLifecycle } from "@/lib/inventory-item-lifecycle";
import { normalizeStockUnit, validStockUnit } from "@/lib/stock-units";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { itemKey } from "@/lib/goods-receipts";
import { todayWib, parseCivilDate } from "@/lib/placements";
import {
  catalogKinds,
  warehouseKinds,
  recipeIngredientAllowed,
  inventoryNumber,
  inventoryRound,
  changedBatch,
} from "@/lib/inventory";
import type { FormState } from "@/lib/form-state";
import type { Prisma } from "@/generated/prisma/client";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "InventoryValidation";
  throw e;
}
function failure(e: unknown): FormState {
  return {
    error:
      e instanceof Error && e.name === "InventoryValidation"
        ? e.message
        : "Data inventori belum tersimpan. Periksa koneksi dan coba lagi.",
  };
}
function refresh() {
  revalidatePath("/stok-inventory");
  revalidatePath("/setting-menu");
  revalidatePath("/produksi-gudang");
  revalidatePath("/barang-masuk");
  revalidatePath("/control-stok");
}
function actionData(form: FormData) {
  const get = (key: string) => String(form.get(key) || "").trim(),
    postingKey = get("postingKey"),
    date = get("date") || todayWib(),
    notes = get("notes");
  if (!/^[a-f0-9-]{36}$/i.test(postingKey))
    throw Error("Tutup dan buka kembali form sebelum menyimpan.");
  parseCivilDate(date);
  if (date > todayWib()) throw Error("Tanggal tidak boleh melewati hari ini.");
  if (notes.length > 2000) throw Error("Catatan maksimal 2.000 karakter.");
  return { get, postingKey, date, notes };
}
async function previous(tx: Prisma.TransactionClient, postingKey: string, requestHash: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
  const row = await tx.inventoryOperation.findUnique({ where: { postingKey } });
  if (row && row.requestHash !== requestHash)
    invalid("Form ini sudah disimpan dengan data berbeda. Buka form baru.");
  return row;
}
export async function saveInventoryItem(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess(
    String(form.get("catalogScope")) === "warehouse" ||
      String(form.get("kind")) === "RAW" ||
      String(form.get("kind")) === "FINISHED"
      ? "stok-inventory"
      : "setting-menu",
  );
  void user;
  const get = (key: string) => String(form.get(key) || "").trim();
  let minimumStock: number, sellingPrice: number, standardCost: number;
  const name = get("name").replace(/\s+/g, " "),
    key = itemKey(name),
    kind = get("kind"),
    baseUnit = normalizeStockUnit(get("baseUnit")),
    category = get("catalogScope") === "warehouse" ? "Persediaan Gudang" : get("category"),
    emoji = get("catalogScope") === "warehouse" ? "" : get("emoji");
  try {
    if (
      !name ||
      (get("catalogScope") === "warehouse" && !warehouseKinds.some((k) => k === kind)) ||
      name.length > 150 ||
      !catalogKinds.includes(kind as (typeof catalogKinds)[number]) ||
      !validStockUnit(baseUnit)
    )
      throw Error("Nama, jenis barang, dan satuan wajib diisi dengan benar.");
    if (category.length > 100 || emoji.length > 20)
      throw Error("Kategori maksimal 100 karakter dan emoji maksimal 20 karakter.");
    minimumStock = inventoryNumber(get("minimumStock") || "0", true);
    const money = (value: string) => {
      if (!/^\d{1,10}$/.test(value) || Number(value) > 1_000_000_000)
        throw Error("Harga harus rupiah bulat antara 0 dan 1 miliar.");
      return Number(value);
    };
    sellingPrice = money(get("sellingPrice") || "0");
    standardCost = money(get("standardCost") || "0");
  } catch (e) {
    return { error: e instanceof SyntaxError ? "Data resep tidak valid." : (e as Error).message };
  }
  let photo: string | undefined;
  try {
    const upload = form.get("photo");
    if (get("catalogScope") !== "warehouse" && upload instanceof File && upload.size > 0) {
      if (upload.size > 256 * 1024)
        return { error: "Foto maksimal 256 KB (PNG, JPEG, atau WebP)." };
      const bytes = Buffer.from(await upload.arrayBuffer());
      const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
        webp =
          bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
      if (!png && !jpeg && !webp) return { error: "Gunakan foto PNG, JPEG, atau WebP yang valid." };
      photo =
        "data:" +
        (png ? "image/png" : jpeg ? "image/jpeg" : "image/webp") +
        ";base64," +
        bytes.toString("base64");
    }
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
        const current = get("id")
          ? await tx.inventoryItem.findUnique({ where: { id: get("id") } })
          : null;
        if (get("id") && (!current || current.updatedAt.toISOString() !== get("version")))
          invalid("Data barang sudah berubah. Tutup form dan muat ulang sebelum mengedit.");
        if (
          current &&
          current.baseUnit !== baseUnit &&
          ((await tx.outletStock.count({ where: { itemId: current.id } })) > 0 ||
            (await tx.outletStockOrderLine.count({ where: { itemId: current.id } })) > 0)
        )
          invalid(
            "Satuan barang yang sudah dipakai dalam stok / permintaan outlet tidak dapat diubah.",
          );
        if (
          current &&
          current.baseUnit !== baseUnit &&
          (await tx.inventoryRecipe.count({
            where: { OR: [{ outputId: current.id }, { ingredientId: current.id }] },
          })) > 0
        )
          invalid(
            "Satuan barang yang sudah dipakai dalam resep tidak dapat diubah. Atur ulang resep terlebih dahulu.",
          );
        const duplicate = await tx.inventoryItem.findUnique({ where: { key } });
        if (duplicate && duplicate.id !== current?.id)
          invalid(
            duplicate.active
              ? "Nama barang ini sudah terdaftar. Gunakan nama lain atau edit barang yang sudah ada."
              : "Nama barang ini tersimpan di Sampah. Buka filter Sampah untuk mengembalikan bahan.",
          );
        if (current && current.kind !== kind)
          invalid("Jenis barang tidak dapat diubah setelah dibuat.");
        if (
          current &&
          current.baseUnit !== baseUnit &&
          (await tx.inventoryBatch.count({ where: { itemId: current.id } })) > 0
        )
          invalid("Satuan barang yang sudah memiliki batch tidak dapat diubah.");
        const data = {
          name,
          key,
          kind,
          category: category || "Lainnya",
          baseUnit,
          minimumStock,
          active:
            get("catalogScope") === "warehouse"
              ? (current?.active ?? true)
              : get("active") === "true",
          emoji,
          sellingPrice,
          standardCost,
          ...(photo ? { photo } : {}),
          ...(get("catalogScope") !== "warehouse" && get("removePhoto") === "true"
            ? { photo: null }
            : {}),
        };
        if (current) await tx.inventoryItem.update({ where: { id: current.id }, data });
        else await tx.inventoryItem.create({ data: { ...data, packagingUnit: baseUnit } });
      },
      { timeout: 20000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { success: "Data barang berhasil disimpan." };
}
export async function reclassifyWarehouseStock(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("stok-inventory");
  let data: ReturnType<typeof actionData>, id: string, version: string, name: string;
  try {
    data = actionData(form);
    id = data.get("id");
    version = data.get("version");
    name = data.get("warehouseName").replace(/\s+/g, " ");
    if (!id || !version || !name || name.length > 150)
      throw Error("Isi nama barang gudang, maksimal 150 karakter.");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ actorId: user.id, id, version, name, date: data.date }))
    .digest("hex");
  try {
    await getPrisma().$transaction(
      async (tx) => {
        if (await previous(tx, data.postingKey, requestHash)) return;
        const old = await tx.inventoryItem.findUnique({
          where: { id },
          include: { batches: { include: { sourceLine: true } } },
        });
        if (
          !old ||
          old.kind !== "PRODUCT" ||
          old.updatedAt.toISOString() !== version ||
          !old.batches.length
        )
          invalid("Stok lama sudah berubah. Muat ulang halaman sebelum memisahkan.");
        if (
          old.batches.some(
            (b) => b.baseUnit !== old.baseUnit || (b.sourceLine && b.sourceLine.itemId !== old.id),
          )
        )
          invalid("Satuan atau sumber batch lama perlu diperiksa sebelum dipisahkan.");
        if (
          (await tx.outletStock.count({ where: { itemId: id } })) ||
          (await tx.outletStockOrderLine.count({ where: { itemId: id } }))
        )
          invalid(
            "Barang ini sudah terhubung ke stok outlet. Periksa hubungan stok sebelum memisahkan.",
          );
        const key = itemKey(name);
        if (await tx.inventoryItem.findUnique({ where: { key } }))
          invalid("Nama barang gudang sudah digunakan. Pilih nama lain.");
        const stock = await tx.inventoryItem.create({
          data: {
            key,
            name,
            kind: "FINISHED",
            category: "Persediaan Gudang",
            baseUnit: old.baseUnit,
            packagingUnit: old.packagingUnit,
            active: old.active,
            minimumStock: old.minimumStock,
            emoji: old.emoji,
            photo: old.photo,
          },
        });
        const operation = await tx.inventoryOperation.create({
          data: {
            postingKey: data.postingKey,
            requestHash,
            kind: "CLASSIFY",
            date: parseCivilDate(data.date),
            notes: `Pisahkan stok lama dari menu ${old.name} (${old.id}) menjadi ${stock.name} (${stock.id}). Jumlah dan nilai batch tetap; menu jual dan resep tidak diubah.`,
            createdById: user.id,
          },
        });
        for (const batch of old.batches) {
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: { itemId: stock.id, version: { increment: 1 } },
          });
          if (batch.sourceLineId)
            await tx.goodsReceiptLine.update({
              where: { id: batch.sourceLineId },
              data: { itemId: stock.id },
            });
          await tx.inventoryMovement.create({
            data: {
              operationId: operation.id,
              batchId: batch.id,
              quantityBefore: batch.remainingQuantity,
              quantityAfter: batch.remainingQuantity,
              valueBefore: batch.remainingValue,
              valueAfter: batch.remainingValue,
            },
          });
        }
        await tx.inventoryItem.update({ where: { id: old.id }, data: { updatedAt: new Date() } });
      },
      { timeout: 20000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  revalidatePath("/control-stok");
  return { success: "Stok lama berhasil dipisahkan menjadi bahan jadi gudang." };
}

export async function adjustInventory(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("stok-inventory");
  let data: ReturnType<typeof actionData>,
    kind: string,
    rows: { batchId: string; version: number; quantity: number }[];
  try {
    data = actionData(form);
    kind = data.get("kind");
    if (!["PREP", "LOSS", "DAILY", "ADJUST", "OPNAME"].includes(kind))
      throw Error("Jenis koreksi tidak valid.");
    if (!data.notes) throw Error("Isi alasan atau catatan koreksi untuk riwayat inventori.");
    const raw: unknown = JSON.parse(data.get("rows") || "[]");
    if (!Array.isArray(raw) || !raw.length || raw.length > 500)
      throw Error("Pilih 1 sampai 500 batch untuk diperiksa.");
    rows = raw.map((row) => {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.batchId !== "string" ||
        !Number.isSafeInteger(row.version) ||
        row.version < 0
      )
        throw Error("Batch tidak valid. Muat ulang form.");
      return {
        batchId: row.batchId,
        version: row.version,
        quantity: inventoryNumber(row.quantity, kind === "ADJUST" || kind === "OPNAME"),
      };
    });
    if (new Set(rows.map((row) => row.batchId)).size !== rows.length)
      throw Error("Batch yang sama tidak boleh dipilih dua kali.");
  } catch (e) {
    return { error: e instanceof SyntaxError ? "Data koreksi tidak valid." : (e as Error).message };
  }
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        kind,
        postingKey: data.postingKey,
        date: data.date,
        notes: data.notes,
        rows,
      }),
    )
    .digest("hex");
  try {
    await getPrisma().$transaction(
      async (tx) => {
        if (await previous(tx, data.postingKey, requestHash)) return;
        const batches = await tx.inventoryBatch.findMany({
          where: { id: { in: rows.map((row) => row.batchId) } },
          include: {
            movements: {
              include: { operation: { select: { date: true } } },
              orderBy: { operation: { date: "desc" } },
              take: 1,
            },
          },
        });
        const operation = await tx.inventoryOperation.create({
          data: {
            postingKey: data.postingKey,
            requestHash,
            kind,
            date: parseCivilDate(data.date),
            notes: data.notes,
            createdById: user.id,
          },
        });
        for (const row of rows) {
          const batch = batches.find((batch) => batch.id === row.batchId);
          if (!batch || batch.version !== row.version)
            invalid(
              "Stok berubah sejak form dibuka. Tutup dan buka form kembali sebelum menyimpan.",
            );
          if (
            data.date < batch.receivedAt.toISOString().slice(0, 10) ||
            batch.movements.some((m) => m.operation.date.toISOString().slice(0, 10) > data.date)
          )
            invalid(
              "Tanggal koreksi tidak boleh mendahului penerimaan atau perubahan stok terakhir.",
            );
          let next: ReturnType<typeof changedBatch>;
          try {
            next = changedBatch(
              kind,
              Number(batch.remainingQuantity),
              Number(batch.remainingValue),
              row.quantity,
              Number(batch.initialQuantity),
              Number(batch.initialValue),
            );
          } catch (e) {
            invalid((e as Error).message);
          }
          await tx.inventoryMovement.create({
            data: {
              operationId: operation.id,
              batchId: batch.id,
              quantityBefore: batch.remainingQuantity,
              quantityAfter: next.after,
              valueBefore: batch.remainingValue,
              valueAfter: next.value,
            },
          });
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              remainingQuantity: next.after,
              remainingValue: next.value,
              version: { increment: 1 },
            },
          });
        }
      },
      { timeout: 30000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  return {
    success:
      kind === "OPNAME"
        ? "Hasil hitung stok berhasil disimpan."
        : "Koreksi stok berhasil disimpan.",
  };
}
export async function produceInventory(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("produksi-gudang");
  let data: ReturnType<typeof actionData>, itemId: string, quantity: number, batchCount: number;
  try {
    data = actionData(form);
    itemId = data.get("itemId");
    quantity = inventoryNumber(data.get("quantity"));
    batchCount = inventoryNumber(data.get("batchCount"));
    if (!itemId) throw Error("Pilih barang hasil produksi gudang.");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        postingKey: data.postingKey,
        date: data.date,
        notes: data.notes,
        itemId,
        quantity,
        batchCount,
        reuseBatchId: data.get("reuseBatchId"),
        reuseVersion: data.get("reuseVersion"),
        reuseQuantity: data.get("reuseQuantity"),
        recipeVersion: data.get("recipeVersion"),
        planId: data.get("planId"),
        planVersion: data.get("planVersion"),
      }),
    )
    .digest("hex");
  try {
    await getPrisma().$transaction(
      async (tx) => {
        if (await previous(tx, data.postingKey, requestHash)) return;
        const planId = data.get("planId");
        if (planId) {
          await tx.$executeRaw`SELECT id FROM production_plans WHERE id=${planId} FOR UPDATE`;
          const plan = await tx.productionPlan.findUnique({ where: { id: planId } });
          if (
            !plan ||
            !["PLANNED", "IN_PROGRESS"].includes(plan.status) ||
            plan.itemId !== itemId ||
            plan.updatedAt.toISOString() !== data.get("planVersion")
          )
            invalid(
              "Rencana berubah atau sudah selesai. Buka kembali rencana produksi sebelum mencatat hasil.",
            );
        }
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemId },
          include: { recipe: { include: { ingredient: true } } },
        });
        if (!item || !item.active || !["SUB", "FINISHED"].includes(item.kind))
          invalid("Pilih bahan setengah jadi atau bahan jadi aktif yang terdaftar.");
        if (item.updatedAt.toISOString() !== data.get("recipeVersion"))
          invalid("Resep berubah sejak form dibuka. Tutup dan buka kembali form produksi.");
        if (!item.recipe.length)
          invalid(
            "Atur resep hasil produksi terlebih dahulu melalui Produksi Gudang / Resep Produksi.",
          );
        if (
          item.recipe.some(
            (row) =>
              !recipeIngredientAllowed(item.kind, row.ingredient.kind) ||
              row.baseUnit !== row.ingredient.baseUnit,
          )
        )
          invalid(
            "Satuan atau jenis bahan pada resep tidak sesuai. Perbarui melalui Resep Produksi.",
          );
        if (item.recipe.some((row) => !row.ingredient.active))
          invalid(
            "Resep mengandung bahan di Sampah. Kembalikan bahan atau perbarui resep sebelum memproduksi.",
          );
        const operation = await tx.inventoryOperation.create({
          data: {
            postingKey: data.postingKey,
            requestHash,
            kind: "PRODUCTION",
            date: parseCivilDate(data.date),
            notes:
              `Produksi ${item.name}; ${batchCount} batch; hasil standar ${inventoryRound(batchCount * Number(item.productionYield))} ${item.baseUnit.toLowerCase()}; hasil aktual ${quantity} ${item.baseUnit.toLowerCase()}.` +
              (data.notes ? "\n" + data.notes : ""),
            createdById: user.id,
          },
        });
        let outputValue = 0;
        for (const component of item.recipe) {
          let needed = inventoryRound(batchCount * Number(component.quantity));
          if (needed <= 0 || needed > 1_000_000_000)
            invalid("Jumlah kebutuhan bahan terlalu kecil atau terlalu besar.");
          const batches = await tx.inventoryBatch.findMany({
            where: {
              itemId: component.ingredientId,
              baseUnit: component.baseUnit,
              receivedAt: { lte: parseCivilDate(data.date) },
              remainingQuantity: { gt: 0 },
            },
            include: {
              movements: {
                include: { operation: { select: { date: true } } },
                orderBy: { operation: { date: "desc" } },
                take: 1,
              },
            },
            orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          });
          if (
            inventoryRound(batches.reduce((sum, b) => sum + Number(b.remainingQuantity), 0)) <
            needed
          )
            invalid(
              "Stok " +
                component.ingredient.name +
                " tidak cukup untuk produksi ini (" +
                component.baseUnit.toLowerCase() +
                ").",
            );
          for (const batch of batches) {
            if (needed <= 0) break;
            if (
              batch.movements.some((m) => m.operation.date.toISOString().slice(0, 10) > data.date)
            )
              invalid("Tanggal produksi mendahului perubahan stok bahan terakhir.");
            const take = Math.min(needed, Number(batch.remainingQuantity)),
              next = changedBatch(
                "LOSS",
                Number(batch.remainingQuantity),
                Number(batch.remainingValue),
                take,
                Number(batch.initialQuantity),
                Number(batch.initialValue),
              );
            outputValue = inventoryRound(
              outputValue + Number(batch.remainingValue) - next.value,
              4,
            );
            await tx.inventoryMovement.create({
              data: {
                operationId: operation.id,
                batchId: batch.id,
                quantityBefore: batch.remainingQuantity,
                quantityAfter: next.after,
                valueBefore: batch.remainingValue,
                valueAfter: next.value,
              },
            });
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: {
                remainingQuantity: next.after,
                remainingValue: next.value,
                version: { increment: 1 },
              },
            });
            needed = inventoryRound(needed - take);
          }
        }
        if (data.get("reuseBatchId")) {
          outputValue = inventoryRound(
            outputValue +
              (await consumeRemainder(tx, {
                batchId: data.get("reuseBatchId"),
                version: Number(data.get("reuseVersion")),
                itemId: item.id,
                quantity: inventoryNumber(data.get("reuseQuantity")),
                date: data.date,
                operationId: operation.id,
              })),
            4,
          );
        } else if (Number(data.get("reuseQuantity") || "0") !== 0)
          invalid("Pilih batch sisa yang akan digunakan.");
        if (outputValue > 1_000_000_000) invalid("Nilai produksi maksimal Rp1 miliar.");
        const output = await tx.inventoryBatch.create({
          data: {
            itemId: item.id,
            productionId: operation.id,
            receivedAt: parseCivilDate(data.date),
            baseUnit: item.baseUnit,
            initialQuantity: quantity,
            remainingQuantity: quantity,
            initialValue: outputValue,
            remainingValue: outputValue,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            operationId: operation.id,
            batchId: output.id,
            quantityBefore: 0,
            quantityAfter: quantity,
            valueBefore: 0,
            valueAfter: outputValue,
          },
        });
        if (planId)
          await tx.productionPlan.update({
            where: { id: planId },
            data: { status: "COMPLETED", operationId: operation.id, updatedById: user.id },
          });
      },
      { timeout: 30000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { success: "Produksi gudang berhasil disimpan." };
}

export async function changeInventoryItemStatus(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("stok-inventory");
  try {
    const { get, postingKey, date } = actionData(form);
    await runInventoryItemLifecycle(getPrisma(), user.id, {
      id: get("id"),
      version: get("version"),
      operation: get("operation"),
      postingKey,
      date,
      confirmationName: get("confirmationName"),
    });
    refresh();
    return { success: "Status bahan berhasil diperbarui." };
  } catch (e) {
    return failure(e);
  }
}

export async function saveProductionRemainder(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("produksi-gudang");
  try {
    const { get, postingKey, date, notes } = actionData(form);
    await registerProductionRemainder(getPrisma(), user.id, {
      sourceBatchId: get("sourceBatchId"),
      version: Number(get("version")),
      quantity: inventoryNumber(get("quantity")),
      date,
      location: get("location"),
      notes,
      postingKey,
    });
    refresh();
    return { success: "Sisa produksi berhasil dicatat." };
  } catch (e) {
    return failure(e);
  }
}
