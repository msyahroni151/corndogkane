"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseReceiptSettings, receiptKinds, type ReceiptKind } from "@/lib/receipt-templates";
import type { FormState } from "@/lib/form-state";
export async function saveReceiptTemplate(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("template-struk"),
    get = (key: string) => String(form.get(key) || "").trim(),
    kind = get("kind"),
    scope = get("scope"),
    version = get("revision");
  let settings;
  try {
    if (
      !receiptKinds.includes(kind as ReceiptKind) ||
      !scope ||
      scope.length > 100 ||
      !/^\d+$/.test(version) ||
      !Number.isSafeInteger(Number(version))
    )
      throw Error("Pilihan template tidak valid.");
    const raw = get("settings");
    if (raw.length > 16000) throw Error("Pengaturan template terlalu panjang.");
    settings = parseReceiptSettings(JSON.parse(raw));
  } catch (e) {
    return {
      error: e instanceof SyntaxError ? "Pengaturan template tidak valid." : (e as Error).message,
    };
  }
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"receipt-template:" + scope + ":" + kind}))`;
        if (
          scope !== "GLOBAL" &&
          !(await tx.outlet.findUnique({ where: { id: scope }, select: { id: true } }))
        )
          throw Error("OUTLET_MISSING");
        const current = await tx.receiptTemplate.findUnique({
          where: { scope_kind: { scope, kind } },
        });
        if ((current?.revision || 0) !== Number(version)) throw Error("TEMPLATE_CHANGED");
        if (current)
          await tx.receiptTemplate.update({
            where: { id: current.id },
            data: { settings, revision: { increment: 1 }, updatedById: user.id },
          });
        else
          await tx.receiptTemplate.create({
            data: {
              id: scope + ":" + kind,
              scope,
              kind,
              outletId: scope === "GLOBAL" ? null : scope,
              settings,
              updatedById: user.id,
            },
          });
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return {
      error:
        e instanceof Error && e.message === "TEMPLATE_CHANGED"
          ? "Template sudah diperbarui dari halaman lain. Muat ulang sebelum menyimpan."
          : e instanceof Error && e.message === "OUTLET_MISSING"
            ? "Outlet tidak ditemukan."
            : "Template belum tersimpan. Periksa koneksi dan coba lagi.",
    };
  }
  revalidatePath("/template-struk");
  revalidatePath("/pos");
  return { success: "Template struk berhasil disimpan." };
}
