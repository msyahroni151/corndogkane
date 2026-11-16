"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { FormState } from "@/lib/form-state";

const period = {
  gte: new Date("2026-11-01T00:00:00Z"),
  lte: new Date("2026-11-15T00:00:00Z"),
};
const batch = "REKAP-INTERNAL-NOV-2026-01-15";
const auditedSnapshot = "1c8026d7e216e19f3ff1633c08f9f43c675edbeebae42394e412d44b58e91e25";
const outletIds = [
  "OUT-00001", "OUT-00023", "OUT-00014", "OUT-00021", "OUT-00004", "OUT-00002",
  "OUT-00015", "OUT-00011", "OUT-00009", "OUT-00008", "OUT-00020", "OUT-00018",
  "OUT-00016",
];
const auditedTotals = [90_377_400, 59_088_600, 10_995_000, 1_146_000, 84_000];
const channels = [
  { label: "Tunai", code: "1101" },
  { label: "QRIS", code: "1205" },
  { label: "ShopeeFood", code: "1206" },
  { label: "GrabFood", code: "1206" },
  { label: "GoFood", code: "1206" },
];

class PostingConflict extends Error {}

export async function postInternalSalesNovember2026(): Promise<FormState> {
  const owner = await requireAccess("open-transaction", "create");
  if (owner.roleSystemKey !== "OWNER") return { error: "Posting ini memerlukan akses Owner." };

  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${batch}))`;
      const existing = await tx.journalTransaction.findMany({
        where: {
          date: period,
          OR: [{ sourceCode: "4101" }, { targetCode: "4101" }],
        },
        select: { notes: true },
      });
      if (existing.length) {
        if (existing.length === 563 && existing.every(({ notes }) => notes.startsWith(batch))) return;
        throw new PostingConflict("Sudah ada jurnal 4101 pada periode ini. Cocokkan jurnal sebelum posting.");
      }

      const recaps = await tx.outletOperation.findMany({
        where: { outletId: { in: outletIds }, date: period },
        select: {
          id: true, outletId: true, outletName: true, date: true, salesSource: true, salesPending: true,
          totalGross: true, qris: true, shopeefood: true, grabfood: true, gofood: true,
        },
      });
      const posCount = await tx.saleTransaction.count({ where: { outletId: { in: outletIds }, date: period } });
      if (
        posCount || recaps.length !== 193 ||
        new Set(recaps.map(({ outletId }) => outletId)).size !== outletIds.length ||
        recaps.some(({ salesSource, salesPending }) => salesSource !== "MANUAL" || salesPending)
      ) throw new PostingConflict("Data rekap berubah. Periksa ulang rekap dan penjualan POS sebelum posting.");

      const snapshot = createHash("sha256")
        .update(recaps.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((recap) => [
          recap.id, recap.outletId, recap.date.toISOString().slice(0, 10), recap.totalGross,
          recap.qris, recap.shopeefood, recap.grabfood, recap.gofood,
        ].join(":")).join("\n"))
        .digest("hex");
      if (snapshot !== auditedSnapshot)
        throw new PostingConflict("Rincian rekap berubah sejak dicocokkan. Periksa ulang sebelum posting.");

      const accounts = await tx.financialAccount.findMany({
        where: { code: { in: ["1101", "1205", "1206", "4101"] }, active: true },
      });
      const revenue = accounts.find(({ code, kind }) => code === "4101" && kind === "PENDAPATAN");
      const debits = accounts.filter(({ kind }) => kind === "ASET");
      if (!revenue || debits.length !== 3)
        throw new PostingConflict("Aktifkan akun 1101, 1205, 1206, dan 4101 dengan klasifikasi yang sesuai.");

      const totals = channels.map(() => 0);
      const entries = recaps.flatMap((recap) => {
        const cash = recap.totalGross - recap.qris - recap.shopeefood - recap.grabfood - recap.gofood;
        const amounts = [cash, recap.qris, recap.shopeefood, recap.grabfood, recap.gofood];
        if (recap.totalGross <= 0 || amounts.some((amount) => amount < 0))
          throw new PostingConflict(`Rincian pembayaran belum seimbang untuk ${recap.outletName}.`);
        return channels.flatMap(({ label, code }, index) => {
          const amount = amounts[index];
          totals[index] += amount;
          if (amount === 0) return [];
          const debit = debits.find((account) => account.code === code)!;
          return [{
            postingKey: createHash("sha256").update(`${batch}:${recap.id}:${label}`).digest("hex").slice(0, 36),
            date: recap.date,
            sourceAccountId: debit.id,
            sourceCode: debit.code,
            sourceName: debit.name,
            sourceSide: "DEBIT",
            targetAccountId: revenue.id,
            targetCode: revenue.code,
            targetName: revenue.name,
            amount,
            notes: `${batch} | ${recap.outletId} ${recap.outletName} | ${label} | Rekap ${recap.id}`,
            createdById: owner.id,
          }];
        });
      });
      if (entries.length !== 563 || totals.some((amount, index) => amount !== auditedTotals[index]))
        throw new PostingConflict("Total rekap berubah sejak dicocokkan. Periksa ulang sebelum posting.");

      await tx.journalTransaction.createMany({ data: entries });
    }, { isolationLevel: "Serializable", timeout: 30_000 });
  } catch (error) {
    return {
      error: error instanceof PostingConflict ? error.message : "Posting belum tersimpan. Muat ulang lalu coba lagi.",
    };
  }

  revalidatePath("/finance/laporan-akuntansi");
  revalidatePath("/finance/finance-ledger");
  revalidatePath("/open-transaction");
  revalidatePath("/finance/jurnal-umum");
  return { success: "563 jurnal penjualan outlet internal sudah tercatat di akun 4101." };
}
