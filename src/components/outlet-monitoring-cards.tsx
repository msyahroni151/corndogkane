"use client";

import { SalesReconciliation } from "@/components/sales-reconciliation";
import { useEffect, useState } from "react";
import { outletScheduleLabel } from "@/lib/outlet-schedule-status";
import { rupiah } from "@/lib/money";
import type { MonitoringSales } from "@/lib/outlet-sales";
import { ShareOutletRecap } from "@/components/share-outlet-recap";
import { OutletRecapTable } from "@/components/outlet-recap-table";
import type { OutletRecapRow } from "@/lib/outlet-recap";
import { OutletOperationDialog } from "@/components/outlet-operation-dialog";
import { LocalInput } from "@/components/local-input";
import { APP_TIME_ZONE, dateToDisplay } from "@/lib/local-date";
import { UiIcon } from "@/components/ui-icon";
import { outletDays, type OutletHours } from "@/lib/outlet-settings";
import "./outlet-monitoring.css";

type OutletCard = {
  id: string;
  name: string;
  nameCode: string | null;
  areaId: string;
  areaName: string;
  hours: OutletHours | null;
};
const unknown = "Belum terhubung";
function initials(name: string) {
  return name.trim().slice(0, 2).toLocaleUpperCase("id-ID");
}
function todayInWib() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function OutletMonitoringCards({
  outlets,
  today,
}: {
  outlets: OutletCard[];
  today: string;
}) {
  const [period, setPeriod] = useState({ mode: "live", start: today, end: today });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [dateError, setDateError] = useState("");
  const [sales, setSales] = useState<MonitoringSales | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [recap, setRecap] = useState<{
    start: string;
    end: string;
    rows: OutletRecapRow[];
    error: string;
  } | null>(null);
  const currentRecap = recap?.start === period.start && recap?.end === period.end ? recap : null;
  useEffect(() => {
    if (view !== "table") return;
    const controller = new AbortController();
    async function read() {
      try {
        const query = new URLSearchParams({ start: period.start, end: period.end });
        const response = await fetch("/api/outlets/operations/recap?" + query, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Rekap belum dapat dibaca.");
        if (!controller.signal.aborted)
          setRecap({ start: period.start, end: period.end, rows: result.rows, error: "" });
      } catch (reason) {
        if (!controller.signal.aborted)
          setRecap({
            start: period.start,
            end: period.end,
            rows: [],
            error: reason instanceof Error ? reason.message : "Rekap belum dapat dibaca.",
          });
      }
    }
    void read();
    const timer =
      period.mode === "live"
        ? setInterval(() => {
            void read();
          }, 60000)
        : undefined;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [view, period.start, period.end, period.mode, refresh]);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setRefresh((n) => n + 1);
    };
    const stored = (e: StorageEvent) => {
      if (e.key === "ck:sales-updated") update();
    };
    window.addEventListener("focus", update);
    window.addEventListener("storage", stored);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("storage", stored);
    };
  }, []);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletCard | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;
    async function read() {
      if (period.mode === "live" && todayInWib() !== period.start) {
        const current = todayInWib();
        setPeriod({ mode: "live", start: current, end: current });
        return;
      }
      try {
        const response = await fetch(`/api/outlets/sales?start=${period.start}&end=${period.end}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw Error();
        const result: MonitoringSales = await response.json();
        if (!controller.signal.aborted) {
          setSales(result);
        }
      } catch {
        if (!controller.signal.aborted)
          setSales({ status: "error", start: period.start, end: period.end, outlets: {} });
      }
    }
    void read();
    if (period.mode === "live")
      timer = setInterval(() => {
        void read();
      }, 30000);
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [period.start, period.end, period.mode, refresh]);
  const periodLabel = `${dateToDisplay(period.start)}–${dateToDisplay(period.end)} WIB`;
  function selectLive() {
    const current = todayInWib();
    setPeriod({ mode: "live", start: current, end: current });
    setStartDate(current);
    setEndDate(current);
    setDateError("");
    setPage(1);
    setRefresh((value) => value + 1);
  }
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [page, setPage] = useState(1);
  const areas = [
    ...new Map(
      [...outlets, ...(recap?.rows || [])].map((outlet) => [
        outlet.areaId,
        { id: outlet.areaId, name: outlet.areaName },
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "id-ID", { numeric: true }));
  const term = search.trim().toLocaleLowerCase("id-ID");
  const visible = outlets.filter(
    (outlet) =>
      (!area || outlet.areaId === area) &&
      [outlet.name, outlet.areaName].some((value) =>
        value.toLocaleLowerCase("id-ID").includes(term),
      ),
  );
  const visibleRecap = (currentRecap?.rows || []).filter(
    (row) =>
      (!area || row.areaId === area) &&
      [row.outletName, row.outletCode || "", row.areaName].some((value) =>
        value.toLocaleLowerCase("id-ID").includes(term),
      ),
  );
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * pageSize;
  const pageOutlets = visible.slice(offset, offset + pageSize);
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (number) => number === 1 || number === pageCount || Math.abs(number - currentPage) <= 1,
  );
  const currentSales = sales?.start === period.start && sales?.end === period.end ? sales : null;
  const values = currentSales?.outlets || {};
  const hasManual = visible.some((outlet) => values[outlet.id]?.source === "manual");
  const reportingCount = visible.filter((outlet) => values[outlet.id]).length;
  const hasReports = reportingCount > 0;
  const total = visible.reduce(
    (sum, outlet) => {
      const value = values[outlet.id];
      return {
        total: sum.total + (value?.total || 0),
        qris: sum.qris + (value?.qris || 0),
        expense: sum.expense + (value?.expense || 0),
        online: sum.online + (value?.online || 0),
      };
    },
    { total: 0, qris: 0, online: 0, expense: 0 },
  );
  const sourceHint =
    hasReports && reportingCount < visible.length
      ? `Data ${reportingCount} dari ${visible.length} outlet`
      : hasManual
        ? "Rekap manual sesuai periode"
        : currentSales?.status === "error"
          ? "Tidak dapat membaca POS"
          : currentSales?.status === "connected"
            ? "Sesuai periode yang dipilih"
            : unknown;
  return (
    <div className="outlet-monitoring">
      <SalesReconciliation
        rows={(currentSales?.reconciliations || []).filter((r) =>
          outlets.some((o) => o.id === r.outletId && (!area || o.areaId === area)),
        )}
        onSaved={() => {
          setRefresh((n) => n + 1);
          setRecap(null);
        }}
      />
      {selectedOutlet && (
        <OutletOperationDialog
          outlet={selectedOutlet}
          date={period.mode === "live" ? todayInWib() : period.start}
          onClose={() => setSelectedOutlet(null)}
          onSaved={() => {
            setSelectedOutlet(null);
            setRecap(null);
            setRefresh((value) => value + 1);
          }}
        />
      )}
      <section className="monitor-filters" aria-label="Filter outlet">
        <form
          className="monitor-date-filters"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !startDate ||
              !endDate ||
              startDate > endDate ||
              (Date.parse(endDate) - Date.parse(startDate)) / 86400000 > 365
            ) {
              setDateError(
                "Pilih tanggal selesai sama atau setelah tanggal mulai, maksimal 366 hari.",
              );
              return;
            }
            setPeriod({ mode: "range", start: startDate, end: endDate });
            setRefresh((value) => value + 1);
            setDateError("");
            setPage(1);
          }}
        >
          <button
            type="button"
            className="monitor-live"
            aria-pressed={period.mode === "live"}
            onClick={selectLive}
          >
            <span /> Live
          </button>
          <label className="monitor-date-field">
            <span>Tanggal mulai</span>
            <LocalInput
              type="date"
              aria-label="Tanggal mulai"
              value={startDate}
              required
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="monitor-date-field">
            <span>Tanggal selesai</span>
            <LocalInput
              type="date"
              aria-label="Tanggal selesai"
              value={endDate}
              required
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <button type="submit" className="button-secondary">
            Terapkan
          </button>
          <button
            type="button"
            className="button-secondary monitor-view-toggle"
            aria-pressed={view === "table"}
            onClick={() => setView((value) => (value === "cards" ? "table" : "cards"))}
          >
            <UiIcon name={view === "table" ? "dashboard" : "receipt"} size={16} />{" "}
            {view === "table" ? "Tampilan Kartu" : "Tampilan Tabel"}
          </button>
        </form>
        <label className="monitor-search">
          <UiIcon name="search" size={18} />
          <input
            aria-label="Cari outlet atau area"
            placeholder="Cari outlet atau area..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="monitor-filter-actions">
          <select
            aria-label="Filter area"
            value={area}
            onChange={(event) => {
              setArea(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua Area</option>
            {areas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <ShareOutletRecap from={period.start} to={period.end} area={area} outlets={outlets} />
        </div>
      </section>
      {dateError && (
        <p className="monitor-date-error" role="alert">
          {dateError}
        </p>
      )}
      <p className="monitor-period" role="status">
        {period.mode === "live" ? "Live · Hari ini" : "Periode dipilih"} · {periodLabel}
      </p>
      <div className="monitor-summary">
        {[
          [
            period.mode === "live" ? "OMZET HARI INI" : "OMZET PERIODE",
            hasReports ? rupiah(total.total) : "—",
            sourceHint,
          ],
          ["QRIS", hasReports ? rupiah(total.qris) : "—", sourceHint],
          ["ONLINE FOOD", hasReports ? rupiah(total.online) : "—", sourceHint],
          ["PENGELUARAN", hasReports ? rupiah(total.expense) : "—", sourceHint],
          ["OUTLET AKTIF", String(visible.length), "Sesuai filter yang dipilih"],
        ].map(([label, value, hint]) => (
          <section className="monitor-stat" key={label}>
            <h2>{label}</h2>
            <strong>{value}</strong>
            <p>{hint}</p>
          </section>
        ))}
      </div>
      <p className="monitor-data-note">
        {hasManual
          ? "Omzet rekap manual mengikuti tanggal operasional yang tersimpan."
          : currentSales?.status === "connected"
            ? `Sumber omzet: POS Apps Script · ${Object.keys(values).length} outlet cocok dengan Master Outlet. ${period.mode === "live" ? "Data diperbarui di belakang layar setiap 60 detik." : "Hanya transaksi selesai dalam rentang tanggal WIB yang dihitung."}`
            : currentSales?.status === "error"
              ? "Sumber omzet POS belum dapat dibaca. Coba Terapkan atau Live kembali."
              : "Sambungan omzet POS Apps Script belum aktif. Angka omzet ditampilkan — sampai penghubung dipublikasikan."}{" "}
        Transaksi lokal mengikuti POS dan rekap manual yang sudah dikonfirmasi.
      </p>
      {view === "table" ? (
        <OutletRecapTable
          key={period.start + "|" + period.end + "|" + area + "|" + term}
          rows={visibleRecap}
          loading={!currentRecap}
          error={currentRecap?.error || ""}
        />
      ) : (
        <>
          <div className="monitor-grid" aria-label="Daftar outlet aktif">
            {pageOutlets.map((outlet) => (
              <article className="monitor-card" key={outlet.id} aria-label={outlet.name}>
                <button
                  type="button"
                  className="monitor-card-open"
                  aria-label={`Isi operasional ${outlet.name}`}
                  onClick={() => setSelectedOutlet(outlet)}
                />
                <div className="monitor-card-heading">
                  <span
                    className={`monitor-avatar ${(outlet.nameCode?.trim().length || 0) > 4 ? "monitor-avatar-code-long" : ""}`}
                  >
                    {outlet.nameCode?.trim() || initials(outlet.name)}
                  </span>
                  <div className="monitor-outlet-name">
                    <h2>{outlet.name}</h2>
                    <p>{outlet.areaName}</p>
                  </div>
                  <span
                    className="monitor-status"
                    data-state={
                      currentSales?.schedules?.[outlet.id]?.openDays === 0
                        ? "closed"
                        : currentSales?.schedules?.[outlet.id]
                          ? "open"
                          : "loading"
                    }
                    title="Status mengikuti jadwal Kerja pada tanggal yang dipilih."
                  >
                    <i /> {outletScheduleLabel(currentSales?.schedules?.[outlet.id])}
                  </span>
                </div>
                <div className="monitor-turnover">
                  <span>{period.mode === "live" ? "Omzet hari ini" : "Omzet periode"}</span>
                  <strong>{values[outlet.id] ? rupiah(values[outlet.id].total) : "—"}</strong>
                  <p>
                    {values[outlet.id]
                      ? values[outlet.id].source === "manual"
                        ? `Rekap manual · ${values[outlet.id].days} tanggal`
                        : `${values[outlet.id].count} transaksi POS selesai`
                      : `${unknown} · transaksi POS`}
                  </p>
                </div>
                <div className="monitor-payments">
                  {[
                    ["CASH", "cash"],
                    ["QRIS", "qris"],
                    ["ONLINE FOOD", "online"],
                  ].map(([label, field]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>
                        {values[outlet.id] &&
                        !(field === "cash" && values[outlet.id].cashKnown === false)
                          ? rupiah(values[outlet.id][field as "cash" | "qris" | "online"])
                          : "—"}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="monitor-card-meta">
                  <span>
                    <UiIcon name="people" size={15} />{" "}
                    {values[outlet.id]?.crewNames?.join(", ") || "Crew belum diisi"}
                  </span>
                  <span>
                    <UiIcon name="box" size={15} />{" "}
                    {values[outlet.id]?.stockPending
                      ? `${values[outlet.id]?.stockPending} menu perlu pemeriksaan stok`
                      : "Stok mengikuti transaksi beresep"}
                  </span>
                </div>
                <details className="monitor-hours">
                  <summary>
                    <span className={!outlet.hours ? "monitor-needs-hours" : ""}>
                      {outlet.hours ? "Jam operasional outlet" : "Jam operasional belum diatur"}
                    </span>
                    <UiIcon name="chevron" size={15} />
                  </summary>
                  {outlet.hours ? (
                    <dl>
                      {outletDays.map((day, index) => (
                        <div key={day}>
                          <dt>{day}</dt>
                          <dd>
                            {outlet.hours![index].closed
                              ? "Libur"
                              : `${outlet.hours![index].open}–${outlet.hours![index].close}`}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>Lengkapi jam operasional melalui Master Outlet.</p>
                  )}
                </details>
              </article>
            ))}
          </div>
          {visible.length > 0 && (
            <div className="monitor-pagination">
              <p>
                {offset + 1}–{Math.min(offset + pageSize, visible.length)} dari {visible.length}{" "}
                outlet
              </p>
              <nav aria-label="Halaman outlet">
                <button
                  type="button"
                  aria-label="Halaman sebelumnya"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ‹
                </button>
                {pageNumbers.map((number, index) => (
                  <span className="monitor-page-item" key={number}>
                    {index > 0 && number - pageNumbers[index - 1] > 1 && (
                      <span className="monitor-page-gap" aria-hidden="true">
                        …
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Halaman ${number}`}
                      aria-current={number === currentPage ? "page" : undefined}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  aria-label="Halaman berikutnya"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  ›
                </button>
              </nav>
            </div>
          )}
          {!visible.length && (
            <div className="monitor-empty">
              <UiIcon name="building" size={32} />
              <h2>
                {outlets.length ? "Tidak ada outlet sesuai filter" : "Belum ada outlet aktif"}
              </h2>
              <p>
                {outlets.length
                  ? "Coba kata kunci atau area lain."
                  : "Outlet akan tampil otomatis setelah terdaftar dan berstatus aktif di Master Outlet."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
