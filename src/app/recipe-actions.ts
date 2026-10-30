"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { inventoryNumber, recipeIngredientAllowed } from "@/lib/inventory";
import type { FormState } from "@/lib/form-state";
function invalid(message: string): never {
  const error = new Error(message);
  error.name = "RecipeValidation";
  throw error;
}
export async function saveRecipe(_: FormState, form: FormData): Promise<FormState> {
  const production = form.get("scope") === "production";
  await requireAccess(production ? "produksi-gudang" : "setting-menu");
  const id = String(form.get("id") || ""),
    version = String(form.get("version") || "");
  let productionYield = 1;
  let rows: { ingredientId: string; quantity: number; baseUnit: string }[];
  try {
    if (production) productionYield = inventoryNumber(form.get("productionYield"));
    const raw: unknown = JSON.parse(String(form.get("recipe") || "[]"));
    if (!id || !version || !Array.isArray(raw) || raw.length > 50)
      invalid("Pilih produk dan batasi resep hingga 50 bahan.");
    rows = raw.map((r) => {
      if (
        !r ||
        typeof r.ingredientId !== "string" ||
        !r.ingredientId ||
        typeof r.baseUnit !== "string"
      )
        invalid("Pilih bahan yang valid.");
      return {
        ingredientId: r.ingredientId,
        baseUnit: r.baseUnit,
        quantity: inventoryNumber(r.quantity),
      };
    });
    if (new Set(rows.map((r) => r.ingredientId)).size !== rows.length)
      invalid("Bahan yang sama cukup dicantumkan sekali.");
  } catch (e) {
    return { error: e instanceof SyntaxError ? "Data resep tidak valid." : (e as Error).message };
  }
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inventory-write"}))`;
        const output = await tx.inventoryItem.findUnique({ where: { id } });
        if (!output || !(production ? ["SUB", "FINISHED"] : ["PRODUCT"]).includes(output.kind))
          invalid("Pilih hasil produksi gudang atau menu jual sesuai halaman resepnya.");
        if (output.updatedAt.toISOString() !== version)
          invalid("Data resep / produk sudah berubah. Tutup popup dan muat ulang halaman.");
        const ingredients = await tx.inventoryItem.findMany({
          where: { id: { in: rows.map((r) => r.ingredientId) } },
        });
        for (const r of rows) {
          const ingredient = ingredients.find((i) => i.id === r.ingredientId);
          if (
            !ingredient?.active ||
            ingredient.id === id ||
            !recipeIngredientAllowed(output.kind, ingredient.kind)
          )
            invalid(
              output.kind === "SUB"
                ? "Resep gudang harus memakai bahan baku aktif."
                : "Gunakan bahan stok aktif sesuai tahap produksinya. Produk jual dapat memakai bahan mentah, setengah jadi, atau bahan jadi.",
            );
          if (ingredient.baseUnit !== r.baseUnit)
            invalid("Gunakan satuan stok yang sesuai untuk " + ingredient.name + ".");
        }
        await tx.inventoryRecipe.deleteMany({ where: { outputId: id } });
        if (rows.length)
          await tx.inventoryRecipe.createMany({ data: rows.map((r) => ({ ...r, outputId: id })) });
        await tx.inventoryItem.update({
          where: { id },
          data: { updatedAt: new Date(), productionYield: production ? productionYield : 1 },
        });
      },
      { timeout: 15000 },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "RecipeValidation") return { error: e.message };
    return { error: "Resep belum tersimpan. Muat ulang halaman dan coba lagi." };
  }
  for (const path of ["/setting-menu", "/produksi-gudang", "/stok-inventory"]) revalidatePath(path);
  return { success: "Resep berhasil disimpan." };
}
