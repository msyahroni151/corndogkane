"use client";
import { useMemo, useState } from "react";
import { dashboardTrend, monthlyHistory, type BusinessEntry } from "@/lib/business-dashboard";
import { rupiah } from "@/lib/money";
export function BusinessDashboardTrend({
  entries,
  history,
  from,
  to,
}: {
  entries: BusinessEntry[];
  history: BusinessEntry[];
  from: string;
  to: string;
}) {
  const [grain, setGrain] = useState<"day" | "week" | "month">("day"),
    [metric, setMetric] = useState<"gross" | "expense">("gross");
  const points = useMemo(
    () => dashboardTrend(entries, from, to, grain),
    [entries, from, to, grain],
  );
  const months = useMemo(() => monthlyHistory(history, to).points, [history, to]);
  const values = points.flatMap((p) => (p[metric] === null ? [] : [p[metric]!])),
    max = Math.max(1, ...values),
    width = 720,
    height = 200;
  const x = (i: number) => 30 + (points.length > 1 ? i / (points.length - 1) : 0.5) * (width - 60),
    y = (v: number) => height - 20 - (v / max) * (height - 45);
  let path = "",
    connected = false;
  for (const [i, p] of points.entries()) {
    const value = p[metric];
    if (value === null) {
      connected = false;
      continue;
    }
    path += (connected ? " L" : " M") + x(i) + "," + y(value);
    connected = true;
  }
  const label = metric === "gross" ? "Omzet" : "Pengeluaran rekap";
  const monthMax = Math.max(1, ...months.map((m) => m.gross || 0));
  return (
    <div className="space-y-4">
      <section className="panel business-chart" aria-label="Grafik perkembangan bisnis">
        <div className="business-section-heading">
          <div>
            <h2>Pergerakan bisnis</h2>
            <p>{label} dari rekap outlet pada periode terpilih.</p>
          </div>
          <div className="business-chart-controls">
            <div className="business-tabs" aria-label="Pengelompokan tren">
              {(
                [
                  ["day", "Harian"],
                  ["week", "Mingguan"],
                  ["month", "Bulanan"],
                ] as const
              ).map(([key, text]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={grain === key}
                  onClick={() => setGrain(key)}
                >
                  {text}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="business-trend-metric">
              Nilai grafik
            </label>
            <select
              id="business-trend-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as "gross" | "expense")}
            >
              <option value="gross">Omzet</option>
              <option value="expense">Pengeluaran rekap</option>
            </select>
          </div>
        </div>
        {values.length ? (
          <>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`Tren ${label.toLowerCase()} ${grain === "day" ? "harian" : grain === "week" ? "mingguan" : "bulanan"}`}
              className="business-line-chart"
            >
              <line x1="30" x2={width - 30} y1={height - 20} y2={height - 20} stroke="#dce7df" />
              <line
                x1="30"
                x2={width - 30}
                y1="25"
                y2="25"
                stroke="#e9efeb"
                strokeDasharray="4 4"
              />
              <text x="30" y="15" fontSize="10" fill="#64748b">
                {rupiah(max)}
              </text>
              <path
                d={path}
                fill="none"
                stroke={metric === "gross" ? "#44785a" : "#d97706"}
                strokeWidth="3"
              />
              {points.map(
                (p, i) =>
                  p[metric] !== null && (
                    <circle
                      key={p.key}
                      cx={x(i)}
                      cy={y(p[metric]!)}
                      r="4"
                      fill={metric === "gross" ? "#44785a" : "#d97706"}
                    >
                      <title>{`${p.key}: ${rupiah(p[metric]!)} · ${p.records} rekap`}</title>
                    </circle>
                  ),
              )}
            </svg>
            <div className="business-chart-dates">
              <span>{from}</span>
              <span>{to}</span>
            </div>
          </>
        ) : (
          <p className="business-empty">
            Belum ada data {label.toLowerCase()} yang lengkap pada periode ini.
          </p>
        )}
        <p className="business-footnote">
          Celah grafik berarti data belum tersedia. Pengeluaran yang belum diisi tidak dianggap Rp0.
          HPP, laba, dan margin akan ditampilkan setelah data penjualan dan biayanya terhubung.
        </p>
        <details className="business-chart-details">
          <summary>
            Lihat angka{" "}
            {grain === "day" ? "per hari" : grain === "week" ? "per minggu" : "per bulan"}
          </summary>
          <div className="business-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Omzet</th>
                  <th>Pengeluaran rekap</th>
                  <th>Rekap</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.key}>
                    <td>
                      {p.key}
                      {grain === "week" ? " (awal minggu)" : ""}
                    </td>
                    <td>{p.gross === null ? "Data belum tersedia" : rupiah(p.gross)}</td>
                    <td>{p.expense === null ? "Data belum tersedia" : rupiah(p.expense)}</td>
                    <td>{p.records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section className="panel business-chart" aria-label="Perbandingan omzet 12 bulan">
        <div className="business-section-heading">
          <div>
            <h2>Perkembangan 12 bulan</h2>
            <p>
              Omzet outlet sesuai filter. Bulan terakhir sampai {to}; bulan yang belum selesai
              ditampilkan sebagai periode berjalan.
            </p>
          </div>
        </div>
        <div className="business-month-scroll">
          <div className="business-months">
            {months.map((p) => (
              <div
                key={p.key}
                className="business-month"
                title={p.key + ": " + (p.gross === null ? "Belum ada rekap" : rupiah(p.gross))}
              >
                <span>
                  {p.gross === null
                    ? "—"
                    : new Intl.NumberFormat("id-ID", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(p.gross)}
                </span>
                <div className="business-month-track">
                  <div
                    className={p.gross === null ? "is-empty" : ""}
                    style={{
                      height:
                        p.gross === null ? "2px" : Math.max(2, (p.gross / monthMax) * 100) + "%",
                    }}
                  />
                </div>
                <strong>
                  {new Date(p.key + "-01T00:00:00Z").toLocaleDateString("id-ID", {
                    month: "short",
                    year: "2-digit",
                    timeZone: "UTC",
                  })}
                </strong>
              </div>
            ))}
          </div>
        </div>
        <p className="business-footnote">
          Perbandingan setara tanggal tersedia di ringkasan periode. Tinggi batang bulan berjalan
          belum bisa dibandingkan langsung dengan satu bulan penuh.
        </p>
      </section>
    </div>
  );
}
