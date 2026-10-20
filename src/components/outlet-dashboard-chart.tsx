"use client";
import { useState } from "react";
import type { OutletDashboardRow } from "@/lib/outlet-dashboard";
import { rupiah } from "@/lib/money";
const metrics = [
  { key: "gross", label: "Omzet" },
  { key: "cash", label: "Cash" },
  { key: "qris", label: "QRIS" },
  { key: "expense", label: "Pengeluaran" },
] as const;
export function OutletDashboardChart({ rows }: { rows: OutletDashboardRow[] }) {
  const [metric, setMetric] = useState<(typeof metrics)[number]["key"]>("gross");
  const data = rows
    .filter((r) => r.records > 0)
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, "id-ID"));
  const max = Math.max(1, ...data.map((r) => Math.abs(r[metric])));
  const label = metrics.find((m) => m.key === metric)!.label;
  return (
    <section className="panel outlet-income-chart" aria-label="Grafik pendapatan outlet">
      <div className="income-section-heading">
        <div>
          <h2>Grafik pendapatan per outlet</h2>
          <p>Perbandingan {label.toLowerCase()} pada periode yang dipilih.</p>
        </div>
        <div className="income-chart-tabs" aria-label="Pilihan nilai grafik">
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {!data.length ? (
        <p className="income-empty">Belum ada rekap operasional pada periode ini.</p>
      ) : (
        <div className="income-bars" role="list" aria-label={label + " per outlet"}>
          {data.map((r) => (
            <div
              key={r.id}
              className="income-bar-row"
              role="listitem"
              aria-label={r.name + ": " + rupiah(r[metric])}
            >
              <div className="income-bar-label">
                <strong>{r.name}</strong>
                <span>{r.crew || "—"}</span>
              </div>
              <div className="income-bar-track" aria-hidden="true">
                <div
                  className={r[metric] < 0 ? "income-bar negative" : "income-bar"}
                  style={{ width: (Math.abs(r[metric]) / max) * 100 + "%" }}
                />
              </div>
              <span className="income-bar-amount">{rupiah(r[metric])}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
