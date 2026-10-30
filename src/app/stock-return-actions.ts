"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { StockError } from "@/lib/outlet-stock";
import { parseReturnCommand } from "@/lib/stock-returns";
import { runReturnCommand } from "@/lib/stock-return-service";
import type { FormState } from "@/lib/form-state";
export async function manageStockReturn(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("control-stok");
  try {
    await runReturnCommand(getPrisma(), user.id, parseReturnCommand(form));
  } catch (error) {
    return {
      error:
        error instanceof StockError
          ? error.message
          : "Retur belum tersimpan. Muat ulang halaman dan coba kembali.",
    };
  }
  for (const path of [
    "/control-stok",
    "/stok-inventory",
    "/menu-utama/dashboard",
    "/produksi-gudang",
  ])
    revalidatePath(path);
  return { success: "Retur barang berhasil diproses." };
}
