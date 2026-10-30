"use client";
import { useState } from "react";
import type { ReconciliationRow } from "@/lib/outlet-sales";
import { rupiah } from "@/lib/money";
export function SalesReconciliation({
  rows,
  onSaved,
}: {
  rows: ReconciliationRow[];
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(""),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const review = rows.filter((r) => r.pending),
    stock = rows.reduce((n, r) => n + r.stockPending, 0);
  async function confirm(row: ReconciliationRow, choice: "POS" | "MANUAL") {
    if (pending) return;
    setPending(row.id);
    setError("");
    try {
      const response = await fetch("/api/pos/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            version: row.version,
            choice,
            notes: notes[row.id] || "",
          }),
        }),
        body = await response.json();
      if (!response.ok) throw Error(body.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konfirmasi belum tersimpan.");
    } finally {
      setPending("");
    }
  }
  if (!review.length && !stock) return null;
  return (
    <section className="panel mb-4 border border-amber-200 p-4" aria-label="Rekonsiliasi penjualan">
      <h2 className="text-sm font-bold">Pemeriksaan sumber penjualan</h2>
      {stock > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          {stock} baris menu belum mengurangi bahan karena resep belum tersedia atau input
          bertanggal lampau. Periksa riwayat POS dan rekonsiliasi stok; jangan mengurangi bahan dua
          kali.
        </p>
      )}
      {review.map((row) => (
        <div key={row.id} className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <strong className="text-sm">
            {row.outletName} · {row.date}
          </strong>
          <p className="text-xs text-slate-500">
            Ada rekap total harian dan transaksi, atau perubahan setelah konfirmasi. Angka laporan
            saat ini tetap {rupiah(row.current)} sampai sumber final diperiksa.
          </p>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <p>
              POS: <strong>{rupiah(row.pos)}</strong>
            </p>
            <p>
              Tambahan manual: <strong>{rupiah(row.additional)}</strong>
            </p>
            <p>
              Total harian manual:{" "}
              <strong>{row.manual === null ? "Belum ada" : rupiah(row.manual)}</strong>
            </p>
          </div>
          {row.manual !== null && (
            <p className="text-xs">
              Selisih transaksi vs rekap total: {rupiah(row.pos + row.additional - row.manual)}
            </p>
          )}
          <label className="field text-xs">
            Alasan konfirmasi
            <input
              value={notes[row.id] || ""}
              maxLength={1000}
              onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
              placeholder="Hasil pemeriksaan transaksi dan rekap"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="button-primary"
              disabled={!!pending || (notes[row.id] || "").trim().length < 3}
              onClick={() => confirm(row, "POS")}
            >
              Gunakan POS + tambahan manual
            </button>
            {row.manual !== null && (
              <button
                className="button-secondary"
                disabled={!!pending || (notes[row.id] || "").trim().length < 3}
                onClick={() => confirm(row, "MANUAL")}
              >
                Gunakan rekap total manual
              </button>
            )}
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
