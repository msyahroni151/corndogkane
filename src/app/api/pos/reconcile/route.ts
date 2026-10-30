import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { sameOrigin } from "@/lib/request-origin";
import { refreshDailySales } from "@/lib/daily-sales";
import { SaleError } from "@/lib/sale-input";
import { syncOutletBonus, BonusSyncError } from "@/lib/outlet-bonus-ledger";
import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";
import { revalidatePath } from "next/cache";
export async function POST(request: Request) {
  const json = (b: unknown, s = 200) =>
      Response.json(b, { status: s, headers: { "Cache-Control": "private, no-store" } }),
    user = await currentUser();
  if (!user) return json({ error: "Silakan masuk kembali." }, 401);
  if (!hasPermission(user, "monitoring-outlet") || !sameOrigin(request))
    return json({ error: "Akses ditolak." }, 403);
  try {
    const text = await request.text();
    if (text.length > 5000) throw new SaleError("Data terlalu besar.");
    const body = JSON.parse(text);
    if (
      typeof body.id !== "string" ||
      !["POS", "MANUAL"].includes(body.choice) ||
      typeof body.notes !== "string" ||
      body.notes.trim().length < 3 ||
      body.notes.length > 1000
    )
      throw new SaleError("Pilih sumber final dan isi alasan konfirmasi.");
    await getPrisma().$transaction(
      async (tx) => {
        const candidate = await tx.outletOperation.findUnique({ where: { id: body.id } });
        if (!candidate) throw new SaleError("Rekap tidak ditemukan.");
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${candidate.outletId + "|" + candidate.date.toISOString().slice(0, 10)},0))`;
        const row = await tx.outletOperation.findUniqueOrThrow({
          where: { id: body.id },
          include: { outlet: true },
        });
        if (row.updatedAt.toISOString() !== body.version)
          throw new SaleError("Penjualan berubah. Muat ulang perbandingan sebelum mengonfirmasi.");
        let saved = await refreshDailySales(tx, row.id, user.id, {
          choice: body.choice,
          notes: body.notes.trim(),
        });
        if (saved.hasManual) {
          const rate = outletBonusRate(
            row.outlet.name,
            row.date.toISOString().slice(0, 10),
            saved.bonusDailyRate ?? row.outlet.dailyRate,
            saved.totalGross,
          );
          saved = await tx.outletOperation.update({
            where: { id: row.id },
            data: { bonusDailyRate: rate, bonusAmount: outletBonus(saved.totalGross, rate) },
          });
          await syncOutletBonus(tx, saved, user.id);
        }
      },
      { timeout: 20000 },
    );
    for (const p of [
      "/menu-utama/dashboard",
      "/admin-malam/monitoring-outlet",
      "/finance/laporan-akuntansi",
      "/bonus",
      "/selisih-setor",
    ])
      revalidatePath(p);
    return json({ success: "Sumber penjualan final berhasil dikonfirmasi." });
  } catch (e) {
    return json(
      {
        error:
          e instanceof SaleError || e instanceof BonusSyncError
            ? e.message
            : "Konfirmasi belum tersimpan. Muat ulang dan coba kembali.",
      },
      409,
    );
  }
}
