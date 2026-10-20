import { coaRoot } from "@/lib/coa";
import type { summarizeOutletReport } from "@/lib/outlet-financial-report";
export type ReportAccount = {
  code: string;
  name: string;
  kind: string;
  groupName: string;
  subGroup: string;
  active: boolean;
  defaultLevel: string;
};
export type StatementRow = {
  key: string;
  code: string;
  label: string;
  level: "root" | "group" | "account";
  value: number | null;
  note?: string;
};
export type ReportSummary = ReturnType<typeof summarizeOutletReport>;
export function statementAccountRows(
  accounts: ReportAccount[],
  values: Record<string, number | null> = {},
): StatementRow[] {
  const roots = new Map<string, ReportAccount[]>();
  for (const a of [...accounts].sort((a, b) =>
    a.code.localeCompare(b.code, "id-ID", { numeric: true }),
  )) {
    const key = coaRoot(a).code;
    roots.set(key, [...(roots.get(key) ?? []), a]);
  }
  const subtotal = (rows: ReportAccount[]) =>
    rows.length && rows.every((a) => values[a.code] != null)
      ? rows.reduce((n, a) => n + values[a.code]!, 0)
      : null;
  return [...roots]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, rows]) => [
      {
        key: `root-${key}`,
        code: key,
        label: coaRoot(rows[0]).name,
        level: "root" as const,
        value: subtotal(rows),
      },
      ...[...new Set(rows.map((a) => a.subGroup || "Lainnya"))].flatMap((group) => {
        const children = rows.filter((a) => (a.subGroup || "Lainnya") === group);
        return [
          {
            key: `group-${key}-${group}`,
            code: "",
            label: group,
            level: "group" as const,
            value: subtotal(children),
          },
          ...children.map((a) => ({
            key: a.code,
            code: a.code,
            label: a.name,
            level: "account" as const,
            value: values[a.code] ?? null,
            note: a.active ? undefined : "Akun nonaktif; ditampilkan untuk keterlacakan historis.",
          })),
        ];
      }),
    ]);
}
export function outletStatementSections(accounts: ReportAccount[], s: ReportSummary) {
  // Source recap only. This does not create or imply posted journal entries.
  const values: Record<string, number | null> = {};
  if (s.records && accounts.some((a) => a.code === "4101" && a.kind === "PENDAPATAN"))
    values["4101"] = s.gross;
  if (s.bonus !== null && accounts.some((a) => a.code === "6104" && a.kind === "BEBAN"))
    values["6104"] = s.bonus;
  return {
    revenue: statementAccountRows(
      accounts.filter((a) => a.kind === "PENDAPATAN"),
      values,
    ),
    hpp: statementAccountRows(accounts.filter((a) => a.kind === "HPP")),
    expense: statementAccountRows(
      accounts.filter((a) => a.kind === "BEBAN"),
      values,
    ),
    currentAssets: statementAccountRows(
      accounts.filter(
        (a) => a.kind === "ASET" && !["Aset Tetap", "Akumulasi Penyusutan"].includes(a.subGroup),
      ),
    ),
    fixedAssets: statementAccountRows(
      accounts.filter(
        (a) => a.kind === "ASET" && ["Aset Tetap", "Akumulasi Penyusutan"].includes(a.subGroup),
      ),
    ),
    liabilities: statementAccountRows(accounts.filter((a) => a.kind === "KEWAJIBAN")),
    equity: statementAccountRows(accounts.filter((a) => a.kind === "MODAL")),
  };
}
export function percentageChange(current: number | null, previous: number | null) {
  return current === null || previous === null || previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}
