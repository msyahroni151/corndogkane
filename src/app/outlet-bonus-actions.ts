"use server";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";
import { syncOutletBonus, BonusSyncError } from "@/lib/outlet-bonus-ledger";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
export async function syncLegacyOutletBonuses(_: FormState): Promise<FormState> {
  const user = await requireAccess("bonus"),
    db = getPrisma();
  const rows = await db.outletOperation.findMany({
    where: { bonusAmount: null, hasManual: true, salesPending: false },
    select: { id: true, outletId: true, date: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: 100,
  });
  let synced = 0;
  const failures: string[] = [];
  for (const candidate of rows) {
    try {
      await db.$transaction(async (tx) => {
        const day = candidate.date.toISOString().slice(0, 10);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${candidate.outletId + "|" + day},0))`;
        const row = await tx.outletOperation.findUnique({
          where: { id: candidate.id },
          include: { outlet: true },
        });
        if (!row || row.bonusAmount != null) return;
        const rate = outletBonusRate(row.outlet.name, day, row.outlet.dailyRate, row.totalGross),
          amount = outletBonus(row.totalGross, rate);
        if (amount == null)
          throw new BonusSyncError(
            "Tarif harian outlet belum diatur untuk menghitung bonus omzet Rp2 juta.",
          );
        await syncOutletBonus(tx, { ...row, bonusAmount: amount }, user.id);
        await tx.outletOperation.update({
          where: { id: row.id },
          data: { bonusDailyRate: rate, bonusAmount: amount },
        });
        synced++;
      });
    } catch (e) {
      failures.push(e instanceof BonusSyncError ? e.message : "Rekap belum dapat disinkronkan.");
    }
  }
  for (const p of ["/bonus", "/payroll", "/rekap-saldo"]) revalidatePath(p);
  const message = `${synced} rekap disinkronkan. Bonus yang memenuhi syarat langsung masuk saldo crew.`;
  return failures.length
    ? { error: message + ` ${failures.length} rekap dilewati: ` + [...new Set(failures)].join(" ") }
    : { success: message };
}
