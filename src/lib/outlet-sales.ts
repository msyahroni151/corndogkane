export type OutletSales = {
  source?: "manual";
  countKnown?: boolean;
  cashKnown?: boolean;
  days?: number;
  crewNames?: string[];
  total: number;
  count: number;
  cash: number;
  qris: number;
  online: number;
  expense?: number;
};
import type { OutletSchedulePeriod } from "@/lib/outlet-schedule-status";
export type MonitoringSales = {
  schedules?: Record<string, OutletSchedulePeriod>;
  status: "connected" | "unconfigured" | "error";
  start: string;
  end: string;
  outlets: Record<string, OutletSales>;
  fetchedAt?: string;
};
export function matchOutletSales(
  source: { name: string; sales: OutletSales }[],
  local: { id: string; name: string }[],
) {
  const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleUpperCase("id-ID");
  const result: Record<string, OutletSales> = {};
  for (const outlet of local) {
    const matches = source.filter((item) => normalize(item.name) === normalize(outlet.name));
    if (matches.length === 1) result[outlet.id] = matches[0].sales;
  }
  return result;
}
