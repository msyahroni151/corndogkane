import { StockError, stockNumber } from "@/lib/outlet-stock";
export const returnStatusNames: Record<string, string> = {
  REQUESTED: "Diajukan",
  APPROVED: "Disetujui",
  SENT: "Dalam perjalanan",
  PARTIAL: "Diterima sebagian",
  RECEIVED: "Diterima gudang",
  CANCELLED: "Dibatalkan",
  REJECTED: "Ditolak",
};
export const returnActionNames: Record<string, string> = {
  CREATE: "Pengajuan",
  APPROVE: "Persetujuan",
  SEND: "Pengiriman outlet",
  RECEIVE: "Penerimaan gudang",
  CANCEL: "Pembatalan",
  REJECT: "Penolakan",
};
export type ReturnCommand =
  | {
      key: string;
      kind: "CREATE";
      outletId: string;
      requesterName: string;
      notes: string;
      lines: { itemId: string; quantity: number }[];
    }
  | {
      key: string;
      kind: "APPROVE" | "SEND" | "REJECT" | "CANCEL";
      id: string;
      version: number;
      notes: string;
    }
  | {
      key: string;
      kind: "RECEIVE";
      id: string;
      version: number;
      notes: string;
      lines: { lineId: string; quantity: number; manualValue: number | null }[];
    };
export function parseReturnCommand(form: FormData): ReturnCommand {
  const read = (name: string) => String(form.get(name) ?? "").trim(),
    key = read("requestKey"),
    kind = read("kind"),
    notes = read("notes");
  if (!/^[a-f0-9-]{36}$/i.test(key)) throw new StockError("Form kedaluwarsa. Buka kembali popup.");
  if (notes.length > 2000) throw new StockError("Catatan maksimal 2.000 karakter.");
  function lines() {
    let raw: unknown;
    try {
      raw = JSON.parse(read("lines"));
    } catch {
      throw new StockError("Daftar barang tidak valid.");
    }
    if (!Array.isArray(raw) || !raw.length || raw.length > 50)
      throw new StockError("Isi 1 sampai 50 barang retur.");
    return raw;
  }
  if (kind === "CREATE") {
    if (
      !read("outletId") ||
      !read("requesterName") ||
      read("requesterName").length > 160 ||
      notes.length < 3
    )
      throw new StockError("Pilih outlet, isi nama petugas dan alasan retur minimal 3 karakter.");
    const parsed = lines().map((row) => {
      if (!row || typeof row.itemId !== "string" || !row.itemId)
        throw new StockError("Pilih barang retur.");
      return { itemId: row.itemId, quantity: stockNumber(row.quantity) };
    });
    if (new Set(parsed.map((l) => l.itemId)).size !== parsed.length)
      throw new StockError("Barang yang sama cukup dicatat sekali.");
    return {
      key,
      kind,
      outletId: read("outletId"),
      requesterName: read("requesterName"),
      notes,
      lines: parsed,
    };
  }
  const id = read("id"),
    version = Number(read("version"));
  if (!id || !read("version") || !Number.isSafeInteger(version) || version < 0)
    throw new StockError("Versi retur tidak valid. Muat ulang halaman.");
  if (kind === "RECEIVE") {
    const parsed = lines().map((row) => {
      if (!row || typeof row.lineId !== "string" || !row.lineId)
        throw new StockError("Barang penerimaan tidak valid.");
      const manual = row.manualValue;
      if (
        manual !== null &&
        manual !== undefined &&
        manual !== "" &&
        (!/^\d{1,13}$/.test(String(manual)) || Number(manual) > 1000000000000)
      )
        throw new StockError("Nilai perolehan harus rupiah bulat antara 0 sampai 1 triliun.");
      return {
        lineId: row.lineId,
        quantity: stockNumber(row.quantity, true),
        manualValue:
          manual === null || manual === undefined || manual === "" ? null : Number(manual),
      };
    });
    if (
      new Set(parsed.map((l) => l.lineId)).size !== parsed.length ||
      !parsed.some((l) => l.quantity > 0)
    )
      throw new StockError("Isi jumlah penerimaan minimal satu barang tanpa duplikasi.");
    return { key, kind, id, version, notes, lines: parsed };
  }
  if (!["APPROVE", "SEND", "REJECT", "CANCEL"].includes(kind))
    throw new StockError("Tindakan retur tidak valid.");
  if (["REJECT", "CANCEL"].includes(kind) && notes.length < 3)
    throw new StockError("Isi alasan minimal 3 karakter.");
  return { key, kind: kind as "APPROVE" | "SEND" | "REJECT" | "CANCEL", id, version, notes };
}
