import type { PrismaClient } from "@/generated/prisma/client";
import { inventoryNumber, recipeIngredientAllowed } from "@/lib/inventory";
import { itemKey } from "@/lib/goods-receipts";
import { normalizeStockUnit, validStockUnit } from "@/lib/stock-units";
function invalid(message: string): never {
  const error = new Error(message);
  error.name = "RecipeValidation";
  throw error;
}
function nameOf(value: unknown) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name || name.length > 150) invalid("Nama wajib diisi, maksimal 150 karakter.");
  return name;
}
function unitOf(value: unknown) {
  const unit = normalizeStockUnit(value);
  if (!validStockUnit(unit)) invalid("Isi satuan bahan yang valid.");
  return unit;
}
export async function saveRecipeDefinition(db: PrismaClient, form: FormData, production: boolean) {
  const id = String(form.get("id") || ""),
    version = String(form.get("version") || "");
  const creating = !id;
  if (creating && !production) invalid("Pilih menu jual yang akan diatur resepnya.");
  if (!creating && !version) invalid("Muat ulang resep sebelum menyimpan.");
  const productionYield = production ? inventoryNumber(form.get("productionYield")) : 1;
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("recipe") || "[]"));
  } catch {
    invalid("Data resep tidak valid.");
  }
  if (!Array.isArray(raw) || raw.length > 50 || (creating && !raw.length))
    invalid("Isi komposisi resep, maksimal 50 bahan.");
  const rows = raw.map((row: unknown) => {
    if (!row || typeof row !== "object") invalid("Data bahan tidak valid.");
    const r = row as Record<string, unknown>;
    if (typeof r.ingredientId !== "string" || !r.ingredientId)
      invalid("Pilih atau isi bahan yang valid.");
    const manual = r.ingredientId.startsWith("manual:");
    if (manual && !production)
      invalid("Penambahan bahan manual tersedia pada resep produksi gudang.");
    const manualKind = String(r.manualKind || "RAW");
    if (manual && !["RAW", "SUB"].includes(manualKind)) invalid("Jenis bahan manual tidak valid.");
    return {
      ingredientId: r.ingredientId,
      quantity: inventoryNumber(r.quantity),
      baseUnit: unitOf(r.baseUnit),
      manual,
      manualName: manual ? nameOf(r.manualName) : "",
      manualKind,
    };
  });
  const outputName = creating ? nameOf(form.get("outputName")) : "";
  const outputKind = String(form.get("outputKind") || "SUB");
  const outputUnit = creating ? unitOf(form.get("outputUnit")) : "";
  if (creating && !["SUB", "FINISHED"].includes(outputKind))
    invalid("Pilih jenis hasil produksi gudang.");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
      let output;
      if (creating) {
        const duplicate = await tx.inventoryItem.findUnique({
          where: { key: itemKey(outputName) },
        });
        if (duplicate)
          invalid(
            duplicate.active
              ? "Nama hasil sudah terdaftar. Gunakan Atur Resep pada barang tersebut."
              : "Nama hasil ada di Sampah. Pulihkan barang terlebih dahulu.",
          );
        output = await tx.inventoryItem.create({
          data: {
            name: outputName,
            key: itemKey(outputName),
            kind: outputKind,
            baseUnit: outputUnit,
            packagingUnit: outputUnit,
            category: "Persediaan Gudang",
            active: true,
          },
        });
      } else {
        output = await tx.inventoryItem.findUnique({ where: { id } });
        if (!output || !(production ? ["SUB", "FINISHED"] : ["PRODUCT"]).includes(output.kind))
          invalid("Pilih hasil produksi gudang atau menu jual sesuai halaman resepnya.");
        if (output.updatedAt.toISOString() !== version)
          invalid("Data resep / produk sudah berubah. Tutup popup dan muat ulang halaman.");
      }
      const resolved = [];
      for (const r of rows) {
        let ingredient = r.manual
          ? await tx.inventoryItem.findUnique({ where: { key: itemKey(r.manualName) } })
          : await tx.inventoryItem.findUnique({ where: { id: r.ingredientId } });
        if (r.manual && !ingredient)
          ingredient = await tx.inventoryItem.create({
            data: {
              name: r.manualName,
              key: itemKey(r.manualName),
              kind: r.manualKind,
              baseUnit: r.baseUnit,
              packagingUnit: r.baseUnit,
              category: "Persediaan Gudang",
              active: true,
            },
          });
        if (
          !ingredient?.active ||
          ingredient.id === output.id ||
          !recipeIngredientAllowed(output.kind, ingredient.kind)
        )
          invalid(
            "Gunakan bahan aktif sesuai tahap produksi. Hasil setengah jadi memakai bahan mentah; hasil jadi dapat memakai bahan mentah atau setengah jadi.",
          );
        if (r.manual && ingredient.kind !== r.manualKind)
          invalid(
            "Jenis bahan " +
              ingredient.name +
              " berbeda dari barang yang sudah terdaftar. Pilih barang yang tersedia.",
          );
        if (ingredient.baseUnit !== r.baseUnit)
          invalid(
            "Gunakan satuan " +
              ingredient.baseUnit.toLowerCase() +
              " untuk " +
              ingredient.name +
              ".",
          );
        resolved.push({
          ingredientId: ingredient.id,
          quantity: r.quantity,
          baseUnit: r.baseUnit,
          outputId: output.id,
        });
      }
      if (new Set(resolved.map((r) => r.ingredientId)).size !== resolved.length)
        invalid("Bahan yang sama cukup dicantumkan sekali.");
      await tx.inventoryRecipe.deleteMany({ where: { outputId: output.id } });
      if (resolved.length) await tx.inventoryRecipe.createMany({ data: resolved });
      await tx.inventoryItem.update({
        where: { id: output.id },
        data: { updatedAt: new Date(), productionYield },
      });
      return output.id;
    },
    { timeout: 20000 },
  );
}
