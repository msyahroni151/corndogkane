import { growth, summarizeBusiness, type BusinessEntry } from "@/lib/business-dashboard";
import type { BusinessSnapshot } from "@/lib/business-dashboard-data";
import type { OutletDashboardRow } from "@/lib/outlet-dashboard";
import { dateToDisplay } from "@/lib/local-date";
import { rupiah } from "@/lib/money";

function movement(current: number | null, previous: number | null) {
  const rate = growth(current, previous);
  if (current === null) return { label: "Belum ada rekap", tone: "unknown", rate };
  if (previous === null) return { label: "Belum ada pembanding", tone: "unknown", rate };
  if (previous === 0)
    return { label: current === 0 ? "Tetap Rp 0" : "Dari Rp 0", tone: "unknown", rate };
  if (rate === 0) return { label: "Tetap 0%", tone: "neutral", rate };
  return {
    label: `${rate! > 0 ? "↑ Naik" : "↓ Turun"} ${Math.abs(rate!).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`,
    tone: rate! > 0 ? "up" : "down",
    rate,
  };
}

export function BusinessOutletPerformance({
  rows,
  entries,
  previousEntries,
  snapshot,
  from,
  to,
  previousFrom,
  previousTo,
}: {
  rows: OutletDashboardRow[];
  entries: BusinessEntry[];
  previousEntries: BusinessEntry[];
  snapshot: BusinessSnapshot;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}) {
  const prior = new Map<string, BusinessEntry[]>();
  for (const entry of previousEntries)
    prior.set(entry.outletId, [...(prior.get(entry.outletId) || []), entry]);
  const ranked = rows
    .map((row) => {
      const current = row.records ? row.gross : null;
      const previous = summarizeBusiness(prior.get(row.id) || []).gross;
      return { row, current, previous, ...movement(current, previous) };
    })
    .sort(
      (a, b) =>
        Number(b.current !== null) - Number(a.current !== null) ||
        (b.current ?? 0) - (a.current ?? 0) ||
        a.row.name.localeCompare(b.row.name, "id-ID"),
    );
  const maximum = Math.max(1, ...ranked.flatMap((r) => [r.current ?? 0, r.previous ?? 0]));
  const leader = ranked.find((r) => r.current !== null);
  const rising = ranked
    .filter((r) => r.rate !== null && r.rate > 0)
    .sort((a, b) => b.rate! - a.rate!)[0];
  const falling = ranked.filter((r) => r.rate !== null && r.rate < 0);
  const compared = ranked.filter((r) => r.rate !== null).length;
  const periods = {
    current: `${dateToDisplay(from)}–${dateToDisplay(to)}`,
    previous: `${dateToDisplay(previousFrom)}–${dateToDisplay(previousTo)}`,
  };
  return (
    <section
      id="business-outlets"
      className="panel business-outlet-performance"
      aria-label="Kinerja setiap outlet"
    >
      <div className="business-section-heading">
        <div>
          <h2>Kinerja setiap outlet</h2>
          <p>
            Bandingkan panjang batang untuk melihat omzet. Penanda naik / turun menunjukkan
            perubahan terhadap periode pembanding.
          </p>
        </div>
        <span className="business-count">{rows.length} outlet</span>
      </div>
      <div className="business-outlet-highlights">
        <div>
          <span>Omzet tertinggi</span>
          <strong>{leader?.row.name || "Belum ada rekap"}</strong>
          <small>{leader ? rupiah(leader.current!) : "Menunggu rekap outlet"}</small>
        </div>
        <div>
          <span>Kenaikan terbesar</span>
          <strong>{rising?.row.name || "Belum ada kenaikan"}</strong>
          <small>{rising ? rising.label : "Dari outlet dengan pembanding di atas Rp 0"}</small>
        </div>
        <div>
          <span>Outlet menurun</span>
          <strong>{compared ? `${falling.length} outlet` : "Belum ada pembanding"}</strong>
          <small>
            {compared
              ? `Dari ${compared} outlet yang dapat dibandingkan`
              : "Menunggu rekap pada kedua periode"}
          </small>
        </div>
      </div>
      <div className="business-outlet-legend">
        <span>
          <i className="is-current" />
          Periode ini · {periods.current}
        </span>
        <span>
          <i className="is-previous" />
          Pembanding · {periods.previous}
        </span>
      </div>
      <div
        className="business-outlet-bars"
        role="group"
        aria-label="Grafik perbandingan omzet outlet"
        tabIndex={0}
      >
        {ranked.map(({ row, current, previous, label, tone }) => {
          const loss = snapshot.losses[row.id];
          const missingCost = entries.some(
            (e) => e.outletId === row.id && e.expenseAmount === null,
          );
          return (
            <article
              className="business-outlet-row"
              key={row.id}
              aria-label={`Kinerja ${row.name}`}
            >
              <div className="business-outlet-name">
                <h3>{row.name}</h3>
                <small>
                  {row.areaName} ·{" "}
                  {row.closed || row.schedule?.openDays === 0 ? "Tutup" : "Terjadwal"}
                </small>
                <span className={`business-outlet-movement is-${tone}`}>{label}</span>
                {current !== null && previous !== null && (
                  <small>
                    Selisih {current - previous > 0 ? "+" : ""}
                    {rupiah(current - previous)}
                  </small>
                )}
              </div>
              <div className="business-outlet-bar-pair">
                {(
                  [
                    ["current", current, "Periode ini"],
                    ["previous", previous, "Pembanding"],
                  ] as const
                ).map(([kind, value, title]) => (
                  <div className="business-outlet-bar-line" key={kind}>
                    <div
                      className="business-outlet-track"
                      role="img"
                      aria-label={`${title}: ${value === null ? "Belum ada rekap" : rupiah(value)}`}
                    >
                      {value !== null && (
                        <span
                          className={`is-${kind}`}
                          style={{ width: `${(Math.max(0, value) / maximum) * 100}%` }}
                        />
                      )}
                    </div>
                    <strong>{value === null ? "Belum ada rekap" : rupiah(value)}</strong>
                  </div>
                ))}
                {row.missingWorkDays > 0 && (
                  <small className="business-outlet-warning">
                    {row.missingWorkDays} hari terjadwal belum direkap · omzet belum lengkap
                  </small>
                )}
              </div>
              <details className="business-outlet-detail">
                <summary>Rincian {row.name}</summary>
                <dl>
                  <div>
                    <dt>Crew bertugas</dt>
                    <dd>
                      {row.crew || row.schedule?.crewNames.join(", ") || "Belum ada petugas"}
                      {row.training ? ` · Training: ${row.training}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Pengeluaran rekap</dt>
                    <dd>
                      {!row.records
                        ? "Belum ada rekap"
                        : missingCost
                          ? "Belum lengkap"
                          : rupiah(row.expense)}
                    </dd>
                  </div>
                  <div>
                    <dt>Spoil tercatat</dt>
                    <dd>
                      {!snapshot.canSeeLoss
                        ? "Memerlukan akses Control Stok"
                        : loss?.unknown
                          ? "Nilai belum lengkap"
                          : rupiah(loss?.value || 0)}
                      {loss ? ` · ${loss.count} catatan` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>HPP / COGS & laba operasional</dt>
                    <dd>Data belum tersedia</dd>
                  </div>
                </dl>
              </details>
            </article>
          );
        })}
        {!rows.length && <p className="business-empty">Belum ada outlet pada filter ini.</p>}
      </div>
      <p className="business-footnote">
        Urutan berdasarkan omzet tercatat, bukan laba. Semua batang memakai skala rupiah yang sama.
        Belum ada rekap berbeda dengan omzet Rp 0; kelengkapan rekap kedua periode dapat memengaruhi
        perubahan.
      </p>
    </section>
  );
}
