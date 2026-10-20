"use client";
import { useEffect, useRef, useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { LocalInput } from "@/components/local-input";
import type { OutletRecapRow } from "@/lib/outlet-recap";
import { outletRecapSvg, type RecapOutlet } from "@/lib/outlet-recap-image";
import { schedulePng } from "@/lib/share-schedule-image";
export function ShareOutletRecap(props: {
  from: string;
  to: string;
  area: string;
  outlets: RecapOutlet[];
}) {
  return (
    <FormDialog title="Unduh Rekap Penjualan Outlet" trigger="Unduh Rekap" extraWide>
      <RecapPreview {...props} />
    </FormDialog>
  );
}
function RecapPreview({
  from,
  to,
  area: initialArea,
  outlets,
}: {
  from: string;
  to: string;
  area: string;
  outlets: RecapOutlet[];
}) {
  const [start, setStart] = useState(from),
    [end, setEnd] = useState(to),
    [area, setArea] = useState(initialArea);
  const [data, setData] = useState<{ start: string; end: string; rows: OutletRecapRow[] } | null>(
    null,
  );
  const [busy, setBusy] = useState(true),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  async function load(a: string, b: string) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b < a)
        throw Error("Pilih periode tanggal yang valid.");
      const response = await fetch(
        "/api/outlets/operations/recap?" + new URLSearchParams({ start: a, end: b }),
        { cache: "no-store", signal: request.signal },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Rekap belum dapat dimuat.");
      if (!request.signal.aborted) setData({ start: a, end: b, rows: result.rows });
    } catch (e) {
      if (!request.signal.aborted) {
        setData(null);
        setError(e instanceof Error ? e.message : "Rekap belum dapat dimuat.");
      }
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    void load(from, to);
    return () => controller.current?.abort();
  }, [from, to]);
  const areas = [
    ...new Map([...outlets, ...(data?.rows || [])].map((o) => [o.areaId, o.areaName])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "id-ID"));
  const rows = (data?.rows || []).filter((r) => !area || r.areaId === area);
  const scope = areas.find(([id]) => id === area)?.[1] || "SEMUA AREA";
  const image = data
    ? outletRecapSvg(
        rows,
        outlets.filter((o) => !area || o.areaId === area),
        data.start,
        data.end,
        scope,
      )
    : null;
  const stale = busy || data?.start !== start || data?.end !== end;
  async function download() {
    if (!image || stale) return;
    setExporting(true);
    setError("");
    try {
      const blob = await schedulePng(image),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `Rekap-Outlet-${start}-${end}${area ? "-area" : "-semua-area"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gambar belum dapat diunduh.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="p-5 sm:p-6">
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void load(start, end);
        }}
      >
        <label className="field">
          Tanggal awal
          <LocalInput
            type="date"
            name="recapFrom"
            required
            value={start}
            max={end || undefined}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          Tanggal akhir
          <LocalInput
            type="date"
            name="recapTo"
            required
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="field">
          Cakupan area
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">SEMUA AREA</option>
            {areas.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button className="button-primary" disabled={busy}>
            {busy ? "Memuat rekap…" : "Tampilkan rekap"}
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Pilih periode maksimal 366 hari. Angka dijumlahkan per cabang untuk seluruh periode, tanpa
        mengikuti batas halaman kartu/tabel. Nama crew menggunakan kode nama.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {rows.length} rekap operasional tersimpan
          {stale ? " · Terapkan periode untuk memperbarui pratinjau" : ""}
        </p>
        <button
          type="button"
          className="button-primary"
          disabled={!image || !rows.length || stale || exporting}
          onClick={download}
        >
          {exporting ? "Menyiapkan gambar…" : "Unduh PNG"}
        </button>
      </div>
      <div
        className="overflow-x-auto rounded-lg border border-slate-200 bg-white"
        aria-label="Pratinjau rekap penjualan"
        aria-busy={busy}
      >
        {image ? (
          <div
            className={stale ? "opacity-50" : ""}
            dangerouslySetInnerHTML={{ __html: image.svg }}
          />
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            {busy ? "Menyiapkan pratinjau…" : "Belum ada pratinjau."}
          </p>
        )}
      </div>
    </div>
  );
}
