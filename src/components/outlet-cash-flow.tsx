import { rupiah } from "@/lib/money";
import type { ReportSummary } from "@/lib/financial-statement-layout";
export function OutletCashFlow({ summary: s }: { summary: ReportSummary }) {
  const rows = [
    [
      "I. ARUS KAS DARI AKTIVITAS OPERASI",
      "Kas penjualan sebelum pengeluaran",
      s.records ? s.gross - s.qris - s.online : null,
    ],
    ["", "Pengeluaran tunai dari rekap", s.records ? -s.expense : null],
    ["", "Cash bersih seharusnya", s.records ? s.cash : null],
    ["II. ARUS KAS DARI AKTIVITAS INVESTASI", "Pembelian / pelepasan aset per outlet", null],
    [
      "III. ARUS KAS DARI AKTIVITAS PENDANAAN",
      "Modal, pinjaman, dan distribusi laba per outlet",
      null,
    ],
    ["REKONSILIASI SALDO KAS", "Saldo kas awal periode", null],
    ["", "Perubahan kas lengkap seluruh aktivitas", null],
    ["", "SALDO KAS AKHIR PERIODE", null],
  ] as const;
  return (
    <section className="report-statement" aria-label="Laporan Arus Kas">
      <h3>LAPORAN ARUS KAS</h3>
      <p className="report-footnote">
        Aktivitas operasi berikut berasal dari komposisi penjualan rekap. Saldo akhir belum dihitung
        karena saldo awal, mutasi bank, investasi, dan pendanaan per outlet belum terhubung.
      </p>
      <div className="report-table">
        <table>
          <thead>
            <tr>
              <th>Keterangan</th>
              <th>Nominal (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([group, label, value], i) => (
              <Row key={i} group={group} label={label} value={value} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Row({ group, label, value }: { group: string; label: string; value: number | null }) {
  return (
    <>
      {group && (
        <tr>
          <th colSpan={2} className="tone-blue">
            {group}
          </th>
        </tr>
      )}
      <tr>
        <td>{label}</td>
        <td className="money">{value === null ? "—" : rupiah(value)}</td>
      </tr>
    </>
  );
}
