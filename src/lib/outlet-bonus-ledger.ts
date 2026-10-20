import type { Prisma } from "@/generated/prisma/client";
import { allocateBusinessId } from "@/lib/business-id";
export class BonusSyncError extends Error {}
export async function syncOutletBonus(
  tx: Prisma.TransactionClient,
  row: {
    id: string;
    crewId: string;
    crewName: string;
    date: Date;
    outletName: string;
    totalGross: number;
    bonusAmount: number | null;
  },
  userId: string,
) {
  if (row.bonusAmount == null) return;
  const postingKey = `OUTLET-BONUS:${row.id}`;
  const latest = () =>
    tx.moneyEntry.findFirst({
      where: { OR: [{ postingKey }, { postingKey: { startsWith: postingKey + ":" } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  let old = await latest();
  const amount = row.bonusAmount ?? 0;
  const employees = [...new Set([row.crewId, ...(old ? [old.employeeId] : [])])].sort();
  for (const id of employees)
    await tx.$executeRaw`SELECT id FROM employees WHERE id=${id} FOR UPDATE`;
  old = await latest();
  const changed = !old || old.amount !== amount || old.employeeId !== row.crewId;
  if (!changed) return;
  if (old?.status === "APPROVED")
    throw new BonusSyncError(
      "Bonus rekap ini sudah disetujui. Nominal bonus dan crew tidak dapat diubah; isian setoran tetap dapat diperbarui.",
    );
  if (!old && !amount) return;
  const paid = await tx.payroll.findFirst({
    where: { employeeId: { in: employees }, status: "PAID", endDate: { gte: row.date } },
  });
  if (paid)
    throw new BonusSyncError(
      "Bonus tidak dapat ditambahkan/diubah karena tanggal tersebut sudah tercakup payroll yang dibayar.",
    );
  const conflict = await tx.moneyEntry.findFirst({
    where: {
      employeeId: row.crewId,
      date: row.date,
      kind: "BONUS_EARNED",
      postingKey: null,
      status: { not: "REJECTED" },
    },
  });
  if (conflict)
    throw new BonusSyncError(
      "Sudah ada bonus manual pada crew dan tanggal ini. Periksa di menu Bonus agar tidak tercatat ganda.",
    );
  const data = {
    employeeId: row.crewId,
    employeeName: row.crewName,
    date: row.date,
    kind: "BONUS_EARNED" as const,
    amount,
    notes: `Bonus omzet otomatis · ${row.outletName} · omzet Rp ${row.totalGross.toLocaleString("id-ID")} · rekap ${row.id}`,
    status: amount ? ("APPROVED" as const) : ("REJECTED" as const),
    decidedById: amount ? userId : null,
    decidedAt: amount ? new Date() : null,
    decisionNotes: amount
      ? "Bonus otomatis langsung masuk saldo crew."
      : "Omzet belum memenuhi bonus.",
  };
  if (old && old.status !== "REJECTED") await tx.moneyEntry.update({ where: { id: old.id }, data });
  else {
    const id = await allocateBusinessId(tx, "bonus");
    await tx.moneyEntry.create({
      data: {
        ...data,
        id,
        postingKey: old ? `${postingKey}:${id}` : postingKey,
        createdById: userId,
      },
    });
  }
}
