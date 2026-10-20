"use server";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { operationalCash } from "@/lib/outlet-operations";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
class SettlementError extends Error {}
export async function decideSettlement(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("selisih-setor");
  const id = String(form.get("operationId") || ""),
    version = String(form.get("version") || ""),
    decision = String(form.get("decision") || ""),
    notes = String(form.get("notes") || "").trim();
  if (
    !id ||
    !version ||
    !["APPROVED", "REJECTED"].includes(decision) ||
    notes.length > 1000 ||
    (decision === "REJECTED" && !notes)
  )
    return { error: "Pilih keputusan dan isi alasan penolakan (maksimal 1.000 karakter)." };
  try {
    await getPrisma().$transaction(async (tx) => {
      const candidate = await tx.outletOperation.findUnique({ where: { id } });
      if (!candidate) throw new SettlementError("Rekap tidak ditemukan.");
      const key = candidate.outletId + "|" + candidate.date.toISOString().slice(0, 10);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
      const row = await tx.outletOperation.findUnique({ where: { id } });
      if (!row || row.updatedAt.toISOString() !== version)
        throw new SettlementError(
          "Rekap sudah berubah. Muat ulang dan periksa angka terbaru sebelum diproses.",
        );
      if (row.cashReceived == null)
        throw new SettlementError(
          "REAL belum diisi. Catat setoran diterima di Monitoring Outlet terlebih dahulu.",
        );
      const cash = operationalCash(row),
        difference = row.cashReceived - cash;
      if (Math.abs(cash) > 2147483647)
        throw new SettlementError(
          "CASH di luar batas nominal. Periksa isian penjualan dan pembayaran terlebih dahulu.",
        );
      if (difference === 0)
        throw new SettlementError("Setoran sudah sesuai, tidak ada selisih untuk diproses.");
      await tx.$executeRaw`SELECT id FROM employees WHERE id=${row.crewId} FOR UPDATE`;
      const previous = await tx.settlementReview.findFirst({
        where: { operationId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (previous?.status === "APPROVED" || previous?.sourceVersion === version)
        throw new SettlementError(
          "Selisih ini sudah diproses. Riwayat persetujuan tetap tersimpan.",
        );
      await tx.settlementReview.create({
        data: {
          operationId: id,
          employeeId: row.crewId,
          employeeName: row.crewName,
          outletName: row.outletName,
          date: row.date,
          expectedCash: cash,
          receivedCash: row.cashReceived,
          amount: decision === "APPROVED" ? Math.max(0, -difference) : 0,
          sourceVersion: version,
          status: decision as "APPROVED" | "REJECTED",
          notes,
          createdById: user.id,
        },
      });
    });
  } catch (e) {
    return {
      error:
        e instanceof SettlementError
          ? e.message
          : "Keputusan belum tersimpan. Muat ulang dan coba kembali.",
    };
  }
  for (const path of ["/selisih-setor", "/payroll", "/rekap-saldo"]) revalidatePath(path);
  return {
    success:
      decision === "APPROVED"
        ? "Selisih disetujui. Kekurangan setoran tersedia untuk dipotong melalui payroll."
        : "Selisih ditolak dan alasan tersimpan.",
  };
}
