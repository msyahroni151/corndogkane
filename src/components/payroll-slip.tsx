import type { Employee, Payroll } from "@/generated/prisma/client";
import Image from "next/image";
import Link from "next/link";
import { MoneySlipPrint } from "@/components/money-slip-print";
import { slipDate } from "@/components/money-slip";
import { employeeGroup, isBackupEmployee } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { payrollStatuses } from "@/lib/payroll";
import "./money-slip.css";
import "./payroll-slip.css";

type SlipPayroll = Payroll & {
  employee: Pick<
    Employee,
    "fullName" | "department" | "position" | "bankName" | "bankAccountNumber" | "bankAccountName"
  >;
};
type Detail = [label: string, value: string];
type Amount = [label: string, value: number];

function Details({ rows }: { rows: Detail[] }) {
  return (
    <dl className="payroll-slip-details">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Amounts({
  title,
  rows,
  total,
  deductions = false,
}: {
  title: string;
  rows: Amount[];
  total: Amount;
  deductions?: boolean;
}) {
  return (
    <section className={`payroll-slip-amounts${deductions ? " payroll-slip-deductions" : ""}`}>
      <h2>{title}</h2>
      <dl>
        {[...rows, total].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{rupiah(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PayrollSlip({
  payroll,
  preparedBy,
  backHref,
}: {
  payroll: SlipPayroll;
  preparedBy: string;
  backHref: string;
}) {
  const { employee } = payroll;
  const position = employee.position.trim().toUpperCase();
  const warehouse = employeeGroup({ ...employee, active: true }) === "warehouse";
  const backup = isBackupEmployee(employee) || position === "LEADER AREA";
  const period = `${slipDate.format(payroll.startDate)} s.d. ${slipDate.format(payroll.endDate)}`;
  const earnings: Amount[] = [["Total Upah Dasar", payroll.basePay]];
  if (backup || payroll.backupPay !== 0) earnings.push(["Tambahan Crew Backup", payroll.backupPay]);
  if (backup || payroll.standbyPay !== 0) earnings.push(["Bonus Standby", payroll.standbyPay]);
  if (warehouse || payroll.warehouseBonus !== 0)
    earnings.push(["Bonus Jaga Sendiri", payroll.warehouseBonus]);
  if (!warehouse || payroll.bonusPaid !== 0)
    earnings.push(["Bonus Omzet Dibayarkan", payroll.bonusPaid]);

  const deductions: Amount[] = [["Denda Keterlambatan", payroll.lateDeduction]];
  if (!warehouse || payroll.settlementDeduction !== 0)
    deductions.push(["Potongan Kekurangan Setoran", payroll.settlementDeduction]);
  deductions.push(
    ["Potongan Kasbon", payroll.loanDeduction],
    ["Potongan Lain", payroll.otherDeduction],
  );

  const attendance: Detail[] = [
    ["ID Karyawan", payroll.employeeId],
    ["Hari Kerja", payroll.paidUnits.toLocaleString("id-ID")],
  ];
  if (backup || payroll.standbyDays > 0)
    attendance.push(["Hari Standby", String(payroll.standbyDays)]);

  return (
    <main className="money-slip payroll-slip">
      <div className="money-slip-toolbar">
        <Link href={backHref} className="button-secondary">
          Kembali ke Riwayat Gaji
        </Link>
        <MoneySlipPrint />
      </div>
      <article className="money-slip-paper">
        <header className="money-slip-header">
          <Image src="/corndog-kane-logo.png" alt="Corndog Kane" width={68} height={68} unoptimized />
          <div>
            <p>CORNDOG KANE</p>
            <h1>SLIP GAJI KARYAWAN{position && ` “${warehouse ? "WAREHOUSE" : position}”`}</h1>
          </div>
        </header>
        <p className="money-slip-date">Periode Penggajian {period}</p>
        {payroll.status === "DRAFT" && (
          <p className="payroll-slip-draft">DRAFT · Payroll belum dibayar</p>
        )}
        <div className="payroll-slip-columns">
          <Details rows={[
            ["ID Payroll", payroll.id],
            ["Periode", period],
            ["Nama Karyawan", payroll.employeeName],
            ["Jabatan", employee.position || "—"],
          ]} />
          <Details rows={attendance} />
        </div>
        <Amounts
          title="PENDAPATAN"
          rows={earnings}
          total={["Total Pendapatan Kotor", earnings.reduce((sum, [, amount]) => sum + amount, 0)]}
        />
        <Amounts
          title="POTONGAN"
          rows={deductions}
          total={["Total Potongan", deductions.reduce((sum, [, amount]) => sum + amount, 0)]}
          deductions
        />
        <div className="money-slip-amount payroll-slip-net">
          <span>GAJI BERSIH</span><strong>{rupiah(payroll.netPay)}</strong>
        </div>
        <div className="payroll-slip-columns">
          <Details rows={[
            ["Metode Pembayaran", "Tidak tercatat"],
            ["Status Payroll", payrollStatuses[payroll.status]],
            ["Tanggal Bayar", payroll.paidAt ? slipDate.format(payroll.paidAt) : "—"],
          ]} />
          <Details rows={[
            ["Bank", employee.bankName || "—"],
            ["No. Rekening", employee.bankAccountNumber || "—"],
            ["Atas Nama", employee.bankAccountName || "—"],
          ]} />
        </div>
        {payroll.notes && <p className="payroll-slip-notes">{payroll.notes}</p>}
        <footer className="money-slip-signatures">
          <div><p>Dibuat oleh</p><strong>{preparedBy}</strong></div>
          <div><p>Diterima oleh</p><strong>{employee.fullName}</strong></div>
        </footer>
      </article>
    </main>
  );
}
