"use client";

export function BonusSlipPrint() {
  return (
    <button type="button" className="button-primary" onClick={() => window.print()}>
      Cetak / Simpan PDF
    </button>
  );
}
