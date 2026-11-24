"use client";

import { useState } from "react";

export function ScheduleAreaNote({ areaId, areaName, from, to, initialNote = "", initialVersion = null }: {
  areaId: string;
  areaName: string;
  from: string;
  to: string;
  initialNote?: string;
  initialVersion?: string | null;
}) {
  const [note, setNote] = useState(initialNote);
  const [saved, setSaved] = useState({ note: initialNote, version: initialVersion });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || note === saved.note) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch("/api/schedules/share", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, notes: [{ areaId, note, version: saved.version }] }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Catatan belum tersimpan.");
      const updated = result.notes?.find((entry: { areaId: string }) => entry.areaId === areaId);
      if (!updated) throw Error("Catatan belum tersimpan. Muat ulang dan coba kembali.");
      setNote(updated.note);
      setSaved({ note: updated.note, version: updated.version });
      setInfo("Tersimpan · ikut di Share Jadwal.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Catatan belum tersimpan. Coba kembali.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} aria-busy={busy} className="min-w-0 space-y-2">
      <textarea
        aria-label={`Catatan ${areaName}`}
        placeholder={`Catatan khusus ${areaName}…`}
        className="block min-h-16 w-full min-w-0 max-w-full resize-y whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] leading-5 [overflow-wrap:anywhere] focus:border-emerald-500 focus:outline-none"
        rows={2}
        maxLength={500}
        value={note}
        disabled={busy}
        onChange={(event) => { setNote(event.target.value); setError(""); setInfo(""); }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400">{note.length}/500</span>
        <button type="submit" aria-label={`Simpan catatan ${areaName}`} className="button-secondary !px-3 !py-1.5 !text-[10px]" disabled={busy || note === saved.note}>
          {busy ? "Menyimpan…" : "Simpan catatan"}
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] leading-4 text-red-700 [overflow-wrap:anywhere]">{error}</p>}
      {info && <p role="status" className="text-[11px] leading-4 text-emerald-700">{info}</p>}
    </form>
  );
}
