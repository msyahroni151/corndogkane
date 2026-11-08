import { bonusStartDate, isCurrentBonusDate } from "@/lib/bonus-period";
import type { Prisma } from "@/generated/prisma/client";
import { allocateBusinessId } from "@/lib/business-id";
import { rupiah, validateLedger } from "@/lib/money";
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
  reservedInitialId?: string,
) {
  if (!isCurrentBonusDate(row.date)) return;
  const current = await tx.outletOperation.findUnique({
    where: { id: row.id },
    select: { salesPending: true },
  });
  if (current?.salesPending)
    throw new BonusSyncError(
      "Konfirmasikan sumber penjualan terlebih dahulu sebelum memproses bonus.",
    );
  const postingKey = `OUTLET-BONUS:${row.id}`;
  const latest = () =>
    tx.moneyEntry.findFirst({
      where: { OR: [{ postingKey }, { postingKey: { startsWith: postingKey + ":" } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  let old = await latest();
  const employees = [...new Set([row.crewId, ...(old ? [old.employeeId] : [])])].sort();
  for (const id of employees)
    await tx.$executeRaw`SELECT id FROM employees WHERE id=${id} FOR UPDATE`;
  old = await latest();
  if (row.bonusAmount == null) {
    if (old?.status === "APPROVED")
      throw new BonusSyncError(
        "Atur tarif harian outlet agar bonus sebelumnya bisa dihitung ulang dengan benar.",
      );
    return;
  }
  const amount = row.bonusAmount;
  const changed = !old || old.amount !== amount || old.employeeId !== row.crewId;
  if (!changed) return;
  if (!old && !amount) return;
  const paid = await tx.payroll.findFirst({
    where: { employeeId: { in: employees }, status: "PAID", endDate: { gte: row.date } },
  });
  if (paid)
    throw new BonusSyncError(
      "Bonus tidak dapat ditambahkan/diubah karena tanggal tersebut sudah tercakup payroll yang dibayar.",
    );
  if (old?.status === "APPROVED" && (old.employeeId !== row.crewId || amount < old.amount)) {
    const remaining = await tx.moneyEntry.findMany({
      where: {
        id: { not: old.id },
        employeeId: old.employeeId,
        status: "APPROVED",
        kind: { in: ["BONUS_EARNED", "BONUS_WITHDRAWAL"] },
        date: { gte: bonusStartDate() },
      },
      select: { id: true, kind: true, amount: true, date: true, sourceId: true },
    });
    if (old.employeeId === row.crewId && amount > 0)
      remaining.push({ id: old.id, kind: old.kind, amount, date: row.date, sourceId: null });
    if (validateLedger(remaining))
      throw new BonusSyncError(
        `Koreksi bonus untuk ${old.employeeName} akan membuat pengambilan bonus yang sudah tercatat melebihi saldo pada tanggalnya.`,
      );
  }
  const conflict =
    amount > 0 &&
    (await tx.moneyEntry.findFirst({
      where: {
        employeeId: row.crewId,
        date: row.date,
        kind: "BONUS_EARNED",
        postingKey: null,
        status: { not: "REJECTED" },
      },
    }));
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
    decidedById: userId,
    decidedAt: new Date(),
    decisionNotes:
      old?.status === "APPROVED"
        ? `Koreksi rekap: ${old.employeeName} ${rupiah(old.amount)} menjadi ${row.crewName} ${rupiah(amount)}.`
        : amount
          ? "Bonus otomatis langsung masuk saldo crew."
          : "Omzet belum memenuhi bonus.",
  };
  if (old && (old.status !== "REJECTED" || old.amount === 0))
    await tx.moneyEntry.update({ where: { id: old.id }, data });
  else {
    let id: string;
    if (reservedInitialId !== undefined) {
      const numeric = /^BON-([0-9]{5,})$/.exec(reservedInitialId);
      const reserved = await tx.sequenceCounter.findUnique({ where: { name: "bonus-entry" } });
      if (
        !numeric ||
        !Number.isSafeInteger(Number(numeric[1])) ||
        Number(numeric[1]) < 1 ||
        !reserved ||
        Number(numeric[1]) > reserved.value
      )
        throw new BonusSyncError("ID bonus historis belum dicadangkan.");
      id = reservedInitialId;
    } else id = await allocateBusinessId(tx, "bonus");
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
