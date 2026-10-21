"use server";
import { supplierPaymentMethods } from "@/lib/supplier-options";
import { hasPermission } from "@/lib/permissions";
import { allocateBusinessId } from "@/lib/business-id";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import type { PartnerKind } from "@/generated/prisma/client";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "PartnerValidation";
  throw e;
}
export async function savePartner(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const get = (key: string) => String(form.get(key) || "").trim();
  try {
    const kind = get("kind");
    if (!hasPermission(user, kind === "SUPPLIER" ? "supplier" : "pelanggan"))
      return { error: "Anda tidak memiliki akses ke menu ini." };
    if (!["SUPPLIER", "CUSTOMER"].includes(kind)) invalid("Jenis relasi tidak valid.");
    const name = get("name");
    if (!name || name.length > 150) invalid("Nama wajib diisi, maksimal 150 karakter.");
    for (const [key, max] of [
      ["city", 100],
      ["businessType", 100],
      ["contactPerson", 150],
      ["phone", 40],
      ["address", 1000],
      ["notes", 2000],
    ] as const)
      if (get(key).length > max) invalid(`Isi ${key} maksimal ${max} karakter.`);
    const raw = get("outstandingDebt") || "0";
    if (!/^\d+$/.test(raw) || Number(raw) > 1000000000)
      invalid("Saldo hutang harus rupiah bulat antara 0 dan 1 miliar.");
    if (kind === "CUSTOMER" && Number(raw) !== 0) invalid("Saldo hutang hanya untuk supplier.");
    const defaultPaymentMethod =
      kind === "SUPPLIER" ? get("defaultPaymentMethod") || "TUNAI" : "TUNAI";
    if (!supplierPaymentMethods.includes(defaultPaymentMethod))
      invalid("Metode default harus Tunai, Transfer, atau COD.");
    const data = {
      defaultPaymentMethod,
      name,
      city: get("city") || null,
      businessType: get("businessType") || null,
      contactPerson: get("contactPerson") || null,
      phone: get("phone") || null,
      address: get("address") || null,
      notes: get("notes") || null,
      outstandingDebt: Number(raw),
    };
    await getPrisma().$transaction(
      async (tx) => {
        if (get("id")) {
          await tx.$executeRaw`SELECT id FROM partners WHERE id=${get("id")} FOR UPDATE`;
          const row = await tx.partner.findUnique({ where: { id: get("id") } });
          if (!row || row.kind !== kind) invalid("Relasi tidak ditemukan.");
          if (row.updatedAt.toISOString() !== get("version"))
            invalid(
              "Data sudah diperbarui dari halaman lain. Tutup popup dan muat ulang sebelum mengedit.",
            );
          await tx.partner.update({ where: { id: row.id }, data });
        } else {
          const id = await allocateBusinessId(tx, kind === "SUPPLIER" ? "supplier" : "customer");
          await tx.partner.create({
            data: {
              ...data,
              kind: kind as PartnerKind,
              id,
              createdById: user.id,
            },
          });
        }
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return {
      error:
        e instanceof Error && e.name === "PartnerValidation"
          ? e.message
          : "Data belum tersimpan. Periksa koneksi dan coba lagi.",
    };
  }
  revalidatePath("/supplier");
  revalidatePath("/pelanggan");
  return { success: "Data relasi tersimpan." };
}
