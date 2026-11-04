import { operationalProducts } from "@/lib/outlet-operations";
import { parseCivilDate } from "@/lib/placements";
import { dateFromDisplay } from "@/lib/local-date";
export const csvImportLimit = 100;
export const csvHeaders = [
  "tanggal",
  "outlet",
  "nama_outlet",
  "crew",
  "nama_crew",
  "crew_training",
  "adonan_terpakai",
  ...operationalProducts.flatMap((p) => [p.key, "harga_" + p.key]),
  "qris",
  "gofood",
  "grabfood",
  "shopeefood",
  "pengeluaran",
  "keterangan_pengeluaran",
  "setoran_tunai",
  "total_penjualan",
  "sumber_penjualan",
];
/** UTF-8 BOM and CRLF for Excel; neutralize spreadsheet formulas in text cells. */
export function encodeCsv(rows: (string | number | null | undefined)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = value == null ? "" : String(value);
            if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
            return /[",;\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
          })
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}
export function readCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  if (text.length > 2_000_000 || text.includes("\u0000"))
    throw Error("CSV maksimal 2 MB dan harus berupa teks UTF-8.");
  const first = text.split(/\r?\n/)[0] || "",
    delimiter = first.split(";").length > first.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const endRow = () => {
    endCell();
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
    if (rows.length > 10001) throw Error("CSV terlalu banyak baris.");
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw Error("Tanda petik CSV tidak valid.");
      quoted = true;
    } else if (char === delimiter) endCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      if (closed) throw Error("Pemisah setelah tanda petik CSV tidak valid.");
      cell += char;
    }
  }
  if (quoted) throw Error("Tanda petik CSV belum ditutup.");
  if (cell || row.length || closed) endRow();
  return rows.map((r) => r.map((c) => c.replace(/^'(?=[=+@\-\t\r])/, "")));
}
export function csvNumber(value: string, label: string, max: number, blank: number | null = 0) {
  const clean = value
    .trim()
    .replace(/^Rp\s*/i, "")
    .replaceAll(" ", "");
  if (!clean) return blank;
  if (!/^\d+$/.test(clean) && !/^\d{1,3}(?:\.\d{3})+$/.test(clean))
    throw Error(label + " harus angka bulat, contoh 2500 atau 2.500.");
  const n = Number(clean.replaceAll(".", ""));
  if (!Number.isSafeInteger(n) || n > max) throw Error(label + " melebihi batas " + max + ".");
  return n;
}
export type SalesCsvRow = {
  row: number;
  date: string;
  outlet: string;
  crew: string;
  trainingCrewName: string | null;
  doughUsed: number | null;
  expenseAmount: number | null;
  expenseNotes: string | null;
  cashReceived: number | null;
  quantities: Record<string, number>;
  unitPrices: Record<string, number>;
  qris: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
  totalGross: number;
};
export function parseSalesCsv(text: string) {
  const [headers, ...records] = readCsv(text);
  if (!headers) throw Error("CSV kosong.");
  const keys = headers.map((h) => h.trim().toLowerCase());
  if (new Set(keys).size !== keys.length) throw Error("Judul kolom CSV tidak boleh berulang.");
  for (const key of keys)
    if (!csvHeaders.includes(key))
      throw Error("Kolom tidak dikenal: " + key + ". Gunakan template yang disediakan.");
  for (const key of ["tanggal", "outlet", "crew", ...operationalProducts.map((p) => p.key)])
    if (!keys.includes(key)) throw Error("Kolom wajib belum ada: " + key + ".");
  if (!records.length || records.length > csvImportLimit)
    throw Error("Isi 1–" + csvImportLimit + " baris data per file.");
  const rows: SalesCsvRow[] = [],
    errors: { row: number; message: string }[] = [];
  records.forEach((record, index) => {
    const row = index + 2;
    try {
      if (record.length !== keys.length)
        throw Error(
          "Jumlah kolom tidak sesuai judul. Gunakan tanda petik untuk keterangan yang mengandung koma.",
        );
      const values = Object.fromEntries(keys.map((key, i) => [key, record[i].trim()])),
        get = (key: string) => values[key] || "";
      let date = get("tanggal");
      if (date.includes("/")) date = dateFromDisplay(date);
      parseCivilDate(date);
      if (!get("outlet") || !get("crew")) throw Error("Outlet dan crew wajib diisi.");
      if (get("sumber_penjualan") && get("sumber_penjualan").toUpperCase() !== "MANUAL")
        throw Error(
          "Hanya rekap MANUAL yang dapat diimpor. Ekspor POS/REVIEW adalah laporan dan tidak diimpor ulang.",
        );
      if (
        get("crew_training").length > 100 ||
        get("keterangan_pengeluaran").length > 1000 ||
        get("outlet").length > 200 ||
        get("crew").length > 200
      )
        throw Error("Teks terlalu panjang.");
      const quantities = Object.fromEntries(
        operationalProducts.map((p) => [p.key, csvNumber(get(p.key), p.label, 10000)!]),
      );
      const unitPrices = Object.fromEntries(
        operationalProducts.map((p) => [
          p.key,
          csvNumber(get("harga_" + p.key), "Harga " + p.label, 1000000000, p.price)!,
        ]),
      );
      const totalGross = operationalProducts.reduce(
        (sum, p) => sum + quantities[p.key] * unitPrices[p.key],
        0,
      );
      if (!Number.isSafeInteger(totalGross) || totalGross > 2000000000)
        throw Error("Total penjualan melebihi batas nominal.");
      const declared = csvNumber(get("total_penjualan"), "Total penjualan", 2000000000, null);
      if (declared !== null && declared !== totalGross)
        throw Error(
          "Total penjualan berbeda dari jumlah terjual × harga. Periksa jumlah dan harga satuan.",
        );
      const qris = csvNumber(get("qris"), "QRIS", 1000000000)!,
        gofood = csvNumber(get("gofood"), "GoFood", 1000000000)!,
        grabfood = csvNumber(get("grabfood"), "GrabFood", 1000000000)!,
        shopeefood = csvNumber(get("shopeefood"), "ShopeeFood", 1000000000)!;
      if (qris + gofood + grabfood + shopeefood > totalGross)
        throw Error("Pembayaran non-tunai melebihi omzet.");
      rows.push({
        row,
        date,
        outlet: get("outlet"),
        crew: get("crew"),
        trainingCrewName: get("crew_training") || null,
        doughUsed: csvNumber(get("adonan_terpakai"), "Adonan", 10000, null),
        expenseAmount: csvNumber(get("pengeluaran"), "Pengeluaran", 1000000000, null),
        expenseNotes: get("keterangan_pengeluaran") || null,
        cashReceived: csvNumber(get("setoran_tunai"), "Setoran tunai", 1000000000, null),
        quantities,
        unitPrices,
        qris,
        gofood,
        grabfood,
        shopeefood,
        totalGross,
      });
    } catch (error) {
      errors.push({ row, message: error instanceof Error ? error.message : "Baris tidak valid." });
    }
  });
  return { rows, errors };
}
export function salesCsvValues(row: Record<string, string | number | null | undefined>) {
  return csvHeaders.map((h) => row[h] ?? "");
}
export function salesCsvTemplate() {
  return encodeCsv([csvHeaders]);
}
