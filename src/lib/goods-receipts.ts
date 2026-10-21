import { parseCivilDate } from "@/lib/placements";
export const receiptMethods = ["TUNAI", "TRANSFER", "HUTANG", "COD"] as const;
export const receiptUnits = ["PCS", "GRAM", "KG", "ML", "LITER"] as const;
export const packagingUnits = ["KARTON", "KARUNG", "PACK", "PCS", "POUCH", "IKET", "PILE 5 KG"];
export type ReceiptLineDraft = {
  key: string;
  name: string;
  packCount: string;
  packagingUnit: string;
  quantityPerPack: string;
  inputUnit: string;
  amount: string;
};
export type ItemOption = { name: string; packagingUnit: string };
export const itemKey = (name: string) => name.trim().replace(/\s+/g, " ").toUpperCase();
export const quantityLabel = (quantity: number, unit: string) =>
  quantity.toLocaleString("id-ID", { maximumFractionDigits: 3 }) + " " + unit.toLowerCase();
export function normalizedQuantity(count: number, perPack: number, unit: string) {
  const factor = unit === "KG" || unit === "LITER" ? 1000 : 1;
  return {
    quantity: Math.round(count * perPack * factor * 1000) / 1000,
    baseUnit: unit === "KG" ? "GRAM" : unit === "LITER" ? "ML" : unit,
  };
}
export function parseGoodsReceipt(form: FormData, today: string) {
  const get = (key: string) => String(form.get(key) || "").trim();
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const postingKey = get("postingKey");
  if (!/^[a-f0-9-]{36}$/i.test(postingKey)) fail("Form kedaluwarsa. Tutup dan buka kembali popup.");
  const date = get("date") || today;
  parseCivilDate(date);
  if (date > today) fail("Tanggal barang datang tidak boleh melewati hari ini.");
  const paymentMethod = get("paymentMethod");
  if (!receiptMethods.includes(paymentMethod as (typeof receiptMethods)[number]))
    fail("Metode pembayaran tidak valid.");
  const supplierId = get("supplierId");
  if (supplierId.length > 100) fail("Supplier tidak valid.");
  const paid =
    paymentMethod === "HUTANG" ? false : paymentMethod === "COD" ? get("codPaid") === "true" : true;
  const notes = get("notes");
  if (notes.length > 2000) fail("Catatan maksimal 2.000 karakter.");
  const money = (value: unknown) => {
    const raw = String(value ?? "");
    if (!/^\d{1,10}$/.test(raw) || Number(raw) > 1_000_000_000)
      fail("Nominal harus rupiah bulat antara 0 dan 1 miliar.");
    return Number(raw);
  };
  const decimal = (value: unknown) => {
    const raw = String(value ?? "");
    if (!/^\d{1,7}(\.\d{1,3})?$/.test(raw) || Number(raw) <= 0 || Number(raw) > 1_000_000)
      fail("Jumlah dan isi kemasan harus lebih dari 0, maksimal 1 juta dan 3 angka desimal.");
    return Number(raw);
  };
  const rawLines: unknown = JSON.parse(get("lines") || "[]");
  if (!Array.isArray(rawLines) || !rawLines.length || rawLines.length > 50)
    fail("Isi 1 hingga 50 barang per transaksi.");
  const lines = (rawLines as Record<string, unknown>[]).map((row) => {
    if (!row || typeof row !== "object") fail("Data barang tidak valid.");
    const name = String(row.name || "")
        .trim()
        .replace(/\s+/g, " "),
      packagingUnit = String(row.packagingUnit || "")
        .trim()
        .toUpperCase(),
      inputUnit = String(row.inputUnit || "");
    if (!name || name.length > 150) fail("Nama barang wajib diisi, maksimal 150 karakter.");
    if (!packagingUnit || packagingUnit.length > 40)
      fail("Satuan kemasan wajib diisi, maksimal 40 karakter.");
    if (!receiptUnits.includes(inputUnit as (typeof receiptUnits)[number]))
      fail("Satuan isi kemasan tidak valid.");
    const packCount = decimal(row.packCount),
      quantityPerPack = decimal(row.quantityPerPack),
      amount = money(row.amount),
      normalized = normalizedQuantity(packCount, quantityPerPack, inputUnit);
    if (
      !Number.isFinite(normalized.quantity) ||
      normalized.quantity <= 0 ||
      normalized.quantity > 1_000_000_000
    )
      fail("Total kuantitas barang terlalu besar atau terlalu kecil.");
    return { name, packagingUnit, inputUnit, packCount, quantityPerPack, amount, ...normalized };
  });
  const porterFee = money(get("porterFee") || "0"),
    total = lines.reduce((sum, row) => sum + row.amount, porterFee);
  if (!Number.isSafeInteger(total) || total > 1_000_000_000)
    fail("Total tagihan maksimal Rp1 miliar.");
  return { postingKey, date, supplierId, paymentMethod, paid, porterFee, total, notes, lines };
}
