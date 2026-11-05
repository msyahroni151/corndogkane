import { rolePermissions } from "@/lib/permissions";
export function requiresMfa(role: {
  systemKey?: string | null;
  permissions: unknown;
  mfaRequired?: boolean;
}) {
  return (
    role.systemKey === "OWNER" ||
    role.mfaRequired === true ||
    rolePermissions(role).some((key) =>
      [
        "role",
        "payroll",
        "finance-ledger",
        "finance-expenses",
        "finance-assets",
        "master-akun",
        "open-transaction",
      ].includes(key),
    )
  );
}
