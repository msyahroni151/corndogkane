export const coaSourceUrl =
  "https://docs.google.com/spreadsheets/d/1oP3wEpsDtUcQeD248Sl_Xv7r9y0IJfZyhFi1XojCADQ/edit#gid=810101";
export function coaRoot(account: { code: string; kind: string; groupName: string }) {
  const first = /^[1-8]/.test(account.code)
    ? account.code[0]
    : (
        { ASET: "1", KEWAJIBAN: "2", MODAL: "3", PENDAPATAN: "4", HPP: "5", BEBAN: "6" } as Record<
          string,
          string
        >
      )[account.kind] || "6";
  const titles: Record<string, string> = {
    "1": "ASET",
    "2": "LIABILITAS",
    "3": "EKUITAS",
    "4": "PENDAPATAN",
    "5": "HARGA POKOK PENJUALAN",
    "6": "BEBAN OPERASIONAL",
    "7": "PENDAPATAN & BEBAN LAIN",
    "8": "PAJAK",
  };
  return {
    code: first + "000",
    name: titles[first],
    kind: first === "7" ? "PENDAPATAN" : first === "8" ? "BEBAN" : account.kind,
  };
}
export function normalBalanceLabel(value: string) {
  return value === "BOTH" ? "DEBIT / CREDIT" : value;
}
export type CoaAccount = {
  id: string;
  code: string;
  name: string;
  kind: string;
  active: boolean;
  version: string;
  groupName: string;
  subGroup: string;
  normalBalance: string;
  sourceType: string;
  sourceStatus: string;
  notes: string;
  defaultLevel: string;
  reportType: string;
  coaVersion: string | null;
};
