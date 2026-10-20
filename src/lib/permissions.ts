export const permissionMenus = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  {
    key: "admin-malam-dashboard",
    label: "Admin Operasional Malam · Dashboard",
    href: "/admin-malam/dashboard",
  },
  {
    key: "monitoring-outlet",
    label: "Admin Operasional Malam · Monitoring Outlet",
    href: "/admin-malam/monitoring-outlet",
  },
  {
    key: "open-transaction",
    label: "Finance · Transfer Antar Akun",
    href: "/open-transaction",
  },
  {
    key: "master-akun",
    label: "Finance · Laporan & Akuntansi / COA",
    href: "/admin-malam/master-akun",
  },
  { key: "finance-budgeting", label: "Finance · Budgeting & RAB", href: "/finance/budgeting-rab" },
  { key: "finance-assets", label: "Finance · Aset Tetap", href: "/finance/aset-tetap" },
  { key: "finance-ledger", label: "Finance · Finance & Ledger", href: "/finance/finance-ledger" },
  {
    key: "finance-expenses",
    label: "Finance · Pengeluaran Operasional",
    href: "/finance/pengeluaran-operasional",
  },
  { key: "pos", label: "POS Kasir", href: "/pos" },
  { key: "retur-pembeli", label: "Retur Pembeli", href: "/retur-pembeli" },

  { key: "karyawan", label: "Data Karyawan", href: "/karyawan" },
  { key: "jadwal", label: "Jadwal", href: "/jadwal" },
  { key: "absensi", label: "Absensi", href: "/absensi" },
  { key: "payroll", label: "Payroll", href: "/payroll" },
  { key: "rekap-saldo", label: "Rekap Saldo", href: "/rekap-saldo" },
  { key: "kasbon", label: "Kasbon", href: "/kasbon" },
  { key: "bonus", label: "Bonus", href: "/bonus" },
  { key: "selisih-setor", label: "Selisih Setoran", href: "/selisih-setor" },
  { key: "master-area", label: "Master Area", href: "/master-area" },
  { key: "master-outlet", label: "Master Outlet", href: "/master-outlet" },
  { key: "supplier", label: "Supplier", href: "/supplier" },
  { key: "pelanggan", label: "Pelanggan", href: "/pelanggan" },
  { key: "role", label: "Role & Akun Login", href: "/role" },
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
