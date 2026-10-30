import { paymentMethods, type PaymentMethod } from "@/lib/pos-preview";
import { parseCivilDate } from "@/lib/placements";
export class SaleError extends Error {}
export type SaleInput = {
  key: string;
  outletId: string;
  crewId: string;
  date: string;
  source: "POS" | "MANUAL_ADD";
  method: PaymentMethod;
  received: number;
  quotedTotal: number;
  notes: string;
  items: { productId: string; quantity: number }[];
};
export function parseSaleInput(raw: unknown): SaleInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new SaleError("Data transaksi tidak valid.");
  const b = raw as Record<string, unknown>,
    text = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const integer = (n: unknown, max = 1000000000) => {
    if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0 || n > max)
      throw new SaleError("Nominal atau jumlah tidak valid.");
    return n;
  };
  if (!/^[a-f0-9-]{36}$/i.test(text("key")) || !text("outletId") || !text("crewId"))
    throw new SaleError("Pilih outlet, petugas, dan buka ulang pembayaran jika form kedaluwarsa.");
  try {
    parseCivilDate(text("date"));
  } catch {
    throw new SaleError("Tanggal penjualan tidak valid.");
  }
  if (
    !["POS", "MANUAL_ADD"].includes(text("source")) ||
    !paymentMethods.includes(text("method") as PaymentMethod)
  )
    throw new SaleError("Sumber atau metode pembayaran tidak valid.");
  if (text("notes").length > 1000 || (text("source") === "MANUAL_ADD" && text("notes").length < 3))
    throw new SaleError("Isi alasan tambahan manual minimal 3 dan maksimal 1.000 karakter.");
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50)
    throw new SaleError("Isi 1 sampai 50 menu.");
  const items = b.items.map((row) => {
    if (!row || typeof row.productId !== "string" || !row.productId)
      throw new SaleError("Pilih menu terdaftar.");
    const quantity = integer(row.quantity, 100);
    if (!quantity) throw new SaleError("Jumlah menu minimal 1.");
    return { productId: row.productId, quantity };
  });
  if (new Set(items.map((i) => i.productId)).size !== items.length)
    throw new SaleError("Menu yang sama cukup ditulis sekali.");
  return {
    key: text("key"),
    outletId: text("outletId"),
    crewId: text("crewId"),
    date: text("date"),
    source: text("source") as SaleInput["source"],
    method: text("method") as PaymentMethod,
    received: integer(b.received),
    quotedTotal: integer(b.quotedTotal),
    notes: text("notes"),
    items,
  };
}
