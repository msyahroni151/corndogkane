"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseStockCommand, StockError } from "@/lib/outlet-stock";
import { runStockCommand } from "@/lib/outlet-stock-service";
import type { FormState } from "@/lib/form-state";
export async function manageOutletStock(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("control-stok");
  try {
    await runStockCommand(getPrisma(), user.id, parseStockCommand(form));
  } catch (e) {
    return {
      error:
        e instanceof StockError
          ? e.message
          : "Perubahan stok belum tersimpan. Muat ulang dan coba lagi.",
    };
  }
  for (const path of ["/control-stok", "/stok-inventory", "/setting-menu"]) revalidatePath(path);
  return { success: "Pencatatan stok outlet berhasil disimpan." };
}
