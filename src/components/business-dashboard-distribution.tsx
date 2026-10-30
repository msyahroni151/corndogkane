import type { OutletDashboardRow } from "@/lib/outlet-dashboard";
import type { DashboardLocation } from "@/components/business-outlet-map";
import { rupiah } from "@/lib/money";
export function BusinessDashboardDistribution({
  rows,
  locations,
}: {
  rows: OutletDashboardRow[];
  locations: DashboardLocation[];
}) {
  const known = rows.filter((r) => r.records > 0),
    gross = known.reduce((n, r) => n + r.gross, 0),
    qris = known.reduce((n, r) => n + r.qris, 0),
    online = known.reduce((n, r) => n + r.online, 0),
    cash = gross - qris - online;
  const valid = known.length > 0 && gross > 0 && cash >= 0;
  const segments = [
    { label: "Tunai penjualan", value: cash, color: "#56885b" },
    { label: "QRIS", value: qris, color: "#6a8ed1" },
    { label: "Online food", value: online, color: "#d2a354" },
  ];
  const gradient = valid
    ? `conic-gradient(#56885b 0 ${(cash / gross) * 100}%, #6a8ed1 ${(cash / gross) * 100}% ${((cash + qris) / gross) * 100}%, #d2a354 ${((cash + qris) / gross) * 100}% 100%)`
    : "#e7eeea";
  const areas = new Map<string, number>();
  for (const o of locations.filter((o) => o.active && !o.closed))
    areas.set(o.areaName, (areas.get(o.areaName) || 0) + 1);
  const ranked = [...areas.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id-ID"),
    ),
    max = Math.max(1, ...ranked.map((a) => a[1]));
  return (
    <div className="business-distribution-stack">
      <section className="panel business-payment-card" aria-label="Komposisi pembayaran">
        <div className="business-section-heading">
          <div>
            <h2>Komposisi pembayaran</h2>
            <p>Penjualan periode terpilih sebelum pengeluaran.</p>
          </div>
        </div>
        <div className="business-payment-body">
          <div
            className="business-donut"
            role="img"
            aria-label={
              valid
                ? segments.map((s) => `${s.label} ${rupiah(s.value)}`).join(", ")
                : "Komposisi pembayaran belum tersedia"
            }
            style={{ background: gradient }}
          >
            <div>
              <small>Omzet tercatat</small>
              <strong>{known.length ? rupiah(gross) : "Belum ada rekap"}</strong>
            </div>
          </div>
          <ul>
            {segments.map((s) => (
              <li key={s.label}>
                <i style={{ background: s.color }} />
                <div>
                  <span>{s.label}</span>
                  <strong>{valid ? rupiah(s.value) : "—"}</strong>
                </div>
                <small>
                  {valid
                    ? `${((s.value / gross) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
                    : "—"}
                </small>
              </li>
            ))}
          </ul>
        </div>
        <p className="business-footnote">
          {cash < 0
            ? "Nominal non-tunai melebihi omzet; periksa rekap sebelum menyimpulkan komposisi pembayaran."
            : !valid
              ? "Belum ada penjualan bernilai positif untuk dihitung proporsinya."
              : "Tunai penjualan dihitung dari omzet dikurangi QRIS dan online food; berbeda dari setoran setelah pengeluaran."}
        </p>
      </section>
      <section className="panel business-area-card" aria-label="Sebaran outlet per area">
        <div className="business-section-heading">
          <div>
            <h2>Sebaran outlet per area</h2>
            <p>Jumlah outlet aktif saat ini, sesuai filter.</p>
          </div>
          <span className="business-count">{ranked.length} area</span>
        </div>
        <div className="business-area-bars">
          {ranked.map(([area, count]) => (
            <div key={area}>
              <span>{area}</span>
              <div role="img" aria-label={`${area}: ${count} outlet aktif`}>
                <i style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        {!ranked.length && (
          <p className="business-empty">Belum ada outlet aktif pada filter ini.</p>
        )}
      </section>
    </div>
  );
}
