"use client";
import { useState } from "react";
import { FormDialog, useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
import { rupiah } from "@/lib/money";
import { csvImportLimit } from "@/lib/outlet-sales-csv";
const endpoint = "/api/outlets/operations/csv";
type Preview = {
  preview: {
    row: number;
    date: string;
    outlet: string;
    crew: string;
    operationalStatus: "BUKA" | "TUTUP";
    total: number;
    status: string;
  }[];
  errors: { row: number; message: string }[];
  newRows: number;
  skipped: number;
  total: number;
};
export function OutletSalesCsv({
  from,
  to,
  area,
  search,
  onSaved,
}: {
  from: string;
  to: string;
  area: string;
  search: string;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        endpoint + "?" + new URLSearchParams({ start: from, end: to, area, search }),
        { cache: "no-store" },
      );
      if (!response.ok) {
        const result = await response.json();
        throw Error(result.error || "Ekspor belum berhasil.");
      }
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `penjualan-outlet-${from}-${to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ekspor belum berhasil.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="button-secondary" type="button" disabled={busy} onClick={download}>
        {busy ? "Menyiapkan CSV…" : "Ekspor CSV"}
      </button>
      <FormDialog title="Impor penjualan CSV" trigger="Impor CSV" wide>
        <ImportSalesCsv onSaved={onSaved} />
      </FormDialog>
      {error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
function ImportSalesCsv({ onSaved }: { onSaved: () => void }) {
  const [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    close = useCloseFormDialog();
  async function send(action: "preview" | "import") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv, action, confirmed: action === "import" }),
        }),
        result = await response.json();
      if (!response.ok) throw Error(result.error || "CSV belum diproses.");
      if (action === "preview") setPreview(result);
      else {
        notifySuccess(
          `${result.imported} rekap berhasil diimpor, ${result.skipped} baris sudah tercatat dilewati.`,
        );
        onSaved();
        close?.();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "CSV belum diproses.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-slate-600">
        Satu baris per outlet per tanggal. Isi Nama_Outlet dan kode_name crew sesuai Referensi
        Outlet &amp; Crew. Untuk outlet TUTUP, kosongkan kode_name. Maksimal {csvImportLimit} baris
        per file.
      </p>
      <p className="text-xs leading-5 text-slate-500">
        Impor historis menerima crew aktif maupun nonaktif yang sudah terdaftar. Status karyawan
        tetap dipertahankan; crew nonaktif ditandai pada pratinjau dan referensi.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={endpoint + "?mode=template"} className="button-secondary" download>
          Unduh Template CSV
        </a>
        <a href={endpoint + "?mode=references"} className="button-secondary" download>
          Referensi Outlet & Crew
        </a>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Status operasional: BUKA atau TUTUP. Untuk TUTUP, kosongkan crew dan isi penjualan nol;
        keterangan_operasional untuk alasan tutup. File lama dengan crew TUTUP tetap diterima.
        Tanggal: YYYY-MM-DD atau DD/MM/YYYY. Nominal rupiah: 2500 atau 2.500. Isi harga lama bila
        berbeda; harga kosong memakai harga rekap standar. Total penjualan dihitung dari jumlah ×
        harga. Kolom total boleh dikosongkan atau diisi untuk dicocokkan.
      </p>
      <label className="field">
        File CSV *
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (event) => {
            setPreview(null);
            setError("");
            setCsv("");
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 2_000_000) {
              setError("File CSV maksimal 2 MB.");
              return;
            }
            try {
              setCsv(await file.text());
            } catch {
              setError("File belum dapat dibaca.");
            }
          }}
        />
      </label>
      <button
        className="button-secondary"
        type="button"
        disabled={!csv || busy}
        onClick={() => send("preview")}
      >
        {busy ? "Memproses…" : "Periksa CSV"}
      </button>
      {preview && (
        <>
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            {preview.newRows} baris baru · {preview.skipped} sudah tercatat ·{" "}
            {preview.errors.length} kesalahan
            <br />
            Total omzet baru: <strong>{rupiah(preview.total)}</strong>
          </div>
          {!!preview.errors.length && (
            <ul
              role="alert"
              className="max-h-40 overflow-auto rounded-xl bg-red-50 p-3 text-xs text-red-700"
            >
              {preview.errors.map((item, i) => (
                <li key={i}>
                  Baris {item.row}: {item.message}
                </li>
              ))}
            </ul>
          )}
          {!!preview.preview.length && (
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    {[
                      "Baris",
                      "Tanggal",
                      "Outlet",
                      "Crew",
                      "Operasional",
                      "Omzet",
                      "Hasil impor",
                    ].map((h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row) => (
                    <tr key={row.row}>
                      <td className="p-2">{row.row}</td>
                      <td className="whitespace-nowrap p-2">{row.date}</td>
                      <td className="p-2">{row.outlet}</td>
                      <td className="p-2">{row.crew}</td>
                      <td className="p-2">
                        {row.operationalStatus === "TUTUP" ? "Tutup" : "Buka"}
                      </td>
                      <td className="whitespace-nowrap p-2">{rupiah(row.total)}</td>
                      <td className="p-2">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        Rekap outlet dan tanggal yang sudah ada dilewati. Rekap baru mengikuti perhitungan bonus
        seperti input manual. Impor rekap historis tidak mengurangi stok. Jika satu baris baru gagal
        disimpan, seluruh baris baru dalam file dibatalkan.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          className="button-secondary"
          onClick={() => close?.()}
        >
          Batal
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={busy || !preview || !!preview.errors.length || !preview.newRows}
          onClick={() => send("import")}
        >
          {busy ? "Memproses…" : `Impor ${preview?.newRows || 0} Rekap`}
        </button>
      </div>
    </div>
  );
}
