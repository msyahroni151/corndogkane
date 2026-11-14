import { isWorkingSchedule } from "@/lib/schedules";
import { timeLabel } from "@/lib/schedules";
export type ShareRow = {
  id: string;
  employeeId: string;
  name: string;
  date: string;
  role: string;
  status: string;
  outletId: string | null;
  outletName: string | null;
  homeAreaId: string | null;
  homeAreaName: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
};
export type ShareScheduleData = {
  from: string;
  to: string;
  areas: { id: string; name: string; active?: boolean }[];
  outlets: { id: string; name: string; areaId: string }[];
  rows: ShareRow[];
  areaNotes?: { areaId: string; note: string; version: string }[];
};
export type ShareCell = { name: string; hours: string; backup: boolean };
export type SharePanel = {
  id: string;
  name: string;
  days: string[];
  outlets: { name: string; cells: ShareCell[][] }[];
  leave: string[][];
  standby: string[][];
  unassigned: string[][];
};
export type ShareWeek = { from: string; to: string; panels: SharePanel[] };
const DAY_MS = 86_400_000;

export function shareWeekStart(date: Date) {
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}

export function isShareArea(area: ShareScheduleData["areas"][number]) {
  return area.active !== false && area.name.trim().toUpperCase() !== "ARSIP HISTORIS";
}

export function resolveShareHomeAreas(data: ShareScheduleData) {
  const areas = new Map(data.areas.filter(isShareArea).map((area) => [area.id, area]));
  const outletAreas = new Map(data.outlets.map((outlet) => [outlet.id, outlet.areaId]));
  const weekAreas = new Map<string, Set<string>>();
  const key = (row: ShareRow) =>
    row.employeeId + ":" + shareWeekStart(new Date(row.date + "T00:00:00Z")).toISOString();

  for (const row of data.rows) {
    const areaId = outletAreas.get(row.outletId || "");
    if (!areaId || !areas.has(areaId) || !isWorkingSchedule(row.status)) continue;
    const week = key(row);
    const candidates = weekAreas.get(week) ?? new Set<string>();
    candidates.add(areaId);
    weekAreas.set(week, candidates);
  }
  return data.rows.map((row) => {
    if (row.homeAreaId) return row;
    const candidates = weekAreas.get(key(row));
    const areaId =
      outletAreas.get(row.outletId || "") ??
      (candidates?.size === 1 ? [...candidates][0] : undefined);
    return areaId
      ? { ...row, homeAreaId: areaId, homeAreaName: areas.get(areaId)?.name ?? null }
      : row;
  });
}

export function shareDayLabel(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(iso + "T00:00:00Z"))
    .replaceAll(",", "");
}
export function shareWeeks(data: ShareScheduleData, scope: string): ShareWeek[] {
  const areas = data.areas.filter(isShareArea),
    outlets = data.outlets;
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  areas.sort((a, b) => collator.compare(a.name, b.name));
  const dates: string[] = [];
  for (
    const d = new Date(data.from + "T00:00:00Z");
    d <= new Date(data.to + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  )
    dates.push(d.toISOString().slice(0, 10));
  const weeks: ShareWeek[] = [];
  for (let offset = 0; offset < dates.length; offset += 7) {
    const days = dates.slice(offset, offset + 7);
    const panels = areas
      .filter((a) => !scope || a.id === scope)
      .map((area) => {
        const entries = data.rows.filter((r) => days.includes(r.date));
        const home = (r: ShareRow) => r.homeAreaId === area.id;
        const names = (status: string) =>
          days.map((date) => [
            ...new Set(
              entries
                .filter((r) => r.date === date && r.status === status && home(r))
                .map((r) => r.name),
            ),
          ]);
        return {
          id: area.id,
          name: area.name,
          days,
          leave: names("LIBUR"),
          standby: names("STANBY"),
          unassigned: days.map((date) =>
            entries
              .filter(
                (r) => r.date === date && isWorkingSchedule(r.status) && !r.outletId && home(r),
              )
              .map((r) => r.name),
          ),
          outlets: outlets
            .filter((o) => o.areaId === area.id)
            .sort((a, b) => collator.compare(a.name, b.name))
            .map((outlet) => ({
              name: outlet.name,
              cells: days.map((date) =>
                entries
                  .filter(
                    (r) =>
                      r.date === date && isWorkingSchedule(r.status) && r.outletId === outlet.id,
                  )
                  .map((r) => ({
                    name: r.name + (r.status === "OPENINGAN" ? " (Openingan)" : ""),
                    hours:
                      r.startMinutes === null || r.endMinutes === null
                        ? "Jam belum diatur"
                        : `${timeLabel(r.startMinutes)} – ${timeLabel(r.endMinutes)}${r.endMinutes <= r.startMinutes ? " (+1 hari)" : ""}`,
                    backup: r.role === "BACKUP",
                  })),
              ),
            })),
        };
      });
    weeks.push({ from: days[0], to: days[days.length - 1], panels });
  }
  return weeks;
}
