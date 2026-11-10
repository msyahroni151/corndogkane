import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MoneySlip, slipDate, type SlipRow } from "@/components/money-slip";
import { requireAccess } from "@/lib/auth";
import { bonusStartDate } from "@/lib/bonus-period";
import { getPrisma } from "@/lib/db";
import { rupiah } from "@/lib/money";

export const metadata: Metadata = {
  title: "Slip Pengambilan Bonus · Corndog Kane",
  robots: { index: false, follow: false },
};

export default async function BonusSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("bonus");
  const { id } = await params;
  const db = getPrisma();
  const entry = await db.moneyEntry.findFirst({
    where: { id, kind: "BONUS_WITHDRAWAL", status: "APPROVED", date: { gte: bonusStartDate() } },
    include: {
      employee: { select: { employeeCode: true, department: true, position: true } },
      decidedBy: { select: { name: true } },
      createdBy: { select: { name: true } },
      payroll: { select: { startDate: true, endDate: true, paidAt: true } },
    },
  });
  if (!entry) notFound();

  const amounts = await db.moneyEntry.groupBy({
    by: ["kind"],
    where: {
      employeeId: entry.employeeId,
      status: "APPROVED",
      kind: { in: ["BONUS_EARNED", "BONUS_WITHDRAWAL"] },
      date: { gte: bonusStartDate(), lte: entry.date },
      OR: [
        { kind: "BONUS_EARNED" },
        { date: { lt: entry.date } },
        { createdAt: { lt: entry.createdAt } },
        { createdAt: entry.createdAt, id: { lte: entry.id } },
      ],
    },
    _sum: { amount: true },
  });
  const remaining = amounts.reduce(
    (balance, item) =>
      balance + (item.kind === "BONUS_EARNED" ? 1 : -1) * (item._sum.amount ?? 0),
    0,
  );
  const date = slipDate.format(entry.payroll?.paidAt ?? entry.date);
  const year = entry.date.getUTCFullYear();
  const month = entry.date.getUTCMonth();
  const firstHalf = entry.date.getUTCDate() <= 15;
  const start = entry.payroll?.startDate ?? new Date(Date.UTC(year, month, firstHalf ? 1 : 16));
  const end =
    entry.payroll?.endDate ??
    (firstHalf ? new Date(Date.UTC(year, month, 15)) : new Date(Date.UTC(year, month + 1, 0)));

  const identity: SlipRow[] = [
    ["ID Pengambilan", entry.id],
    ["Tanggal Pengambilan", date],
    ["ID Karyawan", entry.employeeId],
    ["Nama Lengkap", entry.employeeName],
    ["Kode Nama", entry.employee.employeeCode || "—"],
    ["Departemen", entry.employee.department || "—"],
    ["Jabatan", entry.employee.position || "—"],
  ];
  const payment: SlipRow[] = [
    ["Periode Bonus", slipDate.format(start) + " s.d. " + slipDate.format(end)],
    ["Status Pengambilan", "DIBAYAR", "paid"],
    ["Sisa Setelah Pencairan", rupiah(remaining)],
    ["Metode Pembayaran", entry.payroll ? "Melalui payroll" : "Tidak tercatat"],
  ];

  return (
    <MoneySlip
      title="SLIP PENGAMBILAN BONUS"
      date={`Tanggal Pengambilan ${date}`}
      backHref="/bonus?view=history"
      backLabel="Kembali ke Riwayat Bonus"
      identity={identity}
      amountLabel="NOMINAL BONUS"
      amount={entry.amount}
      notesLabel="KETERANGAN"
      notes={entry.notes}
      summary={payment}
      preparedBy={entry.decidedBy?.name ?? entry.createdBy.name}
      receivedBy={entry.employee.employeeCode || entry.employeeName}
    />
  );
}
