"use client";
import { useEffect, useRef, useState } from "react";
import { LocalInput } from "@/components/local-input";
import { FormDialog } from "@/components/form-dialog";
import type { ShareScheduleData } from "@/lib/share-schedule";
import { scheduleSvg, schedulePng, schedulePdf } from "@/lib/share-schedule-image";
export function ShareSchedule({ from, to, area }: { from: string; to: string; area?: string }) {
  return (
    <FormDialog title="Share Jadwal" trigger="Share Jadwal" extraWide>
      <SchedulePreview initialFrom={from} initialTo={to} initialScope={area || ""} />
    </FormDialog>
  );
}
function SchedulePreview({
  initialFrom,
  initialTo,
  initialScope,
}: {
  initialFrom: string;
  initialTo: string;
  initialScope: string;
}) {
  const [from, setFrom] = useState(initialFrom),
    [to, setTo] = useState(initialTo),
    [scope, setScope] = useState(initialScope),
    [format, setFormat] = useState("png");
  const [data, setData] = useState<ShareScheduleData | null>(null),
    [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  const controller = useRef<AbortController | null>(null);
  async function load(start: string, end: string) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
          "/api/schedules/share?" + new URLSearchParams({ from: start, to: end }),
          { cache: "no-store", signal: request.signal },
        ),
        result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (request.signal.aborted) return;
      setData(result);
      setNotes(
        Object.fromEntries(
          (result.areaNotes || []).map((n: { areaId: string; note: string }) => [n.areaId, n.note]),
        ),
      );
      setScope((old) =>
        !old || result.areas.some((a: { id: string }) => a.id === old) ? old : "",
      );
    } catch (e) {
      if (!request.signal.aborted)
        setError(e instanceof Error ? e.message : "Jadwal belum dimuat.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    void load(initialFrom, initialTo);
    return () => controller.current?.abort();
  }, [initialFrom, initialTo]);
  const image = data ? scheduleSvg(data, scope, notes) : null,
    ready = !!data && data.from === from && data.to === to && !busy && !saving && !exporting;
  const changed =
    data?.areas.filter(
      (a) => (notes[a.id] || "") !== (data.areaNotes?.find((n) => n.areaId === a.id)?.note || ""),
    ) || [];
  async function saveNotes() {
    if (!data || !changed.length) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/schedules/share", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: data.from,
            to: data.to,
            notes: changed.map((a) => ({
              areaId: a.id,
              note: notes[a.id] || "",
              version: data.areaNotes?.find((n) => n.areaId === a.id)?.version || null,
            })),
          }),
        }),
        result = await response.json();
      if (!response.ok) throw Error(result.error);
      setData((old) =>
        old
          ? {
              ...old,
              areaNotes: [
                ...(old.areaNotes || []).filter(
                  (n) => !result.notes.some((r: { areaId: string }) => r.areaId === n.areaId),
                ),
                ...result.notes,
              ],
            }
          : old,
      );
      setNotes((old) => ({
        ...old,
        ...Object.fromEntries(
          result.notes.map((n: { areaId: string; note: string }) => [n.areaId, n.note]),
        ),
      }));
      setInfo("Catatan per area berhasil disimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Catatan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  }
  function downloadFile(file: File) {
    const url = URL.createObjectURL(file),
      link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportFile(share = false) {
    if (!image || !data || !ready) return;
    setExporting(true);
    setError("");
    setInfo("");
    try {
      const blob = format === "pdf" ? await schedulePdf(image) : await schedulePng(image),
        file = new File(
          [blob],
          `Jadwal-${data.from}-${data.to}${scope ? "-" + (data.areas.find((a) => a.id === scope)?.name || "area").replace(/[^a-z0-9-]/gi, "-") : "-semua-area"}.${format}`,
          { type: format === "pdf" ? "application/pdf" : "image/png" },
        );
      if (share) {
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          try {
            await navigator.share({
              files: [file],
              title: "Jadwal Corndog Kane",
              text: `Jadwal ${data.from} sampai ${data.to}`,
            });
            return;
          } catch (e) {
            if (e instanceof Error && e.name === "AbortError") return;
          }
        }
        downloadFile(file);
        window.open(
          "https://wa.me/?text=" +
            encodeURIComponent(
              `Jadwal Corndog Kane ${data.from} sampai ${data.to}. Lampirkan file jadwal yang telah diunduh.`,
            ),
          "_blank",
          "noopener,noreferrer",
        );
        setInfo("File sudah diunduh. Lampirkan file tersebut di WhatsApp.");
      } else downloadFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "File belum dapat dibuat.");
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
          if (changed.length) {
            setError("Simpan catatan yang berubah sebelum mengganti periode.");
            return;
          }
          void load(from, to);
        }}
      >
        <label className="field">
          Tanggal awal
          <LocalInput
            type="date"
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
              <option value={a.id} key={a.id}>
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
      <p className="mt-3 text-xs text-slate-500">
        Periode maksimal 31 hari. Catatan disimpan untuk masing-masing area dan periode jadwal.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {data?.areas
          .filter((a) => !scope || a.id === scope)
          .map((a) => (
            <label key={a.id} className="field">
              Catatan {a.name}
              <textarea
                aria-label={`Catatan ${a.name}`}
                rows={2}
                maxLength={500}
                value={notes[a.id] || ""}
                onChange={(e) => setNotes((old) => ({ ...old, [a.id]: e.target.value }))}
                placeholder={`Catatan khusus ${a.name}…`}
              />
            </label>
          ))}
      </div>
      {!!data?.areas.length && (
        <div className="mt-3 flex items-center gap-3">
          <button
            className="button-secondary"
            onClick={() => void saveNotes()}
            disabled={!changed.length || busy || saving || data.from !== from || data.to !== to}
          >
            {saving ? "Menyimpan…" : "Simpan catatan"}
          </button>
          {!!changed.length && (
            <span className="text-xs text-amber-700">Ada catatan belum disimpan.</span>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="mt-3 text-xs text-emerald-700">
          {info}
        </p>
      )}
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">WIB · [R] Reguler · [B] Backup · Kosong: TUTUP</p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Format jadwal"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="png">Image (PNG)</option>
            <option value="pdf">PDF</option>
          </select>
          <button className="button-secondary" onClick={() => void exportFile()} disabled={!ready}>
            {exporting ? "Menyiapkan…" : format === "pdf" ? "Unduh PDF" : "Unduh PNG"}
          </button>
          <button
            className="button-primary"
            onClick={() => void exportFile(true)}
            disabled={!ready}
          >
            Share WhatsApp
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Pilih WhatsApp pada menu berbagi perangkat. Jika berbagi file tidak tersedia, unduhannya
        dapat dilampirkan di WhatsApp.
      </p>
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
