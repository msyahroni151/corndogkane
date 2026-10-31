"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  saveProductionPlan,
  changeProductionPlan,
  ProductionPlanError,
} from "@/lib/production-plans";
import type { FormState } from "@/lib/form-state";
export async function savePlan(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("produksi-gudang"),
    get = (k: string) => String(form.get(k) || "").trim();
  try {
    await saveProductionPlan(getPrisma(), user.id, {
      id: get("id") || undefined,
      version: get("version"),
      postingKey: get("postingKey"),
      itemId: get("itemId"),
      date: get("date"),
      quantity: get("quantity"),
      notes: get("notes"),
    });
  } catch (e) {
    return {
      error:
        e instanceof ProductionPlanError
          ? e.message
          : "Rencana belum tersimpan. Periksa tanggal dan data input.",
    };
  }
  revalidatePath("/produksi-gudang");
  return { success: "Rencana produksi berhasil disimpan. Stok belum dikurangi." };
}
export async function updatePlan(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("produksi-gudang"),
    get = (k: string) => String(form.get(k) || "").trim();
  try {
    await changeProductionPlan(getPrisma(), user.id, get("id"), get("version"), get("intent"));
  } catch (e) {
    return {
      error: e instanceof ProductionPlanError ? e.message : "Status rencana belum tersimpan.",
    };
  }
  revalidatePath("/produksi-gudang");
  return { success: "Status rencana diperbarui." };
}
