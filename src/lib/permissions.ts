export const permissionMenus = [
  { key: "dashboard", label: "Dashboard - Karyawan & SDM", href: "/dashboard" },
  {
    key: "admin-malam-dashboard",
    label: "Dashboard - Admin Operasional Malam",
    href: "/admin-malam/dashboard",
  },
  {
    key: "monitoring-outlet",
    label: "Monitoring Outlet - Admin Operasional Malam",
    href: "/admin-malam/monitoring-outlet",
  },
  {
    key: "open-transaction",
    label: "Transfer Antar Akun - Finance & Acounting",
    href: "/open-transaction",
  },
  {
    key: "master-akun",
    label: "Laporan & Akuntansi - Finance & Acounting",
    href: "/admin-malam/master-akun",
  },
  {
    key: "finance-budgeting",
    label: "Budgeting & RAB - Finance & Acounting",
    href: "/finance/budgeting-rab",
  },
  { key: "finance-assets", label: "Aset Tetap - Finance & Acounting", href: "/finance/aset-tetap" },
  {
    key: "finance-ledger",
    label: "Finance & Ledger - Finance & Acounting",
    href: "/finance/finance-ledger",
  },
  {
    key: "finance-expenses",
    label: "Pengeluaran Operasional - Finance & Acounting",
    href: "/finance/pengeluaran-operasional",
  },
  { key: "pos", label: "POS Kasir - Penjualan dan Kasir", href: "/pos" },
  { key: "retur-pembeli", label: "Retur Pembeli - Penjualan dan Kasir", href: "/retur-pembeli" },

  { key: "template-struk", label: "Template Struk - Penjualan dan Kasir", href: "/template-struk" },
  { key: "karyawan", label: "Data Karyawan - Karyawan & SDM", href: "/karyawan" },
  { key: "jadwal", label: "Jadwal - Karyawan & SDM", href: "/jadwal" },
  { key: "absensi", label: "Absensi - Karyawan & SDM", href: "/absensi" },
  { key: "payroll", label: "Payroll - SDM & Operasional", href: "/payroll" },
  { key: "rekap-saldo", label: "Rekap Saldo - Payroll", href: "/rekap-saldo" },
  { key: "kasbon", label: "Kasbon - Payroll", href: "/kasbon" },
  { key: "bonus", label: "Bonus - Payroll", href: "/bonus" },
  { key: "selisih-setor", label: "Selisih Setoran - Payroll", href: "/selisih-setor" },
  { key: "master-area", label: "Master Area - SDM & Operasional", href: "/master-area" },
  { key: "master-outlet", label: "Master Outlet - SDM & Operasional", href: "/master-outlet" },
  { key: "supplier", label: "Supplier - Relasi", href: "/supplier" },
  { key: "pelanggan", label: "Pelanggan - Relasi", href: "/pelanggan" },
  { key: "barang-masuk", label: "Barang Masuk - Inventory & Pembelian", href: "/barang-masuk" },
  {
    key: "stok-inventory",
    label: "Stok & Inventori - Inventory & Pembelian",
    href: "/stok-inventory",
  },
  { key: "portal-karyawan", label: "Portal Karyawan - Layanan Karyawan", href: "/portal-karyawan" },
  {
    key: "portal-review",
    label: "Persetujuan - Portal Karyawan",
    href: "/portal-karyawan/persetujuan",
  },
  { key: "role", label: "Role - Setting", href: "/role" },
] as const;
export type PermissionKey = (typeof permissionMenus)[number]["key"];
export function rolePermissions(role: {
  systemKey?: string | null;
  permissions: unknown;
}): PermissionKey[] {
  if (role.systemKey === "OWNER") return permissionMenus.map((item) => item.key);
  const flags =
    role.permissions && typeof role.permissions === "object"
      ? (role.permissions as Record<string, unknown>)
      : {};
  // Existing Payroll grants retain access to the table that was moved to Rekap Saldo.
  // An explicit false lets the owner disable the new submenu independently.
  return permissionMenus
    .filter(
      (item) =>
        flags[item.key] === true ||
        (item.key === "finance-expenses" &&
          flags[item.key] === undefined &&
          flags["open-transaction"] === true) ||
        (item.key === "master-akun" &&
          flags[item.key] === undefined &&
          flags["open-transaction"] === true) ||
        (item.key === "rekap-saldo" && flags[item.key] === undefined && flags.payroll === true),
    )
    .map((item) => item.key);
}
export function hasPermission(user: { permissions: readonly string[] }, key: PermissionKey) {
  return user.permissions.includes(key);
}
export function homeFor(permissions: readonly string[]) {
  return permissionMenus.find((item) => permissions.includes(item.key))?.href || "/akses-ditolak";
}
export function permissionForPath(pathname: string): PermissionKey | undefined {
  if (pathname === "/portal-karyawan/persetujuan") return "portal-review";
  if (pathname === "/finance/jurnal-umum" || pathname.startsWith("/finance/jurnal-umum/"))
    return "finance-expenses";
  if (
    pathname === "/finance/laporan-akuntansi" ||
    pathname.startsWith("/finance/laporan-akuntansi/")
  )
    return "master-akun";
  if (pathname === "/penempatan" || pathname.startsWith("/penempatan/")) return "jadwal";
  return permissionMenus.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  )?.key;
}
