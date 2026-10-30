import { inventoryNumber, inventoryRound } from "@/lib/inventory";
export const orderStatusNames: Record<string, string> = {
  REQUESTED: "Menunggu gudang",
  SENT: "Dalam pengiriman",
  RECEIVED: "Diterima outlet",
  CANCELLED: "Dibatalkan",
};
export const stockEventNames: Record<string, string> = {
  SALE_USE: "Pemakaian penjualan POS / tambahan manual",
  RETURN_SEND: "Retur dikirim ke gudang",
  RETURN_RECEIVE: "Retur diterima gudang",
  OPENING: "Stok awal",
  COUNT: "Hitung fisik",
  USE: "Pemakaian penjualan (manual)",
  LOSS: "Susut outlet",
  RECEIVE: "Penerimaan gudang",
};
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}
export function stockNumber(value: unknown, zero = false) {
  try {
    return inventoryNumber(value, zero);
  } catch {
    throw new StockError("Jumlah harus valid, maksimal 1 miliar dan 3 angka desimal.");
  }
}
export type StockCommand =
  | {
      key: string;
      kind: "REQUEST";
      outletId: string;
      requesterName: string;
      notes: string;
      lines: { itemId: string; quantity: number }[];
    }
  | { key: string; kind: "SEND" | "RECEIVE" | "CANCEL"; orderId: string; version: number }
  | {
      key: string;
      kind: "COUNT" | "USE" | "LOSS";
      outletId: string;
      itemId: string;
      quantity: number;
      version: number;
      notes: string;
    };
export function parseStockCommand(form: FormData): StockCommand {
  const get = (k: string) => String(form.get(k) || "").trim();
  const key = get("requestKey"),
    kind = get("kind");
  if (!/^[a-f0-9-]{36}$/i.test(key)) throw new StockError("Form kedaluwarsa. Buka kembali popup.");
  if (["SEND", "RECEIVE", "CANCEL"].includes(kind)) {
    const version = Number(get("version"));
    if (!get("orderId") || !Number.isSafeInteger(version) || version < 0)
      throw new StockError("Permintaan tidak valid.");
    return { key, kind: kind as "SEND" | "RECEIVE" | "CANCEL", orderId: get("orderId"), version };
  }
  const outletId = get("outletId"),
    notes = get("notes");
  if (!outletId || notes.length > 2000)
    throw new StockError("Pilih outlet dan batasi catatan hingga 2.000 karakter.");
  if (kind === "REQUEST") {
    const requesterName = get("requesterName");
    if (!requesterName || requesterName.length > 160)
      throw new StockError("Isi nama pemohon / crew, maksimal 160 karakter.");
    let raw: unknown;
    try {
      raw = JSON.parse(get("lines"));
    } catch {
      throw new StockError("Daftar barang tidak valid.");
    }
    if (!Array.isArray(raw) || !raw.length || raw.length > 50)
      throw new StockError("Isi 1 sampai 50 barang.");
    const lines = raw.map((row) => {
      if (!row || typeof row.itemId !== "string" || !row.itemId)
        throw new StockError("Pilih barang yang diminta.");
      return { itemId: row.itemId, quantity: stockNumber(row.quantity) };
    });
    if (new Set(lines.map((l) => l.itemId)).size !== lines.length)
      throw new StockError("Barang yang sama cukup ditulis sekali.");
    return { key, kind, outletId, requesterName, notes, lines };
  }
  if (!["COUNT", "USE", "LOSS"].includes(kind) || !get("itemId") || notes.length < 3)
    throw new StockError("Pilih barang dan isi catatan minimal 3 karakter.");
  const version = Number(get("version"));
  if (!Number.isSafeInteger(version) || version < -1)
    throw new StockError("Versi stok tidak valid.");
  return {
    key,
    kind: kind as "COUNT" | "USE" | "LOSS",
    outletId,
    itemId: get("itemId"),
    quantity: stockNumber(get("quantity"), kind === "COUNT"),
    version,
    notes,
  };
}
export function outletStockChange(
  kind: "COUNT" | "USE" | "LOSS",
  before: number | null,
  value: number | null,
  quantity: number,
) {
  const after = inventoryRound(kind === "COUNT" ? quantity : (before ?? 0) - quantity);
  if (kind !== "COUNT" && before === null)
    throw new StockError("Catat stok awal outlet terlebih dahulu.");
  if (after < 0)
    throw new StockError("Pemakaian melebihi stok outlet. Periksa stok fisik dan penerimaan.");
  const nextValue =
    after === 0
      ? 0
      : before !== null && before > 0 && value !== null
        ? inventoryRound((value * after) / before, 4)
        : null;
  return { quantity: after, value: nextValue };
}
export function fifoShipment(
  batches: { id: string; quantity: number; value: number }[],
  quantity: number,
) {
  let remaining = quantity;
  const rows = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.quantity);
    if (take <= 0) continue;
    const after = inventoryRound(b.quantity - take),
      afterValue = after === 0 ? 0 : inventoryRound((b.value * after) / b.quantity, 4);
    rows.push({
      id: b.id,
      before: b.quantity,
      beforeValue: b.value,
      after,
      afterValue,
      value: inventoryRound(b.value - afterValue, 4),
    });
    remaining = inventoryRound(remaining - take);
  }
  if (remaining > 0)
    throw new StockError("Stok gudang belum cukup untuk mengirim seluruh permintaan.");
  return rows;
}
