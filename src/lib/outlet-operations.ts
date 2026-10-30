export const operationalProducts = [
  { key: "mozarella", label: "Mozarella", group: "Isian", price: 10000 },
  { key: "mix", label: "Mix", group: "Isian", price: 10000 },
  { key: "sosis", label: "Sosis", group: "Isian", price: 6000 },
  { key: "bengbeng", label: "Beng-beng", group: "Isian", price: 8000 },
  { key: "crumble", label: "Crumble", group: "Balutan", price: 1000 },
  { key: "mie", label: "Mie", group: "Balutan", price: 2000 },
  { key: "kentang", label: "Kentang", group: "Balutan", price: 3000 },
  { key: "cornflakes", label: "Cornflakes", group: "Balutan", price: 3000 },
  { key: "manis", label: "Manis", group: "Topping", price: 2000 },
  { key: "katushobushi", label: "Katushobushi", group: "Topping", price: 2000 },
] as const;
export const operationalPayments = [
  { key: "qris", label: "QRIS" },
  { key: "gofood", label: "Gofood" },
  { key: "grabfood", label: "GrabFood" },
  { key: "shopeefood", label: "ShopeeFood" },
] as const;
export type OperationalEntry = {
  hasManual?: boolean;
  salesSource?: string;
  version: string;
  crewId: string;
  crewLabel?: string;
  trainingCrewName: string | null;
  doughUsed: number | null;
  expenseAmount: number | null;
  expenseNotes: string | null;
  cashReceived: number | null;
  bonusDailyRate?: number | null;
  quantities: Record<string, number>;
  unitPrices: Record<string, number>;
  qris: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
};
export type OperationalLoad = {
  liveSales?: {
    totalGross: number;
    qris: number;
    gofood: number;
    grabfood: number;
    shopeefood: number;
  } | null;
  dailyRate?: number | null;
  outletName?: string;
  entry: OperationalEntry | null;
  employees: { id: string; name: string; active: boolean }[];
};
export function snapshotItems(value: unknown) {
  const data =
    value && typeof value === "object"
      ? (value as Record<string, { quantity: number; unitPrice: number }>)
      : {};
  return Object.fromEntries(
    operationalProducts.map((item) => [
      item.key,
      {
        quantity: data[item.key]?.quantity ?? 0,
        unitPrice: data[item.key]?.unitPrice ?? item.price,
      },
    ]),
  );
}

export function operationalCash(row: {
  totalGross: number;
  qris: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
  expenseAmount?: number | null;
}) {
  return (
    row.totalGross -
    row.qris -
    row.gofood -
    row.grabfood -
    row.shopeefood -
    (row.expenseAmount ?? 0)
  );
}

export function canRecordOutletCrew(employee: {
  active: boolean;
  employeeCode: string | null;
  position: string;
  department: string;
}) {
  const code = employee.employeeCode?.trim().toUpperCase();
  if (!employee.active || !code) return false;
  if (employee.position.trim().toUpperCase() === "AREA SUPERVISOR") return true;
  return (
    employee.department.trim().toUpperCase() === "OPERASIONAL OUTLET" &&
    ["CREW OUTLET", "CREW BACKUP"].includes(employee.position.trim().toUpperCase())
  );
}
