import type { OutletSchedulePeriod } from "@/lib/outlet-schedule-status";
import { operationalCash } from "@/lib/outlet-operations";
export type DashboardOutlet = {
  id: string;
  name: string;
  closed: boolean;
  areaName: string;
  schedule?: OutletSchedulePeriod;
};
export type DashboardEntry = {
  outletId: string;
  date?: string;
  totalGross: number;
  bonusAmount: number | null;
  expenseAmount: number | null;
  qris: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
  cashReceived: number | null;
  doughUsed?: number | null;
  crewName: string;
  crewCode: string | null;
  trainingCrewName: string | null;
};
export type OutletDashboardRow = DashboardOutlet & {
  records: number;
  missingWorkDays: number;
  receiptRecords: number;
  receivedKnown: number;
  pendingCash: number;
  shortage: number;
  excess: number;
  doughReports: number;
  doughPcs: number;
  crewNames: string[];
  gross: number;
  bonus: number | null;
  expense: number;
  online: number;
  qris: number;
  cash: number;
  real: number | null;
  difference: number | null;
  crew: string;
  training: string;
};
export function buildOutletDashboard(outlets: DashboardOutlet[], entries: DashboardEntry[]) {
  const grouped = new Map<string, DashboardEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.outletId) || [];
    group.push(entry);
    grouped.set(entry.outletId, group);
  }
  return [...outlets]
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
    .map((outlet): OutletDashboardRow => {
      const rows = grouped.get(outlet.id) || [];
      const sum = (fn: (r: DashboardEntry) => number) => rows.reduce((n, r) => n + fn(r), 0);
      const cash = sum(operationalCash);
      const real =
        rows.length && rows.every((r) => r.cashReceived != null)
          ? sum((r) => r.cashReceived!)
          : null;
      const names = (values: (string | null)[]) =>
        [...new Set(values.map((v) => v?.trim()).filter(Boolean))].join(", ");
      return {
        ...outlet,
        records: rows.length,
        missingWorkDays: outlet.schedule
          ? outlet.schedule.workDates.filter((date) => !rows.some((r) => r.date === date)).length
          : rows.length
            ? 0
            : 1,
        receiptRecords: rows.filter((r) => r.cashReceived != null).length,
        receivedKnown: sum((r) => r.cashReceived ?? 0),
        pendingCash: sum((r) => (r.cashReceived == null ? operationalCash(r) : 0)),
        shortage: sum((r) =>
          r.cashReceived == null ? 0 : Math.max(0, operationalCash(r) - r.cashReceived),
        ),
        excess: sum((r) =>
          r.cashReceived == null ? 0 : Math.max(0, r.cashReceived - operationalCash(r)),
        ),
        doughReports: rows.filter((r) => r.doughUsed != null).length,
        doughPcs: sum((r) => r.doughUsed ?? 0),
        crewNames: [...new Set(rows.map((r) => (r.crewCode || r.crewName).trim()).filter(Boolean))],
        gross: sum((r) => r.totalGross),
        bonus:
          rows.length && rows.every((r) => r.bonusAmount != null)
            ? sum((r) => r.bonusAmount!)
            : null,
        expense: sum((r) => r.expenseAmount || 0),
        online: sum((r) => r.gofood + r.grabfood + r.shopeefood),
        qris: sum((r) => r.qris),
        cash,
        real,
        difference: real == null ? null : real - cash,
        crew: names(rows.map((r) => r.crewCode || r.crewName)),
        training: names(rows.map((r) => r.trainingCrewName)),
      };
    });
}
export function dashboardTotals(rows: OutletDashboardRow[]) {
  const known = rows.filter((r) => r.records > 0);
  const sum = (
    key: "gross" | "bonus" | "expense" | "online" | "qris" | "cash" | "real" | "difference",
  ) => known.reduce((n, r) => n + (r[key] ?? 0), 0);
  const real = known.length && known.every((r) => r.real != null) ? sum("real") : null;
  return {
    gross: sum("gross"),
    bonus: known.length && known.every((r) => r.bonus != null) ? sum("bonus") : null,
    expense: sum("expense"),
    online: sum("online"),
    qris: sum("qris"),
    cash: sum("cash"),
    real,
    difference: real == null ? null : real - sum("cash"),
    reported: known.length,
  };
}

export function ownerInsights(rows: OutletDashboardRow[]) {
  const reported = rows.filter((r) => r.records > 0);
  const sum = (
    key:
      | "records"
      | "receiptRecords"
      | "receivedKnown"
      | "pendingCash"
      | "shortage"
      | "excess"
      | "doughReports"
      | "doughPcs",
  ) => rows.reduce((n, r) => n + r[key], 0);
  const records = sum("records"),
    receipts = sum("receiptRecords");
  const ranked = [...reported].sort(
    (a, b) => b.gross - a.gross || a.name.localeCompare(b.name, "id-ID"),
  );
  return {
    records,
    receipts,
    pending: records - receipts,
    received: sum("receivedKnown"),
    pendingCash: sum("pendingCash"),
    shortage: sum("shortage"),
    excess: sum("excess"),
    doughReports: sum("doughReports"),
    doughPcs: sum("doughPcs"),
    crewCount: new Set(rows.flatMap((r) => r.crewNames)).size,
    missing: rows.filter((r) => r.missingWorkDays > 0),
    top: ranked[0] ?? null,
    average: reported.length
      ? Math.round(reported.reduce((n, r) => n + r.gross, 0) / reported.length)
      : null,
    attention: rows
      .filter(
        (r) =>
          r.missingWorkDays > 0 ||
          (!!r.records && r.schedule?.openDays === 0) ||
          r.receiptRecords < r.records ||
          r.shortage > 0 ||
          r.excess > 0 ||
          r.cash < 0,
      )
      .sort(
        (a, b) =>
          b.shortage - a.shortage || b.excess - a.excess || a.name.localeCompare(b.name, "id-ID"),
      ),
  };
}
