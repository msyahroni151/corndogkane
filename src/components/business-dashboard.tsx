import { BusinessOutletMap, type DashboardLocation } from "@/components/business-outlet-map";
import { BusinessDashboardDistribution } from "@/components/business-dashboard-distribution";
import { BusinessOutletPerformance } from "@/components/business-outlet-performance";
import { BusinessDashboardRefresh } from "@/components/business-dashboard-refresh";
import Link from "next/link";
import { LocalInput } from "@/components/local-input";
import { UiIcon, type IconName } from "@/components/ui-icon";
import { OutletDashboardTable } from "@/components/outlet-dashboard-table";
import { OwnerCoverage, OwnerAttention, OwnerInsights } from "@/components/outlet-owner-insights";
import { BusinessDashboardTrend } from "@/components/business-dashboard-trend";
import {
  growth,
  dashboardPresets,
  summarizeBusiness,
  type BusinessEntry,
} from "@/lib/business-dashboard";
import { ownerInsights, type OutletDashboardRow } from "@/lib/outlet-dashboard";
import type { BusinessSnapshot } from "@/lib/business-dashboard-data";
import { rupiah } from "@/lib/money";
import { dateToDisplay } from "@/lib/local-date";
import "./outlet-income-dashboard.css";
import "./business-dashboard.css";
function Change({ current, previous }: { current: number | null; previous: number | null }) {
  const rate = growth(current, previous);
  return (
    <span className={"business-change " + (rate === null ? "" : rate < 0 ? "is-down" : "is-up")}>
      {rate === null
        ? previous === null
          ? "Belum ada pembanding"
          : previous === 0
            ? "Pembanding Rp0"
            : "Data belum tersedia"
        : (rate >= 0 ? "+" : "") + rate.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%"}
    </span>
  );
}
function Metric({
  label,
  value,
  note,
  icon = "dashboard",
  change,
}: {
  label: string;
  value: string;
  note: string;
  icon?: IconName;
  change?: { current: number | null; previous: number | null };
}) {
  return (
    <section className="panel business-metric">
      <div>
        <span>{label}</span>
        <i>
          <UiIcon name={icon} size={17} />
        </i>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
      {change && <Change {...change} />}
    </section>
  );
}
export function BusinessDashboard({
  userName,
  locations,
  canEditLocations,
  rows,
  entries,
  previousEntries,
  history,
  from,
  to,
  previousFrom,
  previousTo,
  area,
  outlet,
  areas,
  outlets,
  compare,
  today,
  snapshot,
  error,
  canFinance,
  updated,
  period,
}: {
  userName: string;
  locations: DashboardLocation[];
  canEditLocations: boolean;
  rows: OutletDashboardRow[];
  entries: BusinessEntry[];
  previousEntries: BusinessEntry[];
  history: BusinessEntry[];
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  area: string;
  outlet: string;
  areas: { id: string; name: string }[];
  outlets: { id: string; name: string; areaId: string }[];
  compare: string;
  today: string;
  snapshot: BusinessSnapshot;
  error: string;
  canFinance: boolean;
  updated: string;
  period: string;
}) {
  const info = ownerInsights(rows),
    current = summarizeBusiness(entries),
    previous = summarizeBusiness(previousEntries);
  const before = new Map<string, BusinessEntry[]>();
  for (const e of previousEntries) before.set(e.outletId, [...(before.get(e.outletId) || []), e]);
  const common = rows.filter((r) => r.records && before.has(r.id)),
    sameCurrent = common.length ? common.reduce((n, r) => n + r.gross, 0) : null,
    samePrevious = common.length
      ? common.reduce((n, r) => n + before.get(r.id)!.reduce((s, e) => s + e.totalGross, 0), 0)
      : null;
  const base = "/menu-utama/dashboard";
  const href = (changes: Record<string, string>) =>
    base + "?" + new URLSearchParams({ from, to, area, outlet, compare, period, ...changes });
  const alerts = [
    ...(info.missing.length
      ? [
          {
            label: "Rekap outlet belum lengkap",
            detail: info.missing.length + " outlet memiliki jadwal kerja yang belum direkap.",
            href: "#business-outlets",
          },
        ]
      : []),
    ...(info.pending
      ? [
          {
            label: "Setoran belum terisi",
            detail: info.pending + " rekap · cash tercatat " + rupiah(info.pendingCash),
            href: "#business-cash",
          },
        ]
      : []),
    ...(info.shortage || info.excess
      ? [
          {
            label: "Selisih setoran perlu diperiksa",
            detail: "Kurang " + rupiah(info.shortage) + " · lebih " + rupiah(info.excess),
            href: "#business-cash",
          },
        ]
      : []),
    ...snapshot.alerts,
  ];
  return (
    <div className="business-dashboard">
      <div className="business-intro">
        <div>
          <h1>Selamat datang, {userName}.</h1>
          <p>Pantau penjualan, operasional, dan jangkauan Corndog Kane dalam satu dashboard.</p>
          <small>
            Diperbarui{" "}
            {new Date(updated).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            WIB
          </small>
        </div>
        <BusinessDashboardRefresh />
      </div>
      <section className="panel business-filters" aria-label="Filter dashboard">
        <div className="business-presets">
          {dashboardPresets(today).map((p) => (
            <Link
              prefetch={false}
              key={p.key}
              href={href({ from: p.from, to: p.to, period: p.key })}
              aria-current={from === p.from && to === p.to ? "page" : undefined}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form>
          <input type="hidden" name="period" value={period} />
          <label className="field">
            Dari tanggal
            <LocalInput name="from" type="date" defaultValue={from} max={today} required />
          </label>
          <label className="field">
            Sampai tanggal
            <LocalInput name="to" type="date" defaultValue={to} max={today} required />
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
          <label className="field">
            Outlet
            <select name="outlet" defaultValue={outlet}>
              <option value="">Semua outlet</option>
              {outlets
                .filter((o) => !area || o.areaId === area)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Bandingkan
            <select name="compare" defaultValue={compare}>
              <option value="previous">Periode sebelumnya</option>
              <option value="year">Periode tahun lalu</option>
            </select>
          </label>
          <button className="button-primary">Terapkan</button>
        </form>
        <p>
          Periode {dateToDisplay(from)}–{dateToDisplay(to)} WIB · pembanding{" "}
          {dateToDisplay(previousFrom)}–{dateToDisplay(previousTo)} WIB.
        </p>
      </section>
      {error ? (
        <section className="panel business-empty" role="alert">
          {error}
        </section>
      ) : (
        <>
          <div className="business-metrics">
            <Metric
              label="OMZET TERCATAT"
              value={current.gross === null ? "Data belum tersedia" : rupiah(current.gross)}
              note={current.records + " rekap outlet · bukan jumlah transaksi POS"}
              change={{ current: current.gross, previous: previous.gross }}
              icon="receipt"
            />
            <Metric
              label="HPP / COGS"
              value="Data belum tersedia"
              note="Menunggu harga pokok transaksi penjualan."
              icon="box"
            />
            <Metric
              label="LABA KOTOR"
              value="Data belum tersedia"
              note="Menunggu HPP / COGS penjualan yang terhubung."
              icon="coins"
            />
            <Metric
              label="LABA OPERASIONAL"
              value="Data belum tersedia"
              note="Menunggu HPP dan seluruh beban yang lengkap."
              icon="coins"
            />
            <Metric
              label="LABA BERSIH"
              value="Data belum tersedia"
              note="Menunggu seluruh beban dan rekonsiliasi perusahaan."
              icon="coins"
            />
            <Metric
              label="MARGIN LABA"
              value="Data belum tersedia"
              note="Dihitung setelah laba dan pendapatan lengkap."
              icon="coins"
            />
            <Metric
              label="SETORAN CASH DITERIMA"
              value={info.receipts ? rupiah(info.received) : "Data belum tersedia"}
              note={
                info.receipts + " dari " + info.records + " rekap terisi · bukan saldo kas akhir"
              }
              icon="wallet"
            />
            <Metric
              label="OUTLET BEROPERASI"
              value={String(rows.filter((r) => (r.schedule?.openDays || 0) > 0).length)}
              note={rows.length + " outlet terpantau · mengikuti jadwal HR"}
              icon="building"
            />
          </div>
          <section className="business-data-status" aria-label="Status kelengkapan laba">
            <details>
              <summary>Laba dan margin belum dapat disimpulkan</summary>
              <p>
                Bagian HPP / COGS, laba kotor, laba operasional, dan margin sudah disiapkan.
                Angkanya menunggu HPP transaksi, alokasi beban outlet / kantor, payroll, penyusutan,
                dan rekonsiliasi yang lengkap. Omzet tinggi belum membuktikan bisnis untung; data
                yang kosong tidak diubah menjadi nol.
              </p>
              {canFinance && (
                <Link href="/finance/laporan-akuntansi" className="business-inline-link">
                  Lihat Laporan & Akuntansi →
                </Link>
              )}
            </details>
          </section>
          <section className="panel business-period-summary" aria-label="Perbandingan periode">
            <div>
              <h2>Perbandingan periode</h2>
              <p>Rentang setara tanggal, bukan bulan berjalan dibandingkan satu bulan penuh.</p>
            </div>
            <div>
              <span>Omzet periode ini</span>
              <strong>{current.gross === null ? "—" : rupiah(current.gross)}</strong>
            </div>
            <div>
              <span>Omzet pembanding</span>
              <strong>{previous.gross === null ? "—" : rupiah(previous.gross)}</strong>
            </div>
            <div>
              <span>Perubahan seluruh outlet</span>
              <Change current={current.gross} previous={previous.gross} />
            </div>
            <div>
              <span>Outlet yang sama</span>
              <Change current={sameCurrent} previous={samePrevious} />
              <small>{common.length} outlet memiliki rekap pada kedua periode</small>
            </div>
          </section>
          <div className="business-snapshot-cards">
            {snapshot.modules
              .filter((m) => ["people", "stock", "purchase", "production"].includes(m.id))
              .map((m) => (
                <section className={`panel business-quick-card is-${m.id}`} key={m.id}>
                  <div>
                    <span>{m.title}</span>
                    <i>
                      <UiIcon name={m.id === "people" ? "building" : "box"} size={19} />
                    </i>
                  </div>
                  <strong>{m.rows[0]?.value}</strong>
                  <p>{m.rows[0]?.label}</p>
                  <footer>
                    <small>{m.scope}</small>
                    <Link href={m.href} prefetch={false}>
                      Lihat →
                    </Link>
                  </footer>
                </section>
              ))}
          </div>
          <OwnerCoverage rows={rows} />
          <div className="business-main-split">
            <BusinessDashboardTrend entries={entries} history={history} from={from} to={to} />
            <aside className="business-attention" aria-label="Perhatian owner">
              <section className="panel">
                <div className="business-section-heading">
                  <div>
                    <h2>Perlu ditindaklanjuti</h2>
                    <p>Operasional periode ini dan kondisi modul saat ini.</p>
                  </div>
                  <span className="business-count">{alerts.length}</span>
                </div>
                <ul>
                  {alerts.map((a, i) => (
                    <li key={i}>
                      <Link href={a.href} prefetch={false}>
                        <strong>{a.label}</strong>
                        <span>{a.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {!alerts.length && (
                  <p className="business-empty">
                    {current.records
                      ? "Tidak ada temuan dari data yang sudah tercatat."
                      : "Belum ada rekap untuk menilai kondisi operasional."}
                  </p>
                )}
              </section>
              <section className="panel business-readiness">
                <h2>Kelengkapan perjalanan data</h2>
                {[
                  [
                    "Rekap penjualan",
                    current.records ? current.records + " rekap tersedia" : "Belum tersedia",
                  ],
                  ["Setoran", info.receipts + " / " + info.records + " rekap terisi"],
                  ["HPP / COGS transaksi", "Menunggu sumber penjualan"],
                  ["Beban & penyusutan", "Belum direkonsiliasi"],
                  ["Laba bersih perusahaan", "Data belum tersedia"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <p>
                  Indikator ini menunjukkan ketersediaan data, bukan persentase keberhasilan bisnis.
                </p>
              </section>
            </aside>
          </div>
          <div className="business-geography-grid">
            <BusinessOutletMap outlets={locations} canEdit={canEditLocations} />
            <BusinessDashboardDistribution rows={rows} locations={locations} />
          </div>
          <BusinessOutletPerformance
            rows={rows}
            entries={entries}
            previousEntries={previousEntries}
            snapshot={snapshot}
            from={from}
            to={to}
            previousFrom={previousFrom}
            previousTo={previousTo}
          />
          <section aria-label="Ringkasan seluruh modul">
            <div className="business-section-heading">
              <div>
                <h2>Ringkasan lintas menu</h2>
                <p>
                  Rekap outlet dan spoil mengikuti filter outlet. Kartu bertanda perusahaan / gudang
                  mencakup lingkup global; posisi saat ini tidak berubah mengikuti tanggal historis.
                </p>
              </div>
            </div>
            <div className="business-modules">
              {snapshot.modules.map((m) => (
                <section key={m.id} className="panel business-module">
                  <div>
                    <h3>
                      <UiIcon
                        name={
                          m.id === "finance" ? "wallet" : m.id === "people" ? "building" : "box"
                        }
                        size={16}
                      />
                      {m.title}
                    </h3>
                    <Link href={m.href} prefetch={false} aria-label={"Buka " + m.title}>
                      Lihat →
                    </Link>
                  </div>
                  <small>{m.scope}</small>
                  <dl>
                    {m.rows.map((r, i) => (
                      <div key={i}>
                        <dt>{r.label}</dt>
                        <dd>{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>{m.note}</p>
                </section>
              ))}
            </div>
            {!snapshot.modules.length && (
              <p className="panel business-empty">
                Ringkasan modul tambahan mengikuti hak akses akun. Rekap outlet tetap tersedia di
                atas.
              </p>
            )}
          </section>
          <details id="business-cash" className="business-operational-details">
            <summary>Rincian operasional: setoran, QRIS, online food, bonus, dan adonan</summary>
            <div className="space-y-4">
              <OutletDashboardTable rows={rows} />
              <div className="business-main-split">
                <OwnerAttention rows={rows} />
                <OwnerInsights rows={rows} />
              </div>
            </div>
          </details>
          <p className="business-footnote">
            Angka dari sumber yang berbeda tidak dijumlahkan otomatis sebagai laba. Tidak ada
            transaksi baru atau perubahan stok yang dibuat oleh dashboard ini.
          </p>
        </>
      )}
    </div>
  );
}
