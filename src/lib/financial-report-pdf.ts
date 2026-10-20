import {
  buildFinancialExport,
  reportExportNote,
  type ReportExportInput,
  type ExportTable,
} from "@/lib/financial-report-export-data";
import { dateToDisplay } from "@/lib/local-date";
import { rupiah } from "@/lib/money";
export async function createFinancialPdf(input: ReportExportInput): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const tables = buildFinancialExport(input);
  let first = true;
  const clean = (text: string) => text.replaceAll("—", "-").replaceAll("·", "-");
  function render(table: ExportTable, landscape = false) {
    if (!first) doc.addPage("a4", landscape ? "landscape" : "portrait");
    first = false;
    const width = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(42, 80, 57);
    doc.text("LAPORAN KEUANGAN OUTLET", 12, 15);
    doc.setFontSize(10);
    const outletLines = doc.splitTextToSize(clean(input.outlet), width - 24);
    doc.text(outletLines, 12, 22);
    let y = 24 + outletLines.length * 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(85);
    doc.text(`Periode ${dateToDisplay(input.from)} - ${dateToDisplay(input.to)} WIB`, 12, y);
    y += 5;
    const notes = doc.splitTextToSize(reportExportNote, width - 24);
    doc.setFontSize(7.5);
    doc.text(notes, 12, y);
    y += notes.length * 3.8 + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(42, 80, 57);
    doc.text(table.name, 12, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { top: 27, bottom: 14, left: 12, right: 12 },
      head: [table.headers],
      body: table.rows.map((row) =>
        row.map((value) =>
          typeof value === "number"
            ? table.name === "Ringkasan" && String(row[0]).startsWith("Jumlah")
              ? String(value)
              : rupiah(value)
            : clean(String(value)),
        ),
      ),
      theme: "striped",
      styles: {
        font: "helvetica",
        fontSize: landscape ? 7 : 8,
        cellPadding: 2.3,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: { fillColor: [63, 99, 80], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 248, 245] },
      rowPageBreak: "avoid",
      columnStyles:
        table.headers.length === 3
          ? { 0: { cellWidth: 18 }, 1: { cellWidth: 125 }, 2: { halign: "right" } }
          : table.headers.length === 7
            ? {
                0: { cellWidth: 24 },
                1: { cellWidth: 24 },
                2: { cellWidth: 24 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25 },
                5: { cellWidth: 25 },
                6: { cellWidth: 126 },
              }
            : table.headers.length === 10
              ? { 0: { cellWidth: 24 }, 1: { cellWidth: 30 } }
              : {},
      didParseCell(data) {
        if (
          typeof table.rows[data.row.index]?.[data.column.index] === "number" &&
          data.section === "body"
        )
          data.cell.styles.halign = "right";
      },
      willDrawPage(data) {
        if (data.pageNumber > 1) {
          doc.setFontSize(9);
          doc.setTextColor(63, 99, 80);
          doc.text(
            doc.splitTextToSize(clean(input.outlet) + " - " + table.name, width - 24).slice(0, 2),
            12,
            12,
          );
          doc.setFontSize(7);
          doc.text(`${dateToDisplay(input.from)} - ${dateToDisplay(input.to)} WIB`, 12, 23);
        }
      },
    });
    // Footer is added after all tables so total page count is accurate.
  }
  for (const table of tables) {
    if (table.name !== "Rekap Harian") {
      render(table);
      continue;
    }
    render(
      {
        name: "Rekap Harian - Keuangan",
        headers: [
          "Tanggal",
          "Crew",
          "Omzet",
          "QRIS",
          "Online Food",
          "Pengeluaran",
          "Bonus",
          "Cash",
          "Real",
          "Selisih",
        ],
        widths: [],
        rows: table.rows.map((row) => [
          row[0],
          row[1],
          row[3],
          row[4],
          typeof row[5] === "number" && typeof row[6] === "number" && typeof row[7] === "number"
            ? row[5] + row[6] + row[7]
            : "Belum tersedia",
          row[8],
          row[9],
          row[10],
          row[11],
          row[12],
        ]),
      },
      true,
    );
    render(
      {
        name: "Rekap Harian - Pembayaran & Catatan",
        headers: [
          "Tanggal",
          "Crew",
          "Training",
          "GoFood",
          "GrabFood",
          "ShopeeFood",
          "Catatan Pengeluaran",
        ],
        widths: [],
        rows: table.rows.map((row) => [
          row[0],
          row[1],
          row[2],
          row[5],
          row[6],
          row[7],
          row[13] ?? "",
        ]),
      },
      true,
    );
  }
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(105);
    doc.text("Corndog Kane | Laporan sementara", 12, doc.internal.pageSize.getHeight() - 7);
    doc.text(
      `Halaman ${page} / ${count}`,
      doc.internal.pageSize.getWidth() - 12,
      doc.internal.pageSize.getHeight() - 7,
      { align: "right" },
    );
  }
  return doc.output("blob");
}
