"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { saveRecipeDefinition } from "@/lib/recipe-settings";
import type { FormState } from "@/lib/form-state";
export async function saveRecipe(_: FormState, form: FormData): Promise<FormState> {
  const production = form.get("scope") === "production";
  await requireAccess(production ? "produksi-gudang" : "setting-menu");
  try {
    await saveRecipeDefinition(getPrisma(), form, production);
  } catch (e) {
    if (e instanceof Error && e.name === "RecipeValidation") return { error: e.message };
    return { error: "Resep belum tersimpan. Periksa isian dan koneksi lalu coba lagi." };
  }
  for (const path of ["/setting-menu", "/produksi-gudang", "/stok-inventory", "/barang-masuk"])
    revalidatePath(path);
  return { success: "Resep berhasil disimpan. Stok tidak berubah." };
}
