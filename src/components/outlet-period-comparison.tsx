import { LocalInput } from "@/components/local-input";
import { dateToDisplay } from "@/lib/local-date";
import { rupiah } from "@/lib/money";
import { percentageChange, type ReportSummary } from "@/lib/financial-statement-layout";
export function OutletPeriodComparison({
  outlet,
  from,
  to,
  previousFrom,
  previousTo,
  current,
  previous,
  error,
}: {
  outlet: string;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  current: ReportSummary;
  previous: ReportSummary;
  error: string;
}) {
  const metrics: [string, number | null, number | null][] = [
    [
      "Pendapatan penjualan",
      current.records ? current.gross : null,
      previous.records ? previous.gross : null,
    ],
    [
      "Pengeluaran rekap",
      current.records ? current.expense : null,
      previous.records ? previous.expense : null,
    ],
    ["Bonus diperoleh", current.bonus, previous.bonus],
    [
      "Cash seharusnya",
      current.records ? current.cash : null,
      previous.records ? previous.cash : null,
    ],
    ["Real diterima lengkap", current.real, previous.real],
    ["HPP", null, null],
    ["Laba bersih", null, null],
  ];
  return (
    <section className="report-statement" aria-label="Analisa Perbandingan">
      <h3>Analisa Perbandingan · Outlet yang sama</h3>
      <form
        className="report-compare"
        action="/finance/laporan-akuntansi"
        key={`${from}:${to}:${previousFrom}:${previousTo}`}
      >
        <input type="hidden" name="tab" value="insights" />
        <input type="hidden" name="outlet" value={outlet} />
        <div>
          <h4>PERIODE PEMBANDING</h4>
          <div className="compare-period">
            <label>
              Mulai pembanding
              <LocalInput
                aria-label="Mulai pembanding"
                type="date"
                name="prevFrom"
                defaultValue={previousFrom}
                required
              />
            </label>
            <label>
              Sampai pembanding
              <LocalInput
                aria-label="Sampai pembanding"
                type="date"
                name="prevTo"
                defaultValue={previousTo}
                required
              />
            </label>
          </div>
        </div>
        <div>
          <h4>PERIODE LAPORAN</h4>
          <div className="compare-period">
            <label>
              Mulai laporan
              <LocalInput
                aria-label="Mulai laporan"
                type="date"
                name="from"
                defaultValue={from}
                required
              />
            </label>
            <label>
              Sampai laporan
              <LocalInput
                aria-label="Sampai laporan"
                type="date"
                name="to"
                defaultValue={to}
                required
              />
            </label>
          </div>
        </div>
        <button className="button-primary" type="submit">
          Bandingkan
        </button>
      </form>
      {error ? (
        <p role="alert" className="report-notice m-4">
          {error}
        </p>
      ) : (
        <div className="report-table">
          <table>
            <thead>
              <tr>
                <th>Metrik keuangan</th>
                <th>
                  {dateToDisplay(previousFrom)} – {dateToDisplay(previousTo)}
                </th>
                <th>
                  {dateToDisplay(from)} – {dateToDisplay(to)}
                </th>
                <th>Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(([label, value, old]) => {
                const change = percentageChange(value, old);
                return (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="money">{old === null ? "—" : rupiah(old)}</td>
                    <td className="money">{value === null ? "—" : rupiah(value)}</td>
                    <td className="money">
                      {change === null
                        ? "—"
                        : `${change > 0 ? "+" : ""}${change.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>Tanggal dengan rekap</td>
                <td>{previous.records}</td>
                <td>{current.records}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="report-footnote">
        Persentase belum dihitung jika periode pembanding bernilai nol atau belum ada rekap. Jumlah
        rekap bukan jumlah transaksi POS. HPP dan laba menunggu data lengkap.
      </p>
    </section>
  );
}
