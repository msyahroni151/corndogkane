import SearchForm from "next/form";
import { LocalInput } from "@/components/local-input";
import { OutletDashboardTable } from "@/components/outlet-dashboard-table";
import { OwnerCoverage, OwnerInsights, OwnerAttention } from "@/components/outlet-owner-insights";
import { OutletDashboardChart } from "@/components/outlet-dashboard-chart";
import { dashboardTotals, type OutletDashboardRow } from "@/lib/outlet-dashboard";
import { rupiah } from "@/lib/money";
import { dateToDisplay } from "@/lib/local-date";
import "./outlet-income-dashboard.css";
export function OutletIncomeDashboard({
  rows,
  from,
  to,
  area,
  areas,
  error,
}: {
  rows: OutletDashboardRow[];
  from: string;
  to: string;
  area: string;
  areas: { id: string; name: string }[];
  error: string;
}) {
  const totals = dashboardTotals(rows);
  return (
    <div className="outlet-income-dashboard">
      <section className="panel income-filters">
        <SearchForm action="" prefetch={false} scroll={false}>
          <label className="field">
            Tanggal mulai
            <LocalInput type="date" name="from" defaultValue={from} required />
          </label>
          <label className="field">
            Tanggal selesai
            <LocalInput type="date" name="to" defaultValue={to} required />
          </label>
          <label className="field">
            Area
            <select name="area" defaultValue={area}>
              <option value="">Semua area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button-primary">Terapkan</button>
        </SearchForm>
        <p>
          Periode {dateToDisplay(from)}–{dateToDisplay(to)} WIB · {totals.reported} dari{" "}
          {rows.length} outlet memiliki rekap.
          {rows.some((r) => r.schedule) && (
            <>
              {" "}
              · {rows.filter((r) => !r.closed && r.schedule && r.schedule.openDays > 0).length} buka
              · {rows.filter((r) => r.closed || r.schedule?.openDays === 0).length} tutup
            </>
          )}
        </p>
      </section>
      {error ? (
        <section className="panel income-empty" role="alert">
          {error}
        </section>
      ) : (
        <>
          <div className="income-stats">
            {[
              ["Omzet", totals.gross],
              ["QRIS", totals.qris],
              ["Online Food", totals.online],
              ["Pengeluaran", totals.expense],
              ["Cash", totals.cash],
              ["Bonus periode", totals.bonus],
            ].map(([label, value]) => (
              <section className="panel" key={label}>
                <p>{label}</p>
                <strong>
                  {totals.reported ? (value == null ? "—" : rupiah(Number(value))) : "—"}
                </strong>
              </section>
            ))}
          </div>
          <OwnerCoverage rows={rows} />
          <div className="income-split">
            <div className="income-main-column">
              <OutletDashboardTable rows={rows} />
              <OwnerAttention rows={rows} />
            </div>
            <aside className="income-side-column" aria-label="Ringkasan owner">
              <OutletDashboardChart rows={rows} />
              <OwnerInsights rows={rows} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
