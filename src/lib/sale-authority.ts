import { hasAction } from "@/lib/permission-actions";
// Reading monitoring reports must not grant authority to override crew/outlet assignments.
export function canManageOutletSales(user: Parameters<typeof hasAction>[0]) {
  return hasAction(user, "monitoring-outlet", "edit");
}
