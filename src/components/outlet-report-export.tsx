"use client";
import { useState } from "react";
import {
  financialExportFilename,
  type ReportExportInput,
} from "@/lib/financial-report-export-data";
import { UiIcon } from "@/components/ui-icon";
export function OutletReportExport(input: ReportExportInput) {
  const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const blob =
        format === "xlsx"
          ? await (await import("@/lib/financial-report-excel")).createFinancialExcel(input)
          : await (await import("@/lib/financial-report-pdf")).createFinancialPdf(input);
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = financialExportFilename(input, format);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError("Laporan belum berhasil diunduh. Silakan coba kembali.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="report-export-control">
      <div className="report-export-actions">
        <select
          aria-label="Format unduhan laporan"
          value={format}
          disabled={busy}
          onChange={(e) => setFormat(e.target.value as "xlsx" | "pdf")}
        >
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="pdf">PDF (.pdf)</option>
        </select>
        <button className="button-secondary" type="button" disabled={busy} onClick={download}>
          <UiIcon name="download" size={15} />
          {busy ? "Menyiapkan laporan…" : "Unduh laporan"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
