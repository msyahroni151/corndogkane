import { operationalCash } from "@/lib/outlet-operations";
export type OutletRecapRow = {
  salesSource?: string;
  hasManual?: boolean;
  id: string;
  reference: string;
  date: string;
  outletId: string;
  outletName: string;
  outletCode: string | null;
  areaId: string;
  areaName: string;
  crewId: string;
  crewCode: string | null;
  crewName: string;
  trainingCrewName: string | null;
  doughUsed?: number | null;
  expenseAmount: number | null;
  expenseNotes: string | null;
  cashReceived: number | null;
  bonusAmount?: number | null;
  quantities: Record<string, number>;
  totalGross: number;
  qris: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
};
export const recapColumns = [
  { key: "reference", label: "ID Rekap", group: "Identitas Rekap" },
  { key: "date", label: "Tanggal Operasional", group: "Identitas Rekap" },
  { key: "outletName", label: "Cabang", group: "Identitas Rekap" },
  { key: "salesSource", label: "Sumber Penjualan", group: "Identitas Rekap" },
  { key: "crewId", label: "ID Crew", group: "Identitas Rekap" },
  { key: "crewName", label: "Nama Crew", group: "Identitas Rekap" },
  { key: "trainingCrewName", label: "Crew Training", group: "Identitas Rekap" },
  { key: "mozarella", label: "Mozarella", group: "Isian" },
  { key: "mix", label: "Mix", group: "Isian" },
  { key: "sosis", label: "Sosis", group: "Isian" },
  { key: "bengbeng", label: "Beng-beng", group: "Isian" },
  { key: "crumble", label: "Crumble", group: "Balutan" },
  { key: "mie", label: "Mie", group: "Balutan" },
  { key: "kentang", label: "Kentang", group: "Balutan" },
  { key: "cornflakes", label: "Cornflakes", group: "Balutan" },
  { key: "manis", label: "Manis", group: "Topping" },
  { key: "katushobushi", label: "Katushobushi", group: "Topping" },
  { key: "doughUsed", label: "Adonan Terpakai (pcs)", group: "Pemakaian Adonan" },
  { key: "bonusAmount", label: "Bonus Crew", group: "Rekap Penjualan" },
  { key: "totalGross", label: "Omzet", group: "Rekap Penjualan" },
  { key: "expenseAmount", label: "Nominal Pengeluaran", group: "Rekap Penjualan" },
  { key: "expenseNotes", label: "Keterangan Pengeluaran", group: "Rekap Penjualan" },
  { key: "qris", label: "Penjualan QRIS", group: "Rekap Penjualan" },
  { key: "gofood", label: "Penjualan GoFood", group: "Rekap Penjualan" },
  { key: "shopeefood", label: "Penjualan ShopeeFood", group: "Rekap Penjualan" },
  { key: "grabfood", label: "Penjualan GrabFood", group: "Rekap Penjualan" },
  { key: "online", label: "Total Online Food", group: "Rekap Penjualan" },
  { key: "cash", label: "Cash", group: "Rekap Penjualan" },
  { key: "cashReceived", label: "Real / Setoran Diterima", group: "Rekap Penjualan" },
  { key: "difference", label: "Selisih", group: "Rekap Penjualan" },
] as const;
export const recapMoneyKeys = new Set<string>([
  "expenseAmount",
  "totalGross",
  "qris",
  "gofood",
  "shopeefood",
  "grabfood",
  "online",
  "cash",
  "bonusAmount",
  "cashReceived",
  "difference",
]);
export function recapValue(row: OutletRecapRow, key: string): string | number | null {
  if (key === "salesSource")
    return (
      {
        MANUAL: "Rekap total manual",
        POS: "POS",
        MANUAL_ADD: "Tambahan manual",
        POS_MANUAL_ADD: "POS + tambahan manual",
        REVIEW: "Perlu rekonsiliasi",
      } as Record<string, string>
    )[row.salesSource || "MANUAL"];
  if (key === "date") return row.date;
  if (key === "doughUsed") return row.doughUsed ?? null;
  if (key === "reference" || key === "outletName" || key === "crewId") return row[key];
  if (key === "crewName") return row.crewCode || row.crewName;
  if (key === "trainingCrewName") return row.trainingCrewName;
  if (key === "expenseAmount" || key === "expenseNotes") return row[key];
  if (Object.hasOwn(row.quantities, key))
    return row.salesSource && row.salesSource !== "MANUAL" ? null : row.quantities[key];
  if (
    key === "totalGross" ||
    key === "qris" ||
    key === "gofood" ||
    key === "grabfood" ||
    key === "shopeefood"
  )
    return row[key];
  if (key === "online") return row.gofood + row.grabfood + row.shopeefood;
  if (key === "cash") return operationalCash(row);
  if (key === "bonusAmount") return row.bonusAmount ?? null;
  if (key === "cashReceived") return row.cashReceived;
  if (key === "difference")
    return row.cashReceived == null ? null : row.cashReceived - operationalCash(row);
  return null;
}
