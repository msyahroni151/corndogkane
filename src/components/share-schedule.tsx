"use client";
import { useEffect, useRef, useState } from "react";
import { LocalInput } from "@/components/local-input";
import { FormDialog } from "@/components/form-dialog";
import type { ShareScheduleData } from "@/lib/share-schedule";
import { scheduleSvg, schedulePng } from "@/lib/share-schedule-image";
async function fetchSchedule(
  start: string,
  end: string,
  signal: AbortSignal,
): Promise<ShareScheduleData> {
  const response = await fetch(
    "/api/schedules/share?" + new URLSearchParams({ from: start, to: end }),
    { cache: "no-store", signal },
  );
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Jadwal belum dapat dimuat.");
  return data;
}
export function ShareSchedule({ from, to }: { from: string; to: string }) {
  return (
    <FormDialog title="Share Jadwal" trigger="Share Jadwal" extraWide>
      <SchedulePreview initialFrom={from} initialTo={to} />
    </FormDialog>
  );
}
function SchedulePreview({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }) {
  const [from, setFrom] = useState(initialFrom),
    [to, setTo] = useState(initialTo),
    [data, setData] = useState<ShareScheduleData | null>(null),
    [scope, setScope] = useState(""),
    [note, setNote] = useState("");
  const [busy, setBusy] = useState(true),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  async function load(start: string, end: string) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await fetchSchedule(start, end, request.signal);
      if (!request.signal.aborted) {
        setData(result);
        setScope((old) => (!old || result.areas.some((a) => a.id === old) ? old : ""));
        setError("");
      }
    } catch (e) {
      if (!request.signal.aborted) {
        setData(null);
        setError(e instanceof Error ? e.message : "Jadwal belum dapat dimuat.");
      }
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    fetchSchedule(initialFrom, initialTo, request.signal)
      .then((result) => {
        if (!request.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (!request.signal.aborted) {
          setData(null);
          setError(e instanceof Error ? e.message : "Jadwal belum dapat dimuat.");
        }
      })
      .finally(() => {
        if (!request.signal.aborted) setBusy(false);
      });
    return () => controller.current?.abort();
  }, [initialFrom, initialTo]);
  const image = data ? scheduleSvg(data, scope, note) : null;
  async function download() {
    if (!image || !data) return;
    setExporting(true);
    setError("");
    try {
      const blob = await schedulePng(image);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Jadwal-${data.from}-${data.to}${scope ? "-area" : "-semua-area"}.png`;
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
          setBusy(true);
          setError("");
          void load(from, to);
        }}
      >
        <label className="field">
          Tanggal awal
          <LocalInput
            type="date"
            name="from"
            required
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          Tanggal akhir
          <LocalInput
            type="date"
            name="to"
            required
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="field">
          Cakupan
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">SEMUA AREA</option>
            {data?.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button className="button-primary" disabled={busy}>
            {busy ? "Memuat jadwal…" : "Tampilkan jadwal"}
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Pilih periode maksimal 31 hari. Tabel disusun per 7 hari, dua area berdampingan. Unduh PNG
        untuk dibagikan.
      </p>
      <label className="field mt-4">
        Catatan (opsional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Catatan untuk seluruh area pada gambar…"
        />
      </label>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Jam WIB · [R] Reguler · [B] Backup · Kosong: TUTUP</p>
        <button
          type="button"
          className="button-primary"
          onClick={download}
          disabled={!image || busy || exporting || data?.from !== from || data?.to !== to}
        >
          {exporting ? "Menyiapkan gambar…" : "Unduh PNG"}
        </button>
      </div>
      <div
        className="share-schedule-preview overflow-x-auto rounded-lg border border-slate-200 bg-white"
        aria-label="Pratinjau share jadwal"
        aria-busy={busy}
      >
        {image ? (
          <div
            className={busy ? "opacity-50" : ""}
            dangerouslySetInnerHTML={{ __html: image.svg }}
          />
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            {busy ? "Menyiapkan pratinjau jadwal…" : "Belum ada pratinjau."}
          </p>
        )}
      </div>
    </div>
  );
}
