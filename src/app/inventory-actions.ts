"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { itemKey } from "@/lib/goods-receipts";
import { todayWib, parseCivilDate } from "@/lib/placements";
import {
  catalogKinds,
  stockUnits,
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
  revalidatePath("/barang-masuk");
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
  const user = await requireAccess("stok-inventory");
  void user;
  const get = (key: string) => String(form.get(key) || "").trim();
  let minimumStock: number,
    sellingPrice: number,
    standardCost: number,
    recipe: { ingredientId: string; quantity: number; baseUnit: string }[];
  const name = get("name").replace(/\s+/g, " "),
    key = itemKey(name),
    kind = get("kind"),
    baseUnit = get("baseUnit"),
    category = get("category"),
    emoji = get("emoji");
  try {
    if (
      !name ||
      name.length > 150 ||
      !catalogKinds.includes(kind as (typeof catalogKinds)[number]) ||
      !stockUnits.includes(baseUnit as (typeof stockUnits)[number])
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
    const raw: unknown = kind === "SUB" ? JSON.parse(get("recipe") || "[]") : [];
    if (!Array.isArray(raw) || raw.length > 50) throw Error("Resep maksimal 50 bahan.");
    recipe = raw.map((row) => {
      if (!row || typeof row !== "object") throw Error("Resep tidak valid.");
      const ingredientId = String(row.ingredientId || ""),
        unit = String(row.baseUnit || "");
      if (!ingredientId || !stockUnits.includes(unit as (typeof stockUnits)[number]))
        throw Error("Pilih bahan dan satuan resep yang valid.");
      return { ingredientId, baseUnit: unit, quantity: inventoryNumber(row.quantity) };
    });
    if (new Set(recipe.map((row) => row.ingredientId + ":" + row.baseUnit)).size !== recipe.length)
      throw Error("Bahan dan satuan yang sama cukup dicantumkan sekali di resep.");
  } catch (e) {
    return { error: e instanceof SyntaxError ? "Data resep tidak valid." : (e as Error).message };
  }
  let photo: string | undefined;
  try {
    const upload = form.get("photo");
    if (upload instanceof File && upload.size > 0) {
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
        const duplicate = await tx.inventoryItem.findUnique({ where: { key } });
        if (duplicate && duplicate.id !== current?.id)
          invalid(
            "Nama barang ini sudah terdaftar. Gunakan nama lain atau edit barang yang sudah ada.",
          );
        if (current && current.kind !== kind)
          invalid("Jenis barang tidak dapat diubah setelah dibuat.");
        if (
          current &&
          current.baseUnit !== baseUnit &&
          (current.kind === "SUB" || current.kind === "PRODUCT") &&
          (await tx.inventoryBatch.count({ where: { itemId: current.id } })) > 0
        )
          invalid("Satuan produk yang sudah memiliki batch tidak dapat diubah.");
        const ingredients = await tx.inventoryItem.findMany({
          where: { id: { in: recipe.map((row) => row.ingredientId) } },
        });
        if (
          recipe.some(
            (row) =>
              !ingredients.some(
                (item) => item.id === row.ingredientId && item.kind === "RAW" && item.active,
              ),
          )
        )
          invalid("Resep harus memakai bahan baku aktif yang terdaftar.");
        const data = {
          name,
          key,
          kind,
          category: category || "Lainnya",
          baseUnit,
          minimumStock,
          active: get("active") === "true",
          emoji,
          sellingPrice,
          standardCost,
          ...(photo ? { photo } : {}),
          ...(get("removePhoto") === "true" ? { photo: null } : {}),
        };
        const item = current
          ? await tx.inventoryItem.update({ where: { id: current.id }, data })
          : await tx.inventoryItem.create({ data: { ...data, packagingUnit: baseUnit } });
        await tx.inventoryRecipe.deleteMany({ where: { outputId: item.id } });
        if (recipe.length)
          await tx.inventoryRecipe.createMany({
            data: recipe.map((row) => ({ ...row, outputId: item.id })),
          });
      },
      { timeout: 20000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { success: "Data barang berhasil disimpan." };
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
  const user = await requireAccess("stok-inventory");
  let data: ReturnType<typeof actionData>, itemId: string, quantity: number;
  try {
    data = actionData(form);
    itemId = data.get("itemId");
    quantity = inventoryNumber(data.get("quantity"));
    if (!itemId) throw Error("Pilih sub-produk yang ingin diproduksi.");
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
      }),
    )
    .digest("hex");
  try {
    await getPrisma().$transaction(
      async (tx) => {
        if (await previous(tx, data.postingKey, requestHash)) return;
        const item = await tx.inventoryItem.findUnique({
          where: { id: itemId },
          include: { recipe: { include: { ingredient: true } } },
        });
        if (!item || !item.active || item.kind !== "SUB")
          invalid("Pilih sub-produk aktif yang terdaftar.");
        if (item.updatedAt.toISOString() !== data.get("recipeVersion"))
          invalid("Resep berubah sejak form dibuka. Tutup dan buka kembali form produksi.");
        if (!item.recipe.length)
          invalid("Atur resep bahan baku sub-produk terlebih dahulu melalui Edit Sub Produk.");
        if (item.recipe.some((row) => !row.ingredient.active))
          invalid("Resep mengandung bahan nonaktif. Perbarui resep sebelum memproduksi.");
        const operation = await tx.inventoryOperation.create({
          data: {
            postingKey: data.postingKey,
            requestHash,
            kind: "PRODUCTION",
            date: parseCivilDate(data.date),
            notes: data.notes || "Produksi " + item.name,
            createdById: user.id,
          },
        });
        let outputValue = 0;
        for (const component of item.recipe) {
          let needed = inventoryRound(quantity * Number(component.quantity));
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
      },
      { timeout: 30000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { success: "Produksi sub-produk berhasil disimpan." };
}
