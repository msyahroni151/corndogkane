"use client";
import { useState } from "react";
import { rupiah } from "@/lib/money";
import { PrintableReceipt } from "@/components/receipt-paper";
import {
  resolveReceiptSettings,
  type ReceiptTemplateRecord,
  type ReceiptData,
} from "@/lib/receipt-templates";
export function PosSalesHistory({
  rows,
  templates,
}: {
  rows: {
    id: string;
    date: string;
    outlet: string;
    crew: string;
    source: string;
    method: string;
    total: number;
    pending: number;
  }[];
  templates: ReceiptTemplateRecord[];
}) {
  const [receipt, setReceipt] = useState<(ReceiptData & { outletId: string }) | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [printKey, setPrintKey] = useState("");
  async function reprint(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/pos/sales?id=" + encodeURIComponent(id), {
          cache: "no-store",
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setReceipt(data.receipt);
      setPrintKey(id + ":" + Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Struk belum dapat dibaca.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel mt-5 p-4" aria-label="Riwayat transaksi tersimpan">
      <h2 className="text-sm font-bold">50 transaksi tersimpan terbaru</h2>
      <p className="mt-1 text-xs text-slate-500">
        Sumber POS dan tambahan manual. Cetak ulang memakai harga dan nama menu saat transaksi
        disimpan.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Waktu / Nomor",
                "Outlet / Petugas",
                "Sumber",
                "Pembayaran",
                "Total",
                "Stok",
                "Struk",
              ].map((h) => (
                <th className="p-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="p-3">
                  {new Date(row.date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                  <small className="mt-1 block">{row.id}</small>
                </td>
                <td className="p-3">
                  {row.outlet}
                  <small className="mt-1 block">{row.crew}</small>
                </td>
                <td className="p-3">{row.source === "POS" ? "POS" : "Tambahan manual"}</td>
                <td className="p-3">{row.method}</td>
                <td className="p-3">{rupiah(row.total)}</td>
                <td className="p-3">
                  {row.pending ? row.pending + " menu belum diproses" : "Bahan sudah dikurangi"}
                </td>
                <td className="p-3">
                  <button
                    className="button-secondary"
                    disabled={!!busy}
                    onClick={() => reprint(row.id)}
                  >
                    Cetak ulang
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-xs text-slate-400">Belum ada transaksi tersimpan.</p>
        )}
      </div>
      {receipt && (
        <PrintableReceipt
          data={receipt}
          settings={resolveReceiptSettings(templates, receipt.outletId, "CUSTOMER")}
          printKey={printKey}
        />
      )}
    </section>
  );
}
