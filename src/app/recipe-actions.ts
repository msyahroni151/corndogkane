"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { saveRecipeDefinition, deleteRecipeDefinition } from "@/lib/recipe-settings";
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

export async function deleteRecipe(_: FormState, form: FormData): Promise<FormState> {
  const production = form.get("scope") === "production";
  await requireAccess(production ? "produksi-gudang" : "setting-menu");
  try {
    await deleteRecipeDefinition(
      getPrisma(),
      String(form.get("id") || "").trim(),
      String(form.get("version") || "").trim(),
      production,
    );
  } catch (e) {
    return {
      error:
        e instanceof Error && e.name === "RecipeValidation"
          ? e.message
          : "Resep belum terhapus. Periksa koneksi dan coba lagi.",
    };
  }
  for (const path of [
    "/setting-menu",
    "/produksi-gudang",
    "/stok-inventory",
    "/pos",
    "/control-stok",
    "/menu-utama/dashboard",
  ])
    revalidatePath(path);
  return { success: "Komposisi resep berhasil dihapus. Barang dan stok tetap tersimpan." };
}
