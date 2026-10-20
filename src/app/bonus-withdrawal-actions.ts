"use server";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { allocateBusinessId } from "@/lib/business-id";
import { validateLedger } from "@/lib/money";
import { parseCivilDate, todayWib } from "@/lib/placements";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
class WithdrawalError extends Error {}
export async function withdrawBonus(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("bonus");
  const get = (key: string) => String(form.get(key) || "").trim();
  const employeeId = get("employeeId"),
    raw = get("amount"),
    requestId = get("requestId"),
    notes = get("notes") || "Pencairan dana bonus";
  if (
    !employeeId ||
    !/^\d+$/.test(raw) ||
    Number(raw) < 1 ||
    Number(raw) > 1000000000 ||
    !Number.isSafeInteger(Number(raw))
  )
    return { error: "Isi nominal pencairan rupiah bulat antara 1 dan 1.000.000.000." };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
    notes.length > 1000
  )
    return { error: "Permintaan tidak valid. Tutup dan buka kembali formulir pencairan." };
  let date: Date;
  try {
    date = parseCivilDate(get("date"));
    if (get("date") > todayWib())
      return { error: "Tanggal pencairan tidak boleh melebihi hari ini." };
  } catch {
    return { error: "Tanggal pencairan tidak valid." };
  }
  const amount = Number(raw),
    postingKey = `BONUS-CASHOUT:${requestId}`;
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${postingKey},0))`;
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employeeId} FOR UPDATE`;
        const employee = await tx.employee.findUnique({ where: { id: employeeId } });
        if (!employee) throw new WithdrawalError("Karyawan tidak ditemukan.");
        const existing = await tx.moneyEntry.findUnique({ where: { postingKey } });
        if (existing) {
          if (
            existing.employeeId !== employeeId ||
            existing.amount !== amount ||
            existing.date.getTime() !== date.getTime()
          )
            throw new WithdrawalError(
              "Permintaan pencairan ini sudah tercatat. Muat ulang untuk melihat saldo terbaru.",
            );
          return;
        }
        const ledger = await tx.moneyEntry.findMany({
          where: {
            employeeId,
            status: "APPROVED",
            kind: { in: ["BONUS_EARNED", "BONUS_WITHDRAWAL"] },
          },
        });
        const candidate = {
          id: postingKey,
          sourceId: null,
          kind: "BONUS_WITHDRAWAL",
          date,
          amount,
        };
        const error = validateLedger([...ledger, candidate]);
        if (error)
          throw new WithdrawalError(
            "Nominal pencairan melebihi saldo bonus yang tersedia pada tanggal tersebut.",
          );
        await tx.moneyEntry.create({
          data: {
            id: await allocateBusinessId(tx, "bonus"),
            postingKey,
            employeeId,
            employeeName: employee.fullName,
            date,
            kind: "BONUS_WITHDRAWAL",
            amount,
            notes,
            status: "APPROVED",
            createdById: user.id,
            decidedById: user.id,
            decidedAt: new Date(),
            decisionNotes: "Pencairan dana dari saldo bonus.",
          },
        });
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return {
      error:
        e instanceof WithdrawalError
          ? e.message
          : "Pencairan belum tercatat. Muat ulang dan periksa saldo sebelum mencoba kembali.",
    };
  }
  for (const path of ["/bonus", "/payroll", "/rekap-saldo"]) revalidatePath(path);
  return { success: "Pencairan bonus tercatat dan saldo diperbarui." };
}
