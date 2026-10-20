import { rupiah } from "@/lib/money";
import {
  outletStatementSections,
  type ReportAccount,
  type ReportSummary,
  type StatementRow,
} from "@/lib/financial-statement-layout";
function Rows({ rows }: { rows: StatementRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <div
          className={`statement-account-row is-${r.level}`}
          key={r.key}
          title={r.note}
          data-account-code={r.level === "account" ? r.code : undefined}
        >
          <span className="statement-account-label">
            <code>{r.code}</code>
            <span>{r.label}</span>
          </span>
          <strong>{r.value === null ? "—" : rupiah(r.value)}</strong>
        </div>
      ))}
    </>
  );
}
function Total({
  label,
  value = null,
  tone = "neutral",
}: {
  label: string;
  value?: number | null;
  tone?: string;
}) {
  return (
    <div className={`statement-subtotal tone-${tone}`}>
      <strong>{label}</strong>
      <strong>{value === null ? "—" : rupiah(value)}</strong>
    </div>
  );
}
export function DetailedOutletStatements({
  accounts,
  summary,
  stacked = false,
}: {
  accounts: ReportAccount[];
  summary: ReportSummary;
  stacked?: boolean;
}) {
  const r = outletStatementSections(accounts, summary);
  return (
    <>
      <div className={stacked ? "statement-stacked" : "report-columns"}>
        <section
          className="report-statement detailed-statement"
          aria-label="LABA RUGI (INCOME STATEMENT)"
        >
          <h3>LABA RUGI (INCOME STATEMENT)</h3>
          <h4 className="statement-band tone-green">PENDAPATAN (REVENUE)</h4>
          <Rows rows={r.revenue} />
          <Total
            label="Pendapatan penjualan tercatat"
            value={summary.records ? summary.gross : null}
            tone="green"
          />
          <h4 className="statement-band tone-amber">HPP (HARGA POKOK PENJUALAN)</h4>
          <Rows rows={r.hpp} />
          <Total label="Total HPP" tone="amber" />
          <Total label="LABA KOTOR (Gross Profit)" tone="blue" />
          <h4 className="statement-band tone-red">BEBAN OPERASIONAL & LAINNYA</h4>
          <Rows rows={r.expense} />
          <div className="statement-account-row is-unmapped">
            <span>Pengeluaran rekap · belum dirinci ke akun</span>
            <strong>{summary.records ? rupiah(summary.expense) : "—"}</strong>
          </div>
          <Total label="Total Beban Operasional" tone="red" />
          <Total label="LABA OPERASIONAL" tone="blue" />
          <Total label="LABA BERSIH (Net Profit)" tone="solid-green" />
          <p className="report-footnote">
            Nilai 4101 dan 6104 berasal dari rekap outlet, belum jurnal terposting. Bonus adalah hak
            yang diperoleh, bukan pencairan. Pengeluaran rekap belum dikelompokkan ke akun beban;
            laba belum dihitung sampai HPP dan seluruh beban lengkap.
          </p>
        </section>
        <section
          className="report-statement detailed-statement blue"
          aria-label="NERACA (BALANCE SHEET)"
        >
          <h3>NERACA (BALANCE SHEET)</h3>
          <h4 className="statement-band tone-blue">ASET (HARTA)</h4>
          <h4>ASET LANCAR & DIBAYAR DI MUKA</h4>
          <Rows rows={r.currentAssets} />
          <Total label="Subtotal Aset Lancar" />
          <h4>ASET TETAP & AKUMULASI PENYUSUTAN</h4>
          <Rows rows={r.fixedAssets} />
          <Total label="Subtotal Aset Tetap Bersih" />
          <Total label="TOTAL ASET" tone="blue" />
          <h4 className="statement-band tone-red">KEWAJIBAN & EKUITAS (PASIVA)</h4>
          <h4>KEWAJIBAN</h4>
          <Rows rows={r.liabilities} />
          {!r.liabilities.length && (
            <p className="report-footnote">Akun kewajiban belum tersedia pada Master COA.</p>
          )}
          <Total label="Subtotal Kewajiban" />
          <h4>EKUITAS</h4>
          <Rows rows={r.equity} />
          <Total label="Subtotal Ekuitas" />
          <Total label="TOTAL PASIVA" tone="red" />
          <p className="report-footnote">
            Neraca memerlukan saldo awal dan jurnal yang dialokasikan ke outlet. Setoran periode ini
            bukan saldo kas akhir; daftar aset fisik belum menjadi saldo buku. Akun dan kode
            mengikuti Master COA aplikasi.
          </p>
        </section>
      </div>
      <section className="report-reconciliation" aria-label="Rekonsiliasi laporan">
        <h3>Rekonsiliasi</h3>
        <div>
          <span>Laba periode & saldo laba berjalan</span>
          <strong>Belum dapat diverifikasi</strong>
        </div>
        <div>
          <span>Total aset = total pasiva</span>
          <strong>Menunggu saldo awal & jurnal per outlet</strong>
        </div>
      </section>
    </>
  );
}
