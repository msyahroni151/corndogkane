import {
  buildFinancialExport,
  reportExportNote,
  type ReportExportInput,
} from "@/lib/financial-report-export-data";
import { dateToDisplay } from "@/lib/local-date";
export async function createFinancialExcel(input: ReportExportInput): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Corndog Kane";
  workbook.subject = "Laporan keuangan per outlet - sementara";
  for (const table of buildFinancialExport(input)) {
    const sheet = workbook.addWorksheet(table.name, {
      views: [{ state: "frozen", ySplit: 6 }],
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    sheet.columns = table.widths.map((width) => ({ width }));
    const n = table.headers.length;
    sheet.addRow(["LAPORAN KEUANGAN OUTLET - " + table.name.toUpperCase()]);
    sheet.addRow([input.outlet]);
    sheet.addRow([`Periode ${dateToDisplay(input.from)} - ${dateToDisplay(input.to)} WIB`]);
    sheet.addRow([reportExportNote]);
    sheet.addRow([]);
    sheet.addRow(table.headers);
    for (let row = 1; row <= 4; row++) sheet.mergeCells(row, 1, row, n);
    sheet.getRow(1).height = 28;
    sheet.getRow(2).height = 25;
    sheet.getRow(3).height = 22;
    sheet.getRow(4).height = 70;
    for (const values of table.rows) sheet.addRow(values);
    sheet.eachRow((row, index) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: "Calibri", size: 11, color: { argb: "FF253F32" } };
        cell.alignment = { vertical: "top", wrapText: true };
        if (typeof cell.value === "number") {
          cell.numFmt =
            table.name === "Ringkasan" && String(row.getCell(1).value).startsWith("Jumlah")
              ? "0"
              : '"Rp" #,##0;[Red]("Rp" #,##0);"Rp" 0';
          cell.alignment = { vertical: "top", horizontal: "right" };
        }
        if (index === 1 || index === 6) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F6350" } };
          cell.font = {
            name: "Calibri",
            size: index === 1 ? 14 : 11,
            bold: true,
            color: { argb: "FFFFFFFF" },
          };
        } else if (index === 4) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF6DF" } };
          cell.font = { name: "Calibri", size: 10, color: { argb: "FF775522" } };
        } else if (index > 6 && index % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F8F5" } };
        }
      });
      if (index > 6) {
        const maxLines = Math.max(
          ...table.widths.map((width, i) =>
            String(row.getCell(i + 1).value ?? "")
              .split("\n")
              .reduce(
                (n, line) => n + Math.max(1, Math.ceil(line.length / Math.max(8, width - 3))),
                0,
              ),
          ),
        );
        row.height = Math.min(409, Math.max(23, maxLines * 15));
      }
    });
    sheet.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: 6 + table.rows.length, column: n },
    };
    sheet.pageSetup.printTitlesRow = "1:6";
    sheet.headerFooter.oddFooter = "&L" + table.name + "&RHalaman &P dari &N";
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer).buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
