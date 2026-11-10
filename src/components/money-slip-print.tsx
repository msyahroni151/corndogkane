"use client";

export function MoneySlipPrint() {
  return (
    <button type="button" className="button-primary" onClick={() => window.print()}>
      Cetak / Simpan PDF
    </button>
  );
}
