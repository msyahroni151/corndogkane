"use client";
import { useState } from "react";
import type { OperationalLoad } from "@/lib/outlet-operations";
import { notifySuccess } from "@/components/notification-toasts";
export function OutletDailyStatusForm({
  loaded,
  date,
  outletId,
  closed,
  disabled,
  onModeChange,
  onSaving,
  onSaved,
}: {
  loaded: OperationalLoad;
  date: string;
  outletId: string;
  closed: boolean;
  disabled: boolean;
  onModeChange: (mode: "BUKA" | "TUTUP") => void;
  onSaving: (pending: boolean) => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(loaded.dailyStatus?.notes || "");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    onSaving(true);
    setError("");
    try {
      const response = await fetch("/api/outlets/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "daily-status",
          outletId,
          date,
          operationalStatus: closed ? "TUTUP" : "BUKA",
          operationalNotes: notes,
          closureVersion: loaded.dailyStatus?.version || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Status belum tersimpan.");
      notifySuccess(
        closed ? "Status tutup harian tersimpan." : "Outlet dapat mencatat penjualan kembali.",
      );
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Status belum tersimpan.");
    } finally {
      setPending(false);
      onSaving(false);
    }
  }
  return (
    <form
      onSubmit={save}
      aria-busy={pending}
      className="mb-5 space-y-3 rounded-xl border border-slate-200 p-4"
    >
      <label className="field">
        Status operasional
        <select
          aria-label="Status operasional"
          value={closed ? "TUTUP" : "BUKA"}
          disabled={pending || disabled}
          onChange={(e) => onModeChange(e.target.value as "BUKA" | "TUTUP")}
        >
          <option value="BUKA">Buka</option>
          <option value="TUTUP" disabled={!!loaded.entry}>
            Tutup
          </option>
        </select>
      </label>
      {loaded.entry && (
        <p className="text-xs text-slate-500">
          Sudah ada rekap atau transaksi; status tidak dapat diganti menjadi Tutup.
        </p>
      )}
      {closed && (
        <>
          <label className="field">
            Keterangan tutup (opsional)
            <textarea
              aria-label="Keterangan tutup"
              maxLength={1000}
              value={notes}
              disabled={pending || disabled}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: tidak ada crew atau libur outlet"
            />
          </label>
          <p className="text-xs text-slate-500">
            Tutup hanya untuk tanggal ini. Tidak memerlukan crew dan tidak membuat penjualan, bonus,
            atau perubahan stok.
          </p>
        </>
      )}
      {(closed || loaded.dailyStatus?.closed) && (
        <button className="button-primary" type="submit" disabled={pending || disabled}>
          {pending ? "Menyimpan…" : closed ? "Simpan status tutup" : "Buka kembali outlet"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
