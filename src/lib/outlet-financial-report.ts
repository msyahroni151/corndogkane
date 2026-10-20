import { operationalCash } from "@/lib/outlet-operations";
export type OutletReportEntry = {
  date: string;
  totalGross: number;
  qris: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
  expenseAmount: number | null;
  bonusAmount: number | null;
  cashReceived: number | null;
  crewName: string;
  trainingCrewName: string | null;
  expenseNotes: string | null;
};
export function summarizeOutletReport(entries: OutletReportEntry[]) {
  const sum = (fn: (e: OutletReportEntry) => number) => entries.reduce((n, e) => n + fn(e), 0);
  const receipts = entries.filter((e) => e.cashReceived !== null);
  return {
    records: entries.length,
    gross: sum((e) => e.totalGross),
    qris: sum((e) => e.qris),
    gofood: sum((e) => e.gofood),
    grabfood: sum((e) => e.grabfood),
    shopeefood: sum((e) => e.shopeefood),
    online: sum((e) => e.gofood + e.grabfood + e.shopeefood),
    expense: sum((e) => e.expenseAmount ?? 0),
    bonus:
      entries.length && entries.every((e) => e.bonusAmount !== null)
        ? sum((e) => e.bonusAmount!)
        : null,
    cash: sum(operationalCash),
    received: sum((e) => e.cashReceived ?? 0),
    receipts: receipts.length,
    real: entries.length && receipts.length === entries.length ? sum((e) => e.cashReceived!) : null,
    difference:
      entries.length && receipts.length === entries.length
        ? sum((e) => e.cashReceived! - operationalCash(e))
        : null,
    pendingCash: sum((e) => (e.cashReceived === null ? operationalCash(e) : 0)),
    shortage: sum((e) =>
      e.cashReceived === null ? 0 : Math.max(0, operationalCash(e) - e.cashReceived),
    ),
    excess: sum((e) =>
      e.cashReceived === null ? 0 : Math.max(0, e.cashReceived - operationalCash(e)),
    ),
  };
}
export function reportCsvCell(value: string | number) {
  const text = String(value);
  return (
    '"' +
    (/^[\s]*[=+@-]/.test(text) && typeof value === "string" ? "'" : "") +
    text.replaceAll('"', '""') +
    '"'
  );
}
