import { ownerInsights, dashboardTotals, type OutletDashboardRow } from "@/lib/outlet-dashboard";
import { rupiah } from "@/lib/money";
export function OwnerCoverage({ rows }: { rows: OutletDashboardRow[] }) {
  const info = ownerInsights(rows),
    totals = dashboardTotals(rows);
  return (
    <section className="owner-coverage panel" aria-label="Kelengkapan operasional">
      <div>
        <span>Outlet melapor</span>
        <strong>
          {totals.reported}
          <small> / {rows.length} outlet</small>
        </strong>
        <progress value={totals.reported} max={rows.length || 1} aria-label="Outlet melapor" />
      </div>
      <div>
        <span>Setoran terisi</span>
        <strong>
          {info.receipts}
          <small> / {info.records} rekap</small>
        </strong>
      </div>
      <div>
        <span>Crew bertugas</span>
        <strong>
          {info.crewCount}
          <small> orang</small>
        </strong>
      </div>
      <div>
        <span>Adonan terpakai</span>
        <strong>
          {info.doughReports ? info.doughPcs.toLocaleString("id-ID") : "—"}
          <small> pcs</small>
        </strong>
        <small>
          {info.doughReports}/{info.records} rekap terisi
        </small>
      </div>
    </section>
  );
}
export function OwnerInsights({ rows }: { rows: OutletDashboardRow[] }) {
  const info = ownerInsights(rows),
    totals = dashboardTotals(rows);
  const tender = [
    { name: "Tunai", value: totals.gross - totals.qris - totals.online },
    { name: "QRIS", value: totals.qris },
    { name: "Online Food", value: totals.online },
  ];
  const validMix = totals.gross > 0 && tender.every((t) => t.value >= 0);
  return (
    <>
      <section className="panel owner-settlements" aria-label="Kontrol setoran">
        <div className="income-section-heading">
          <h2>Kontrol setoran</h2>
        </div>
        <dl>
          <div>
            <dt>Setoran diterima</dt>
            <dd>{info.receipts ? rupiah(info.received) : "—"}</dd>
          </div>
          <div>
            <dt>Cash pada {info.pending} rekap belum terisi</dt>
            <dd>{info.pending ? rupiah(info.pendingCash) : "—"}</dd>
          </div>
          <div>
            <dt>Kurang setoran</dt>
            <dd className={info.shortage ? "owner-negative" : ""}>
              {info.receipts ? rupiah(info.shortage) : "—"}
            </dd>
          </div>
          <div>
            <dt>Lebih setoran</dt>
            <dd className={info.excess ? "owner-positive" : ""}>
              {info.receipts ? rupiah(info.excess) : "—"}
            </dd>
          </div>
        </dl>
        <p>Kurang/lebih dihitung per rekap yang REAL-nya sudah terisi.</p>
      </section>
      <section className="panel owner-payment-mix" aria-label="Ringkasan penjualan">
        <div className="income-section-heading">
          <h2>Ringkasan penjualan</h2>
        </div>
        <dl>
          <div>
            <dt>Omzet tertinggi</dt>
            <dd>
              {info.top ? (
                <>
                  {info.top.name}
                  <small>{rupiah(info.top.gross)}</small>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Rata-rata per outlet melapor</dt>
            <dd>{info.average == null ? "—" : rupiah(info.average)}</dd>
          </div>
        </dl>
        <div className="owner-tenders">
          {tender.map((t) => (
            <div key={t.name}>
              <span>{t.name}</span>
              <strong>{totals.reported ? rupiah(t.value) : "—"}</strong>
              {validMix && (
                <>
                  <small>
                    {((t.value / totals.gross) * 100).toLocaleString("id-ID", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </small>
                  <progress value={t.value} max={totals.gross} aria-label={"Porsi " + t.name} />
                </>
              )}
            </div>
          ))}
        </div>
        <p>Tunai penjualan sebelum pengeluaran. Data mengikuti periode dan area.</p>
      </section>
    </>
  );
}

export function OwnerAttention({ rows }: { rows: OutletDashboardRow[] }) {
  const info = ownerInsights(rows);
  return (
    <section className="panel owner-attention" aria-label="Outlet perlu diperiksa">
      <div className="income-section-heading">
        <h2>Perlu diperiksa</h2>
        <span className="owner-count">{info.attention.length} outlet</span>
      </div>
      <ul>
        {info.attention.map((r) => (
          <li key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <span>{r.crew || r.areaName}</span>
            </div>
            <div className="owner-flags">
              {r.missingWorkDays > 0 && <span>{r.missingWorkDays} hari kerja belum ada rekap</span>}
              {!!r.records && r.schedule?.openDays === 0 && (
                <span>Ada rekap, jadwal kerja kosong</span>
              )}
              {r.records > r.receiptRecords && (
                <span>{r.records - r.receiptRecords} setoran belum terisi</span>
              )}
              {r.shortage > 0 && (
                <span className="owner-negative">Kurang {rupiah(r.shortage)}</span>
              )}
              {r.excess > 0 && <span className="owner-positive">Lebih {rupiah(r.excess)}</span>}
              {r.cash < 0 && <span className="owner-negative">Cash negatif</span>}
            </div>
          </li>
        ))}
      </ul>
      {!info.attention.length && (
        <p className="income-empty">
          {rows.length
            ? "Tidak ada rekap kerja atau setoran yang perlu diperiksa."
            : "Belum ada outlet pada filter ini."}
        </p>
      )}
    </section>
  );
}
