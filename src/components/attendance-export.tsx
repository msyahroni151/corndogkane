"use client";
import { UiIcon } from "@/components/ui-icon";
export function AttendanceExport({
  headers,
  rows,
  filename,
}: {
  headers: string[];
  rows: string[][];
  filename: string;
}) {
  function download() {
    const cell = (value: string) =>
      '"' + (/^[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
    const content =
      "\uFEFF" + [headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={!rows.length}
      className="button-secondary gap-2 disabled:cursor-default disabled:opacity-50"
    >
      <UiIcon name="download" size={16} />
      Ekspor CSV
    </button>
  );
}
