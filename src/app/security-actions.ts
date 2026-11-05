"use server";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
export async function acknowledgeSecurityAlert(form: FormData) {
  const user = await requireUser();
  if (user.roleSystemKey !== "OWNER") return;
  const id = String(form.get("id") || "");
  if (id.length > 100) return;
  await getPrisma().$transaction(async (tx) => {
    await tx.securityAlert.updateMany({
      where: { id, acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgedById: user.id },
    });
    await tx.securityEvent.create({
      data: {
        userId: user.id,
        action: "SECURITY_ALERT_ACKNOWLEDGED",
        outcome: "SUCCESS",
        metadata: { alertId: id },
      },
    });
  });
  revalidatePath("/keamanan");
}
export async function saveSecurityRetention(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.roleSystemKey !== "OWNER") return { error: "Hanya Owner yang dapat mengatur keamanan." };
  const raw = String(form.get("days") || "");
  if (!/^\d+$/.test(raw) || Number(raw) < 30 || Number(raw) > 3650)
    return { error: "Isi batas peninjauan foto antara 30–3650 hari." };
  await getPrisma().$transaction(async (tx) => {
    await tx.securitySetting.upsert({
      where: { id: "default" },
      create: { id: "default", photoRetentionDays: Number(raw) },
      update: { photoRetentionDays: Number(raw) },
    });
    await tx.securityEvent.create({
      data: {
        userId: user.id,
        action: "RETENTION_POLICY_SET",
        outcome: "SUCCESS",
        metadata: { days: Number(raw), automaticDeletion: false },
      },
    });
  });
  revalidatePath("/keamanan");
  return { success: "Batas peninjauan disimpan. Tidak ada foto yang dihapus otomatis." };
}
