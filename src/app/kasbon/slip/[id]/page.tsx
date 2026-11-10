import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MoneySlip, slipDate, type SlipRow } from "@/components/money-slip";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { rupiah } from "@/lib/money";

export const metadata: Metadata = {
  title: "Slip Kasbon Karyawan · Corndog Kane",
  robots: { index: false, follow: false },
};

export default async function KasbonSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("kasbon");
  const { id } = await params;
  const entry = await getPrisma().moneyEntry.findFirst({
    where: { id, kind: "LOAN", status: "APPROVED" },
    select: {
      employeeId: true,
      amount: true,
      date: true,
      notes: true,
      createdBy: { select: { name: true } },
      employee: {
        select: {
          fullName: true,
          employeeCode: true,
          department: true,
          position: true,
          moneyEntries: {
            where: { kind: "LOAN", status: "APPROVED" },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              amount: true,
              repayments: {
                where: { kind: "REPAYMENT", status: "APPROVED" },
                orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
                select: { amount: true, payrollId: true },
              },
            },
          },
        },
      },
    },
  });
  if (!entry) notFound();
  const { employee } = entry;
  const loans = employee.moneyEntries.map((loan) => ({
    ...loan,
    remaining: loan.amount - loan.repayments.reduce((total, payment) => total + payment.amount, 0),
  }));
  const currentIndex = loans.findIndex((loan) => loan.id === id);
  const current = loans[currentIndex];
  if (!current) notFound();
  const payrollPayments = current.repayments.filter((payment) => payment.payrollId);
  const payrollPaid = payrollPayments.reduce((total, payment) => total + payment.amount, 0);
  const manualPaid = current.amount - current.remaining - payrollPaid;
  const previousBalance = loans.slice(0, currentIndex).reduce((sum, loan) => sum + loan.remaining, 0);
  const totalBalance = loans.reduce((sum, loan) => sum + loan.remaining, 0);
  const latestPayroll = payrollPayments[0];
  const date = slipDate.format(entry.date);

  const summary: SlipRow[] = [
    ["Potongan Payroll Terakhir", latestPayroll ? rupiah(latestPayroll.amount) : "—"],
    ["Sudah Dipotong", rupiah(payrollPaid)],
  ];
  if (manualPaid > 0) summary.push(["Pembayaran Manual", rupiah(manualPaid)]);
  summary.push(
    ["Kasbon Sebelumnya", rupiah(previousBalance), "highlight"],
    ["Total Sisa Kasbon", rupiah(totalBalance), "highlight"],
    ["Status Kasbon", current.remaining > 0 ? "AKTIF" : "LUNAS", "paid"],
  );

  return (
    <MoneySlip
      title="SLIP KASBON KARYAWAN"
      date={`Tanggal Kasbon ${date}`}
      backHref="/kasbon"
      backLabel="Kembali ke Riwayat Kasbon"
      identity={[
        ["ID Kasbon", id],
        ["Tanggal Kasbon", date],
        ["ID Karyawan", entry.employeeId],
        ["Nama Lengkap", employee.fullName],
        ["Kode Nama", employee.employeeCode || "—"],
        ["Departemen", employee.department || "—"],
        ["Jabatan", employee.position || "—"],
      ]}
      amountLabel="NOMINAL KASBON"
      amount={entry.amount}
      notesLabel="DESKRIPSI KASBON"
      notes={entry.notes}
      summary={summary}
      preparedBy={entry.createdBy.name}
      receivedBy={employee.fullName}
    />
  );
}
