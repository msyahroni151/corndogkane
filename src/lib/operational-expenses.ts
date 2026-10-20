import { parseCivilDate } from "@/lib/placements";
export type PaymentMethod = "CASH" | "BANK";
type AccountLike = {
  code: string;
  name: string;
  kind: string;
  active: boolean;
  groupName?: string;
  sourceType?: string;
};
export function isExpenseAccount(a: AccountLike) {
  return (
    a.active &&
    a.kind === "BEBAN" &&
    (a.groupName === "BEBAN OPERASIONAL" ||
      a.code.startsWith("6") ||
      (a.sourceType === "CUSTOM" && a.groupName !== "NON-OPERASIONAL" && !a.code.startsWith("7")))
  );
}
export function isPaymentAccount(a: AccountLike, method: PaymentMethod) {
  if (!a.active || a.kind !== "ASET") return false;
  const bank = /^111/.test(a.code) || /\bBANK\b/i.test(a.name);
  return method === "BANK" ? bank : !bank && (/^110/.test(a.code) || /\bKAS\b/i.test(a.name));
}
export function parseExpensePayment(form: FormData, date: Date, today: string) {
  const paymentMethod = String(form.get("paymentMethod") || "");
  if (paymentMethod !== "CASH" && paymentMethod !== "BANK")
    throw Error("Pilih sumber pembayaran Kas Tunai atau Transfer / Bank.");
  const paymentAccountId = String(form.get("paymentAccountId") || "").trim();
  if (!paymentAccountId) throw Error("Pilih akun kas atau bank pembayaran.");
  const paidAt = parseCivilDate(String(form.get("paidAt") || ""));
  if (paidAt < date || paidAt.toISOString().slice(0, 10) > today)
    throw Error("Tanggal pembayaran harus sejak tanggal pengeluaran sampai hari ini (WIB).");
  return { paymentMethod: paymentMethod as PaymentMethod, paymentAccountId, paidAt };
}
export function parseOperationalExpense(form: FormData, today: string) {
  const get = (key: string) => String(form.get(key) || "").trim(),
    postingKey = get("postingKey"),
    expenseAccountId = get("expenseAccountId"),
    purpose = get("purpose"),
    notes = get("notes"),
    raw = get("amount"),
    status = get("status"),
    method = get("paymentMethod"),
    date = parseCivilDate(get("date"));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postingKey))
    throw Error("Formulir tidak valid. Tutup dan buka kembali.");
  if (!expenseAccountId) throw Error("Pilih akun Beban Operasional.");
  if (!purpose || purpose.length > 180)
    throw Error("Isi tujuan pengeluaran, maksimal 180 karakter.");
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1000000000)
    throw Error("Nominal harus rupiah bulat antara Rp1 dan Rp1.000.000.000.");
  if (notes.length > 2000) throw Error("Catatan maksimal 2000 karakter.");
  if (status !== "PAID" && status !== "UNPAID")
    throw Error("Pilih status Sudah Bayar atau Belum Bayar.");
  if (method !== "CASH" && method !== "BANK") throw Error("Pilih Kas Tunai atau Transfer / Bank.");
  const payment =
    status === "PAID"
      ? parseExpensePayment(form, date, today)
      : { paymentMethod: method as PaymentMethod, paymentAccountId: null, paidAt: null };
  return {
    postingKey,
    expenseAccountId,
    purpose,
    notes,
    amount: Number(raw),
    date,
    status,
    ...payment,
  };
}
