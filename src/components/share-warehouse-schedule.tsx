"use client";
import { useEffect, useRef, useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { LocalInput } from "@/components/local-input";
import { warehouseScheduleSvg, type WarehouseScheduleData } from "@/lib/warehouse-schedule-image";
import { schedulePng } from "@/lib/share-schedule-image";
export function ShareWarehouseSchedule({ from, to }: { from: string; to: string }) {
  return (
    <FormDialog title="Share Jadwal Gudang" trigger="Share Jadwal Gudang" extraWide>
      <Preview initialFrom={from} initialTo={to} />
    </FormDialog>
  );
}
function Preview({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }) {
  const [from, setFrom] = useState(initialFrom),
    [to, setTo] = useState(initialTo),
    [data, setData] = useState<WarehouseScheduleData | null>(null),
    [busy, setBusy] = useState(true),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  async function load(start: string, end: string) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/schedules/share-warehouse?" + new URLSearchParams({ from: start, to: end }),
        { cache: "no-store", signal: controller.signal },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Jadwal belum dapat dimuat.");
      if (!controller.signal.aborted) setData(result);
    } catch (e) {
      if (!controller.signal.aborted) {
        setData(null);
        setError(e instanceof Error ? e.message : "Jadwal belum dapat dimuat.");
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    void load(initialFrom, initialTo);
    return () => active.current?.abort();
  }, [initialFrom, initialTo]);
  const image = data?.employees.length ? warehouseScheduleSvg(data) : null;
  async function download() {
    if (!image || !data) return;
    setExporting(true);
    setError("");
    try {
      const blob = await schedulePng(image),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `Jadwal-Gudang-${data.from}-${data.to}.png`;
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
        className="grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load(from, to);
        }}
      >
        <label className="field">
          Tanggal awal
          <LocalInput
            type="date"
            name="from"
            value={from}
            max={to || undefined}
            required
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          Tanggal akhir
          <LocalInput
            type="date"
            name="to"
            value={to}
            min={from || undefined}
            required
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button className="button-primary" disabled={busy}>
            {busy ? "Memuat jadwal…" : "Tampilkan jadwal"}
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Pilih periode maksimal 31 hari. Hijau: Shift 1 · Biru: Shift 2 · Jingga: Full Shift · Merah:
        Libur. Tanggal yang belum dijadwalkan ditampilkan —.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="my-4 flex justify-end">
        <button
          type="button"
          className="button-primary"
          disabled={!image || busy || exporting || data?.from !== from || data?.to !== to}
          onClick={download}
        >
          {exporting ? "Menyiapkan gambar…" : "Unduh PNG"}
        </button>
      </div>
      <div
        aria-label="Pratinjau jadwal gudang"
        aria-busy={busy}
        className="overflow-x-auto rounded-lg border border-slate-200 bg-white"
      >
        {image ? (
          <div
            className={
              busy
                ? "opacity-50 [&_svg]:h-auto [&_svg]:max-w-full"
                : "[&_svg]:h-auto [&_svg]:max-w-full"
            }
            dangerouslySetInnerHTML={{ __html: image.svg }}
          />
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            {busy
              ? "Menyiapkan pratinjau jadwal…"
              : "Belum ada karyawan atau jadwal gudang pada periode ini."}
          </p>
        )}
      </div>
    </div>
  );
}
