export const moneyLabels = {
  LOAN: "Kasbon baru",
  REPAYMENT: "Pembayaran kasbon",
  BONUS_EARNED: "Bonus diperoleh",
  BONUS_WITHDRAWAL: "Pengambilan bonus",
};
export const moneyStatuses = {
  PENDING: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};
export function rupiah(amount: number) {
  return "Rp " + amount.toLocaleString("id-ID");
}
type Entry = { id: string; kind: string; date: Date; amount: number; sourceId: string | null };
export function validateLedger(entries: Entry[]) {
  let bonus = 0;
  const loans = new Map<string, number>();
  const credit = (kind: string) => kind === "LOAN" || kind === "BONUS_EARNED";
  for (const e of [...entries].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      Number(credit(b.kind)) - Number(credit(a.kind)) ||
      a.id.localeCompare(b.id),
  )) {
    if (e.kind === "LOAN") loans.set(e.id, e.amount);
    if (e.kind === "REPAYMENT") {
      const left = loans.get(e.sourceId || "");
      if (left === undefined || e.amount > left)
        return "Pembayaran melebihi sisa kasbon atau tanggal pembayaran sebelum kasbon diberikan.";
      loans.set(e.sourceId!, left - e.amount);
    }
    if (e.kind === "BONUS_EARNED") bonus += e.amount;
    if (e.kind === "BONUS_WITHDRAWAL") {
      bonus -= e.amount;
      if (bonus < 0)
        return "Saldo bonus pada tanggal pengambilan tidak cukup. Periksa bonus diperoleh dan riwayat pengambilan.";
    }
  }
  return null;
}
