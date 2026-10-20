import { parseCivilDate } from "@/lib/placements";
export const accountKinds = {
  ASET: "Aset",
  KEWAJIBAN: "Kewajiban",
  MODAL: "Modal",
  PENDAPATAN: "Pendapatan",
  HPP: "HPP",
  BEBAN: "Beban",
};
export function parseJournal(form: FormData) {
  const get = (key: string) => String(form.get(key) || "").trim();
  const sourceAccountId = get("sourceAccountId"),
    targetAccountId = get("targetAccountId"),
    sourceSide = get("sourceSide"),
    targetSide = get("targetSide"),
    raw = get("amount"),
    notes = get("notes"),
    postingKey = get("postingKey");
  if (!sourceAccountId || !targetAccountId || sourceAccountId === targetAccountId)
    throw Error("Pilih akun asal dan tujuan yang berbeda.");
  if (
    !["DEBIT", "CREDIT"].includes(sourceSide) ||
    targetSide !== (sourceSide === "DEBIT" ? "CREDIT" : "DEBIT")
  )
    throw Error("Sisi akun asal dan tujuan harus berlawanan: debit dan kredit.");
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1000000000)
    throw Error("Nominal harus rupiah bulat antara Rp1 dan Rp1.000.000.000.");
  if (!notes || notes.length > 2000)
    throw Error("Isi keterangan transaksi, maksimal 2000 karakter.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postingKey))
    throw Error("Formulir tidak valid. Tutup dan buka kembali.");
  return {
    sourceAccountId,
    targetAccountId,
    sourceSide,
    amount: Number(raw),
    notes,
    postingKey,
    date: parseCivilDate(get("date")),
  };
}
