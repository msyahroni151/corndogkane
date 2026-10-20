import { dateToDisplay } from "@/lib/local-date";
export const operationalRoles = ["REGULER", "BACKUP", "LEADER_SHIFT", "CREW_GUDANG"] as const;
export type OperationalRole = (typeof operationalRoles)[number];
export const roleLabels: Record<OperationalRole, string> = {
  REGULER: "Crew reguler",
  BACKUP: "Crew backup",
  LEADER_SHIFT: "Leader gudang",
  CREW_GUDANG: "Crew gudang",
};
export const roleColors: Record<OperationalRole, string> = {
  REGULER: "#e3f0d6",
  BACKUP: "#d8e9fa",
  LEADER_SHIFT: "#e9def4",
  CREW_GUDANG: "#ffe4cd",
};
export function isBackupEmployee(employee: { position: string }) {
  return ["CREW BACKUP", "AREA SUPERVISOR"].includes(employee.position.trim().toUpperCase());
}
export function employeeGroup(employee: {
  department: string;
  position: string;
  active: boolean;
}): "outlet" | "warehouse" | null {
  if (!employee.active) return null;
  const department = employee.department.trim().toUpperCase(),
    position = employee.position.trim().toUpperCase();
  if (position === "AREA SUPERVISOR") return "outlet";
  if (
    (department.includes("OUTLET") || department === "OPERASIONAL") &&
    ["CREW OUTLET", "CREW BACKUP"].includes(position)
  )
    return "outlet";
  if (
    (department.includes("GUDANG") || department.includes("WAREHOUSE")) &&
    ["CREW GUDANG", "LEADER SHIFT", "LEADER GUDANG", "LEADER WAREHOUSE"].includes(position)
  )
    return "warehouse";
  return null;
}
export function todayWib(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
export function displayDate(date: Date) {
  return dateToDisplay(date.toISOString().slice(0, 10));
}
export function parseCivilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Isi tanggal mulai dan selesai yang valid.");
  const date = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error("Tanggal tidak valid.");
  return date;
}
