import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BonusSlipPrint } from "@/components/bonus-slip-print";
import { requireAccess } from "@/lib/auth";
import { bonusStartDate } from "@/lib/bonus-period";
import { getPrisma } from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/local-date";
import { rupiah } from "@/lib/money";
import "./slip.css";

export const metadata: Metadata = {
  title: "Slip Pengambilan Bonus · Corndog Kane",
  robots: { index: false, follow: false },
};

const dateLabel = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

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
  const date = dateLabel.format(entry.payroll?.paidAt ?? entry.date);
  const year = entry.date.getUTCFullYear();
  const month = entry.date.getUTCMonth();
  const firstHalf = entry.date.getUTCDate() <= 15;
  const start = entry.payroll?.startDate ?? new Date(Date.UTC(year, month, firstHalf ? 1 : 16));
  const end =
    entry.payroll?.endDate ??
    (firstHalf ? new Date(Date.UTC(year, month, 15)) : new Date(Date.UTC(year, month + 1, 0)));

  const identity = [
    ["ID Pengambilan", entry.id],
    ["Tanggal Pengambilan", date],
    ["ID Karyawan", entry.employeeId],
    ["Nama Lengkap", entry.employeeName],
    ["Kode Nama", entry.employee.employeeCode || "—"],
    ["Departemen", entry.employee.department || "—"],
    ["Jabatan", entry.employee.position || "—"],
  ];
  const payment = [
    ["Periode Bonus", dateLabel.format(start) + " s.d. " + dateLabel.format(end)],
    ["Status Pengambilan", "DIBAYAR"],
    ["Sisa Setelah Pencairan", rupiah(remaining)],
    ["Metode Pembayaran", entry.payroll ? "Melalui payroll" : "Tidak tercatat"],
  ];

  return (
    <main className="bonus-slip">
      <div className="bonus-slip-toolbar">
        <Link href="/bonus?view=history" className="button-secondary">
          Kembali ke Riwayat Bonus
        </Link>
        <BonusSlipPrint />
      </div>
      <article className="bonus-slip-paper">
        <header className="bonus-slip-header">
          <Image src="/corndog-kane-logo.png" alt="Corndog Kane" width={68} height={68} unoptimized />
          <div>
            <p>CORNDOG KANE</p>
            <h1>SLIP PENGAMBILAN BONUS</h1>
          </div>
        </header>
        <p className="bonus-slip-date">Tanggal Pengambilan {date}</p>
        <dl className="bonus-slip-details">
          {identity.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="bonus-slip-amount">
          <span>NOMINAL BONUS</span>
          <strong>{rupiah(entry.amount)}</strong>
        </div>
        <section className="bonus-slip-notes">
          <h2>KETERANGAN</h2>
          <p>{entry.notes || "—"}</p>
        </section>
        <dl className="bonus-slip-details">
          {payment.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={value === "DIBAYAR" ? "bonus-slip-paid" : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
        <footer className="bonus-slip-signatures">
          <div>
            <p>Dibuat oleh</p>
            <strong>{entry.decidedBy?.name ?? entry.createdBy.name}</strong>
          </div>
          <div>
            <p>Diterima oleh</p>
            <strong>{entry.employee.employeeCode || entry.employeeName}</strong>
          </div>
        </footer>
      </article>
    </main>
  );
}
