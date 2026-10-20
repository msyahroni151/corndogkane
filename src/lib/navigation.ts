import type { IconName } from "@/components/ui-icon";
export type MenuItem = { href: string; name: string; icon: IconName };
export const nightOperationsMenu: MenuItem[] = [
  { href: "/admin-malam/dashboard", name: "Dashboard", icon: "dashboard" },
  { href: "/admin-malam/monitoring-outlet", name: "Monitoring Outlet", icon: "building" },
];
export const salesMenu: MenuItem[] = [
  { href: "/pos", name: "POS Kasir", icon: "cart" },
  { href: "/retur-pembeli", name: "Retur Pembeli", icon: "return" },
];
export const financeMenu: MenuItem[] = [
  { href: "/finance/budgeting-rab", name: "Budgeting & RAB", icon: "coins" },
  { href: "/finance/pengeluaran-operasional", name: "Pengeluaran Operasional", icon: "receipt" },
  { href: "/finance/aset-tetap", name: "Aset Tetap", icon: "building" },
  { href: "/open-transaction", name: "Transfer Antar Akun", icon: "wallet" },
  { href: "/finance/finance-ledger", name: "Finance & Ledger", icon: "wallet" },
  { href: "/finance/laporan-akuntansi", name: "Laporan & Akuntansi", icon: "coins" },
];
export const peopleMenu: MenuItem[] = [
  { href: "/dashboard", name: "Dashboard", icon: "dashboard" },
  { href: "/karyawan", name: "Data Karyawan", icon: "people" },
  { href: "/jadwal", name: "Jadwal", icon: "calendar" },
  { href: "/absensi", name: "Absensi", icon: "check" },
];
export const payrollMenu: MenuItem[] = [
  { href: "/payroll", name: "Payroll", icon: "coins" },
  { href: "/rekap-saldo", name: "Rekap Saldo", icon: "wallet" },
  { href: "/kasbon", name: "Kasbon", icon: "wallet" },
  { href: "/bonus", name: "Bonus", icon: "gift" },
  { href: "/selisih-setor", name: "Selisih Setoran", icon: "receipt" },
];
export const mainMenu: MenuItem[] = [
  { href: "/karyawan", name: "Karyawan & SDM", icon: "people" },
  { href: "/payroll", name: "Payroll", icon: "coins" },
  { href: "/master-area", name: "Master Area", icon: "location" },
  { href: "/master-outlet", name: "Master Outlet", icon: "building" },
];
export const relationMenu: MenuItem[] = [
  { href: "/supplier", name: "Supplier", icon: "truck" },
  { href: "/pelanggan", name: "Pelanggan", icon: "people" },
];
export const settingsMenu: MenuItem[] = [{ href: "/role", name: "Role", icon: "shield" }];
export const matchesMenu = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");
export function activeMainMenu(pathname: string) {
  const finance = financeMenu.find((item) => matchesMenu(pathname, item.href));
  if (finance) return finance.href;
  const nightMenu = nightOperationsMenu.find((item) => matchesMenu(pathname, item.href));
  if (nightMenu) return nightMenu.href;
  if (salesMenu.some((item) => matchesMenu(pathname, item.href)))
    return salesMenu.find((item) => matchesMenu(pathname, item.href))?.href;
  if (matchesMenu(pathname, "/penempatan")) return "/karyawan";
  if (peopleMenu.some((item) => matchesMenu(pathname, item.href))) return "/karyawan";
  if (payrollMenu.some((item) => matchesMenu(pathname, item.href))) return "/payroll";
  if (relationMenu.some((item) => matchesMenu(pathname, item.href)))
    return relationMenu.find((item) => matchesMenu(pathname, item.href))?.href;
  if (settingsMenu.some((item) => matchesMenu(pathname, item.href)))
    return settingsMenu.find((item) => matchesMenu(pathname, item.href))?.href;
  return mainMenu.find((item) => matchesMenu(pathname, item.href))?.href;
}
