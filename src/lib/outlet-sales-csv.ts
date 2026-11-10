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
  "status_operasional",
  "keterangan_operasional",
];
const salesExportColumns = [
  ["Tanggal", "tanggal"],
  ["Nama_Outlet", "nama_outlet"],
  ["kode_name", "nama_crew"],
  ["Crew_Training", "crew_training"],
  ["Mozarella", "mozarella"],
  ["Harga_mozarella", "harga_mozarella"],
  ["Mix", "mix"],
  ["Harga_Mix", "harga_mix"],
  ["Sosis", "sosis"],
  ["Harga_Sosis", "harga_sosis"],
  ["Beng-beng", "bengbeng"],
  ["Harga_Beng-beng", "harga_bengbeng"],
  ["Crumble", "crumble"],
  ["Harga_Crumble", "harga_crumble"],
  ["Mie", "mie"],
  ["Harga_Mie", "harga_mie"],
  ["Kentang", "kentang"],
  ["Harga_Kentang", "harga_kentang"],
  ["Cornflakes", "cornflakes"],
  ["Harga_Cornflakes", "harga_cornflakes"],
  ["Katsuobushi", "katushobushi"],
  ["Harga_Katsuobushi", "harga_katushobushi"],
  ["Manis", "manis"],
  ["Harga_Manis", "harga_manis"],
  ["Adonan_Terpakai", "adonan_terpakai"],
  ["Total_Omzet", "total_penjualan"],
  ["Pengeluaran", "pengeluaran"],
  ["Keterangan_Pengeluaran", "keterangan_pengeluaran"],
  ["ShopeeFood", "shopeefood"],
  ["GrabFood", "grabfood"],
  ["GoFood", "gofood"],
  ["QRIS", "qris"],
  ["Setoran_Tunai", "setoran_tunai"],
  ["sumber_penjualan", "sumber_penjualan"],
  ["status_operasional", "status_operasional"],
  ["keterangan_operasional", "keterangan_operasional"],
] as const;
export const salesExportHeaders = salesExportColumns.map(([label]) => label);
const salesImportAliases = new Map<string, string>([
  ...salesExportColumns.map(([label, key]): [string, string] => [label.toLowerCase(), key]),
  ["kode_outlet", "outlet"],
  ["id_crew", "crew"],
]);

/** Excel delimiter hint makes columns independent of Windows list-separator settings. */
export function encodeCsv(rows: (string | number | null | undefined)[][]) {
  return (
    "\uFEFFsep=;\r\n" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = value == null ? "" : String(value);
            if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
            return /[",;\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
          })
          .join(";"),
      )
      .join("\r\n") +
    "\r\n"
  );
}
export function readCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  if (text.length > 2_000_000 || text.includes("\u0000"))
    throw Error("CSV maksimal 2 MB dan harus berupa teks UTF-8.");
  const hint = /^sep=([,;])(?:\r\n|\r|\n|$)/i.exec(text);
  if (hint) text = text.slice(hint[0].length);
  const first = text.split(/\r?\n/)[0] || "",
    delimiter = hint?.[1] ?? (first.split(";").length > first.split(",").length ? ";" : ",");
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
  outletByName: boolean;
  crewByCode: boolean;
  row: number;
  date: string;
  outlet: string;
  crew: string;
  operationalStatus: "BUKA" | "TUTUP";
  operationalNotes: string;
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
  const labels = headers.map((header) => header.trim().toLowerCase());
  const keys = labels.map((key) => salesImportAliases.get(key) ?? key);
  if (new Set(keys).size !== keys.length) throw Error("Judul kolom CSV tidak boleh berulang.");
  for (const key of keys)
    if (!csvHeaders.includes(key))
      throw Error("Kolom tidak dikenal: " + key + ". Gunakan template yang disediakan.");
  for (const key of ["tanggal", ...operationalProducts.map((p) => p.key)])
    if (!keys.includes(key)) throw Error("Kolom wajib belum ada: " + key + ".");
  if (!keys.includes("outlet") && !keys.includes("nama_outlet"))
    throw Error("Kolom wajib belum ada: Nama_Outlet.");
  if (!keys.includes("crew") && !keys.includes("nama_crew"))
    throw Error("Kolom wajib belum ada: kode_name.");
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
      const legacyClosed = get("crew").toUpperCase() === "TUTUP";
      const outlet = get("outlet") || get("nama_outlet");
      const crew = get("crew") || get("nama_crew");
      const operationalStatus =
        get("status_operasional").toUpperCase() || (legacyClosed ? "TUTUP" : "BUKA");
      if (!["BUKA", "TUTUP"].includes(operationalStatus))
        throw Error("Status operasional harus BUKA atau TUTUP.");
      if (legacyClosed && operationalStatus !== "TUTUP")
        throw Error("Crew TUTUP bertentangan dengan status BUKA.");
      if (!outlet) throw Error("Outlet wajib diisi.");
      if (operationalStatus === "BUKA" && !crew)
        throw Error("Crew wajib diisi untuk outlet BUKA.");
      if (operationalStatus === "TUTUP" && crew && !legacyClosed)
        throw Error("Kosongkan crew untuk outlet TUTUP.");
      if (operationalStatus === "BUKA" && get("keterangan_operasional"))
        throw Error(
          "Keterangan operasional digunakan untuk outlet TUTUP; gunakan keterangan_pengeluaran untuk catatan rekap BUKA.",
        );
      if (get("keterangan_operasional").length > 1000)
        throw Error("Keterangan operasional maksimal 1.000 karakter.");
      if (get("sumber_penjualan") && get("sumber_penjualan").toUpperCase() !== "MANUAL")
        throw Error(
          "Hanya rekap MANUAL yang dapat diimpor. Ekspor POS/REVIEW adalah laporan dan tidak diimpor ulang.",
        );
      if (
        get("crew_training").length > 100 ||
        get("keterangan_pengeluaran").length > 1000 ||
        outlet.length > 200 ||
        crew.length > 200
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
      if (
        operationalStatus === "TUTUP" &&
        (Object.values(quantities).some(Boolean) ||
          qris ||
          gofood ||
          grabfood ||
          shopeefood ||
          csvNumber(get("pengeluaran"), "Pengeluaran", 1000000000) ||
          csvNumber(get("setoran_tunai"), "Setoran tunai", 1000000000) ||
          csvNumber(get("adonan_terpakai"), "Adonan", 10000) ||
          get("crew_training"))
      )
        throw Error(
          "Outlet TUTUP tidak boleh memiliki penjualan, pembayaran, pengeluaran, setoran, pemakaian adonan, atau crew training.",
        );
      rows.push({
        row,
        date,
        outlet,
        outletByName: !get("outlet"),
        crew: operationalStatus === "TUTUP" ? "" : crew,
        crewByCode: !get("crew") && labels.includes("kode_name"),
        operationalStatus: operationalStatus as "BUKA" | "TUTUP",
        operationalNotes:
          get("keterangan_operasional") ||
          (operationalStatus === "TUTUP" ? get("keterangan_pengeluaran") : ""),
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
export function salesExportValues(row: Record<string, string | number | null | undefined>) {
  return salesExportColumns.map(([, key]) => row[key] ?? "");
}
export function salesCsvTemplate() {
  return encodeCsv([salesExportHeaders]);
}
