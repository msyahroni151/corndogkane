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
  areas: { id: string; name: string }[];
  outlets: { id: string; name: string; areaId: string }[];
  rows: ShareRow[];
};
export type ShareCell = { name: string; hours: string; backup: boolean };
export type SharePanel = {
  name: string;
  days: string[];
  outlets: { name: string; cells: ShareCell[][] }[];
  leave: string[][];
  standby: string[][];
  unassigned: string[][];
};
export type ShareWeek = { from: string; to: string; panels: SharePanel[] };
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
  const areas = [...data.areas],
    outlets = [...data.outlets];
  // Preserve orphaned historical assignments instead of silently omitting them.
  for (const row of data.rows) {
    if (row.homeAreaId && !areas.some((a) => a.id === row.homeAreaId))
      areas.push({ id: row.homeAreaId, name: row.homeAreaName || "Area sebelumnya" });
    if (row.status === "KERJA" && row.outletId && !outlets.some((o) => o.id === row.outletId))
      outlets.push({
        id: row.outletId,
        name: row.outletName || "Outlet sebelumnya",
        areaId: row.homeAreaId || "unassigned",
      });
  }
  if (
    outlets.some((o) => o.areaId === "unassigned") ||
    data.rows.some((r) => !r.homeAreaId && !r.outletId)
  )
    areas.push({ id: "unassigned", name: "Belum ada area" });
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
        const home = (r: ShareRow) => (r.homeAreaId || "unassigned") === area.id;
        const names = (status: string) =>
          days.map((date) => [
            ...new Set(
              entries
                .filter((r) => r.date === date && r.status === status && home(r))
                .map((r) => r.name),
            ),
          ]);
        return {
          name: area.name,
          days,
          leave: names("LIBUR"),
          standby: names("STANBY"),
          unassigned: days.map((date) =>
            entries
              .filter((r) => r.date === date && r.status === "KERJA" && !r.outletId && home(r))
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
                    (r) => r.date === date && r.status === "KERJA" && r.outletId === outlet.id,
                  )
                  .map((r) => ({
                    name: r.name,
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
