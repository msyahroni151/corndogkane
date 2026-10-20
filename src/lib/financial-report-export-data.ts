import { outletStatementSections, type ReportAccount } from "@/lib/financial-statement-layout";
import { summarizeOutletReport, type OutletReportEntry } from "@/lib/outlet-financial-report";
import { operationalCash } from "@/lib/outlet-operations";
import { dateToDisplay } from "@/lib/local-date";
export type ReportExportInput = {
  outlet: string;
  from: string;
  to: string;
  entries: OutletReportEntry[];
  accounts: ReportAccount[];
};
export type ExportTable = {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  widths: number[];
};
export const reportExportNote =
  "Laporan sementara dari rekap operasional. HPP, gaji, penyusutan, biaya pusat, saldo awal, dan jurnal per outlet belum lengkap. Angka yang belum tersedia tidak dianggap nol. Bonus adalah hak diperoleh, bukan pencairan.";
export function buildFinancialExport(input: ReportExportInput): ExportTable[] {
  const s = summarizeOutletReport(input.entries),
    sections = outletStatementSections(input.accounts, s);
  const unknown = "Belum tersedia";
  const known = (value: number | null) => (s.records && value !== null ? value : unknown);
  const statement = (keys: (keyof typeof sections)[]) =>
    keys.flatMap((key) =>
      sections[key].map((r) => [
        r.code,
        `${r.level === "account" ? "    " : r.level === "group" ? "  " : ""}${r.label}`,
        r.value ?? unknown,
      ]),
    );
  return [
    {
      name: "Ringkasan",
      headers: ["Keterangan", "Nilai"],
      widths: [60, 35],
      rows: [
        ["Pendapatan penjualan", known(s.gross)],
        ["Pengeluaran rekap", known(s.expense)],
        ["Bonus diperoleh", known(s.bonus)],
        ["Cash seharusnya", known(s.cash)],
        ["Setoran diterima yang sudah terisi", s.receipts ? s.received : "Belum terisi"],
        ["Real seluruh rekap lengkap", s.real ?? "Belum lengkap"],
        ["Selisih real - cash", s.difference ?? "Belum lengkap"],
        ["QRIS", known(s.qris)],
        ["Online food", known(s.online)],
        ["Laba kotor", unknown],
        ["Laba bersih", unknown],
        ["Total aset / neraca", unknown],
        ["Jumlah tanggal dengan rekap", s.records],
        ["Jumlah setoran terisi", s.receipts],
      ],
    },
    {
      name: "Laba Rugi",
      headers: ["Kode", "Keterangan", "Nominal (Rp)"],
      widths: [12, 65, 28],
      rows: [
        ["", "PENDAPATAN (REVENUE)", ""],
        ...statement(["revenue"]),
        ["", "Pendapatan penjualan tercatat", known(s.gross)],
        ["", "HARGA POKOK PENJUALAN", ""],
        ...statement(["hpp"]),
        ["", "Total HPP", unknown],
        ["", "LABA KOTOR", unknown],
        ["", "BEBAN OPERASIONAL & LAINNYA", ""],
        ...statement(["expense"]),
        ["", "Pengeluaran rekap belum dirinci ke akun", known(s.expense)],
        ["", "Total beban operasional", unknown],
        ["", "LABA OPERASIONAL", unknown],
        ["", "LABA BERSIH", unknown],
      ],
    },
    {
      name: "Neraca",
      headers: ["Kode", "Keterangan", "Nominal (Rp)"],
      widths: [12, 65, 28],
      rows: [
        ["", "ASET LANCAR & DIBAYAR DI MUKA", ""],
        ...statement(["currentAssets"]),
        ["", "Subtotal aset lancar", unknown],
        ["", "ASET TETAP & AKUMULASI PENYUSUTAN", ""],
        ...statement(["fixedAssets"]),
        ["", "Subtotal aset tetap bersih", unknown],
        ["", "TOTAL ASET", unknown],
        ["", "KEWAJIBAN", ""],
        ...statement(["liabilities"]),
        ...(!sections.liabilities.length
          ? [["", "Akun kewajiban belum tersedia di Master COA", unknown]]
          : []),
        ["", "Subtotal kewajiban", unknown],
        ["", "EKUITAS", ""],
        ...statement(["equity"]),
        ["", "Subtotal ekuitas", unknown],
        ["", "TOTAL PASIVA", unknown],
        ["", "Status rekonsiliasi", "Belum dapat diverifikasi"],
      ],
    },
    {
      name: "Rekap Harian",
      headers: [
        "Tanggal",
        "Crew",
        "Training",
        "Omzet",
        "QRIS",
        "GoFood",
        "GrabFood",
        "ShopeeFood",
        "Pengeluaran",
        "Bonus diperoleh",
        "Cash seharusnya",
        "Real diterima",
        "Selisih",
        "Catatan pengeluaran",
      ],
      widths: [16, 24, 24, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 90],
      rows: [
        ...input.entries.map((e) => [
          dateToDisplay(e.date),
          e.crewName,
          e.trainingCrewName ?? "",
          e.totalGross,
          e.qris,
          e.gofood,
          e.grabfood,
          e.shopeefood,
          e.expenseAmount ?? 0,
          e.bonusAmount ?? unknown,
          operationalCash(e),
          e.cashReceived ?? "Belum terisi",
          e.cashReceived === null ? "Belum terisi" : e.cashReceived - operationalCash(e),
          e.expenseNotes ?? "",
        ]),
        [
          "TOTAL",
          "",
          "",
          known(s.gross),
          known(s.qris),
          known(s.gofood),
          known(s.grabfood),
          known(s.shopeefood),
          known(s.expense),
          known(s.bonus),
          known(s.cash),
          s.real ?? "Belum lengkap",
          s.difference ?? "Belum lengkap",
          "",
        ],
      ],
    },
  ];
}
export function financialExportFilename(input: ReportExportInput, format: "xlsx" | "pdf") {
  const outlet =
    input.outlet
      .normalize("NFKD")
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "outlet";
  return `laporan-${outlet}-${input.from}-${input.to}.${format}`;
}
