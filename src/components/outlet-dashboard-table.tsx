"use client";
import { useState } from "react";
import { outletScheduleLabel } from "@/lib/outlet-schedule-status";
import { SortableTable } from "@/components/sortable-table";
import { dashboardTotals, type OutletDashboardRow } from "@/lib/outlet-dashboard";
import { rupiah } from "@/lib/money";
const all = [
  { key: "gross", label: "Omzet" },
  { key: "bonus", label: "Bonus" },
  { key: "expense", label: "Pengeluaran" },
  { key: "online", label: "Online Food" },
  { key: "qris", label: "QRIS" },
  { key: "cash", label: "Cash" },
  { key: "real", label: "Real" },
  { key: "difference", label: "Selisih" },
] as const;
export function OutletDashboardTable({ rows }: { rows: OutletDashboardRow[] }) {
  const [detail, setDetail] = useState(false),
    totals = dashboardTotals(rows);
  const columns = all.filter(
    (c) => detail || ["gross", "cash", "real", "difference"].includes(c.key),
  );
  const span = columns.length + 2;
  return (
    <section className="panel income-recap" aria-label="Rekap pendapatan tiap outlet">
      <div className="income-section-heading">
        <div>
          <h2>Rekap pendapatan tiap outlet</h2>
          <p>Crew mengikuti rekap operasional pada periode ini.</p>
        </div>
        <button
          type="button"
          className="income-detail-button"
          aria-pressed={detail}
          onClick={() => setDetail(!detail)}
        >
          {detail ? "Tampilan ringkas" : "Detail keuangan"}
        </button>
      </div>
      <div className="income-table-scroll">
        <SortableTable
          className={
            "income-recap-table " + (detail ? "income-table-detail" : "income-table-compact")
          }
        >
          <caption className="sr-only">
            Rekap pendapatan outlet. Total mencakup seluruh hasil filter.
          </caption>
          <thead>
            <tr>
              <th>Cabang</th>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>Nama / Training</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="income-outlet-name">
                  <strong>{r.name}</strong>
                  <small>
                    {r.areaName}
                    {!r.records && r.schedule?.openDays !== 0 ? " · Belum ada rekap" : ""}
                    {r.closed ? " · Tutup permanen" : ""}
                  </small>
                  {r.schedule && !r.closed && (
                    <span
                      className={
                        "income-daily-status " + (r.schedule.openDays ? "is-open" : "is-closed")
                      }
                    >
                      {outletScheduleLabel(r.schedule)}
                    </span>
                  )}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    data-sort-value={r.records ? (r[c.key] ?? "") : ""}
                    className={
                      "income-money" +
                      (c.key === "difference" && r.difference
                        ? r.difference < 0
                          ? " income-short"
                          : " income-over"
                        : "")
                    }
                  >
                    {r.records && r[c.key] != null ? rupiah(r[c.key]!) : "—"}
                  </td>
                ))}
                <td className="income-crew">
                  {r.crew || r.schedule?.crewNames.join(", ") || "—"}
                  {!r.crew && !!r.schedule?.crewNames.length && <small>Dari jadwal</small>}
                  {r.training && <small>Training: {r.training}</small>}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={span} className="income-empty">
                  Tidak ada outlet untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>Total hasil filter</th>
              {columns.map((c) => (
                <td className="income-money" key={c.key}>
                  {totals.reported && totals[c.key] != null ? rupiah(totals[c.key]!) : "—"}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </SortableTable>
      </div>
      <details className="income-formula">
        <summary>Rumus & keterangan</summary>
        <p>
          Cash = omzet − QRIS − online food − pengeluaran. REAL = setoran cash diterima. Selisih =
          REAL − CASH. Tanda — berarti data belum tersedia; total REAL dan selisih lengkap setelah
          seluruh rekap terisi.
        </p>
      </details>
    </section>
  );
}
