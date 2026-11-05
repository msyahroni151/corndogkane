import { rolePermissions, type PermissionKey } from "@/lib/permissions";
export const permissionActions = ["view", "create", "edit", "delete", "export", "approve"] as const;
export type PermissionAction = (typeof permissionActions)[number];
export const actionLabels: Record<PermissionAction, string> = {
  view: "Lihat",
  create: "Tambah",
  edit: "Edit",
  delete: "Hapus",
  export: "Ekspor",
  approve: "Setujui",
};
export type ActionPermissions = Partial<Record<PermissionKey, PermissionAction[]>>;
type Role = { systemKey?: string | null; permissions: unknown };
export function roleActionPermissions(role: Role): ActionPermissions {
  const flags =
    role.permissions && typeof role.permissions === "object"
      ? (role.permissions as Record<string, unknown>)
      : {};
  const rules =
    flags._actions && typeof flags._actions === "object" && !Array.isArray(flags._actions)
      ? (flags._actions as Record<string, unknown>)
      : null;
  return Object.fromEntries(
    rolePermissions(role).map((key) => [
      key,
      role.systemKey === "OWNER" || !rules
        ? [...permissionActions]
        : permissionActions.filter(
            (a) =>
              a === "view" || (Array.isArray(rules[key]) && (rules[key] as unknown[]).includes(a)),
          ),
    ]),
  );
}
export function hasAction(
  user: {
    permissions: readonly string[];
    actionPermissions?: ActionPermissions;
    roleSystemKey?: string | null;
  },
  key: PermissionKey,
  action: PermissionAction,
) {
  return (
    user.permissions.includes(key) &&
    (user.roleSystemKey === "OWNER" ||
      !user.actionPermissions ||
      !!user.actionPermissions[key]?.includes(action))
  );
}
export function canManageRole(user: Parameters<typeof hasAction>[0], role: Role) {
  return (
    user.roleSystemKey === "OWNER" ||
    (role.systemKey !== "OWNER" &&
      Object.entries(roleActionPermissions(role)).every(([key, actions]) =>
        actions!.every((action) => hasAction(user, key as PermissionKey, action)),
      ))
  );
}
