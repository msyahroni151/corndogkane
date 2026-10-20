export type SettlementBalance = {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  deductions: { amount: number }[];
};
export function settlementLeft(row: SettlementBalance) {
  return row.amount - row.deductions.reduce((sum, p) => sum + p.amount, 0);
}
export function validateSettlementPayments(
  selections: Record<string, number>,
  rows: SettlementBalance[],
  end: Date,
) {
  for (const [id, amount] of Object.entries(selections)) {
    const row = rows.find((r) => r.id === id);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !row || row.date > end)
      return "Pilih selisih setoran disetujui milik karyawan ini sampai akhir periode.";
    if (amount > settlementLeft(row))
      return "Potongan selisih setoran melebihi sisa yang belum dipotong.";
  }
  return null;
}
