import Link from "next/link";
import "./schedule-entry-grid.css";
import { getPrisma } from "@/lib/db";
import { displayDate, employeeGroup, parseCivilDate } from "@/lib/placements";
import { leaderHomeAreaName } from "@/lib/leader-home-area";
import { isShareArea, shareDayLabel, shareWeekStart } from "@/lib/share-schedule";
import { timeLabel, isWorkingSchedule } from "@/lib/schedules";
import { FormDialog } from "@/components/form-dialog";
import { ScheduleCellForm } from "@/components/schedule-cell-form";
import { ScheduleForm } from "@/components/schedule-form";
import { ScheduleAreaNote } from "@/components/schedule-area-note";
import { DeleteScheduleForm } from "@/components/delete-schedule-form";

export async function ScheduleEntryGrid({ start, area, employee, route }: {
  start: string; area?: string; employee?: string; route: string;
}) {
  let first: Date;
  try { first = shareWeekStart(parseCivilDate(start)); }
  catch { return <p role="alert" className="panel p-5 text-red-700">Tanggal minggu tidak valid.</p>; }
  const days = Array.from({ length: 7 }, (_, i) => new Date(first.getTime() + i * 86400000).toISOString().slice(0, 10));
  const last = parseCivilDate(days[6]);
  const db = getPrisma();
  const [allAreas, outlets, crew, rows, placements, areaNotes] = await Promise.all([
    db.area.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.outlet.findMany({ where: { active: true, closed: false, area: { active: true } }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { active: true }, orderBy: { employeeCode: "asc" } }),
    db.schedule.findMany({ where: { date: { gte: first, lte: last } }, include: { placement: true, employee: { select: { employeeCode: true } }, attendance: { select: { id: true } } }, orderBy: { employeeName: "asc" } }),
    db.placement.findMany({ where: { startDate: { lte: last }, endDate: { gte: first } }, select: { employeeId: true, areaId: true, startDate: true, endDate: true } }),
    db.scheduleAreaNote.findMany({ where: { startDate: first, endDate: last }, select: { areaId: true, note: true, updatedAt: true } }),
  ]);
  const areas = allAreas.filter(isShareArea).filter((a) => !area || a.id === area);
  const url = (offset: number) => {
    const params = new URLSearchParams(route.split("?")[1]);
    params.delete("tersimpan");
    params.set("week", new Date(first.getTime() + offset * 86400000).toISOString().slice(0, 10));
    return "/jadwal?" + params;
  };
  const available = (date: string, areaId: string, status: string, ignoreEmployeeFilter = false) => {
    const occupied = new Set(rows.filter((r) => r.date.toISOString().slice(0, 10) === date).map((r) => r.employeeId));
    return crew.filter((e) => {
      if (employeeGroup(e) !== "outlet" || occupied.has(e.id) || (!ignoreEmployeeFilter && employee && e.id !== employee)) return false;
      if (status === "KERJA") return true;
      const leader = leaderHomeAreaName(e.employeeCode);
      const placement = placements.find((p) => p.employeeId === e.id && p.startDate <= parseCivilDate(date) && p.endDate >= parseCivilDate(date));
      const homeId = leader ? allAreas.find((a) => a.name.trim().toUpperCase() === leader)?.id : placement?.areaId;
      return !homeId || homeId === areaId;
    })
      .map((e) => ({ id: e.id, name: e.employeeCode?.trim() || e.fullName })).sort((a, b) => a.name.localeCompare(b.name, "id"));
  };
  function cell(areaId: string, date: string, status: string, outletId = "") {
    const entries = rows.filter((r) => {
      if (r.date.toISOString().slice(0, 10) !== date || (employee && r.employeeId !== employee) || !["REGULER", "BACKUP"].includes(r.role)) return false;
      if (status === "KERJA") return isWorkingSchedule(r.status) && r.outletId === outletId;
      const home = leaderHomeAreaName(r.employee.employeeCode);
      const homeId = home ? allAreas.find((a) => a.name.trim().toUpperCase() === home)?.id : r.placement.areaId || allAreas.find((a) => a.name === r.areaName)?.id;
      return r.status === status && homeId === areaId;
    });
    return <td key={date} className="border border-slate-200 p-1.5 align-top">
      <div className="flex min-h-12 min-w-0 flex-col gap-1.5">
        {entries.map((r) => <FormDialog key={r.id} trigger={r.employee.employeeCode || r.employeeName} title={`Ubah jadwal · ${displayDate(r.date)}`} subtitle={r.outletName || r.areaName || ""}
          triggerClassName={`schedule-crew-label w-full min-w-0 max-w-full whitespace-normal rounded-lg px-1 py-1.5 text-[10px] font-semibold [overflow-wrap:anywhere] hover:ring-1 hover:ring-emerald-500 ${r.role === "BACKUP" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          <ScheduleForm successRoute={route} crewChoices={[{ id: r.employeeId, name: r.employee.employeeCode || r.employeeName }, ...available(date, areaId, "KERJA", true)]}
            outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
            edit={{ id: r.id, employeeId: r.employeeId, areaId, version: r.updatedAt.toISOString(), hasAttendance: !!r.attendance, outletName: r.outletName || "", date: displayDate(r.date), name: r.employeeName, role: r.role, status: r.status, shift: r.shift || "S1", outletId: r.outletId || "", startTime: timeLabel(r.startMinutes), endTime: timeLabel(r.endMinutes), notes: r.notes || "" }} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <p className="text-xs text-slate-500">Hapus penugasan jika jadwal ini tidak digunakan.</p>
            <FormDialog title="Hapus jadwal" trigger="Hapus jadwal" compact danger>
              <DeleteScheduleForm id={r.id} version={r.updatedAt.toISOString()} name={r.employeeName} date={displayDate(r.date)} />
            </FormDialog>
          </div>
        </FormDialog>)}
        {entries.some((r) => r.status === "OPENINGAN") && <span className="text-center text-[10px] text-emerald-700">Openingan</span>}
        <FormDialog compact trigger="+" title={status === "KERJA" ? "Tambah crew jaga" : status === "LIBUR" ? "Tambah crew libur" : "Tambah crew standby"}
          subtitle={`${displayDate(parseCivilDate(date))} · ${outlets.find((o) => o.id === outletId)?.name || allAreas.find((a) => a.id === areaId)?.name}`}
          triggerClassName="mt-auto w-full rounded-lg border border-dashed border-slate-300 py-0.5 text-base text-slate-400 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700">
          <ScheduleCellForm date={date} status={status} areaId={areaId} outletId={outletId} employees={available(date, areaId, status)} />
        </FormDialog>
      </div>
    </td>;
  }
  return <div className="space-y-4">
    <section className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div><h2 className="text-sm font-semibold">Pengisian jadwal per area</h2><p className="mt-1 text-xs text-slate-500">Klik + untuk menambah crew, atau klik nama untuk mengedit.</p></div>
      <div className="flex items-center gap-3"><Link className="button-secondary" href={url(-7)} scroll={false} aria-label="Minggu sebelumnya">‹</Link><span className="text-xs font-semibold">{displayDate(first)} – {displayDate(last)}</span><Link className="button-secondary" href={url(7)} scroll={false} aria-label="Minggu berikutnya">›</Link></div>
    </section>
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
    {areas.map((a) => <section key={a.id} className="panel min-w-0 overflow-hidden">
      <h3 className="bg-[#3e5e4d] px-4 py-3 text-sm font-bold text-white">{a.name}</h3>
      <div className="overflow-x-auto"><table className="schedule-entry-table w-full min-w-[460px] table-fixed border-collapse text-[10px]">
        <thead><tr className="bg-[#e8f0e3]"><th className="w-24 border border-slate-200 px-2 py-2.5 text-left">Outlet / Status</th>{days.map((d) => <th key={d} className="border border-slate-200 px-1 py-2.5"><span className="block font-normal">{shareDayLabel(d).split(" ")[0]}</span><span className="mt-0.5 block">{shareDayLabel(d).split(" ").slice(1).join(" ")}</span></th>)}</tr></thead>
        <tbody>{outlets.filter((o) => o.areaId === a.id).map((o) => <tr key={o.id}><th className="border border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold leading-4">{o.name}</th>{days.map((d) => cell(a.id, d, "KERJA", o.id))}</tr>)}
          <tr className="bg-rose-50/30"><th className="border border-slate-200 px-2 py-2 text-left text-rose-700">Crew Libur</th>{days.map((d) => cell(a.id, d, "LIBUR"))}</tr>
          <tr className="bg-amber-50/30"><th className="border border-slate-200 px-2 py-2 text-left text-amber-800">Crew Standby</th>{days.map((d) => cell(a.id, d, "STANBY"))}</tr>
        </tbody>
        <tfoot><tr className="bg-slate-50/60">
          <th scope="row" className="border border-slate-200 px-2 py-3 text-left align-top font-semibold">Catatan</th>
          <td colSpan={7} className="border border-slate-200 p-3">
            <ScheduleAreaNote key={`${a.id}:${days[0]}:${days[6]}`} areaId={a.id} areaName={a.name} from={days[0]} to={days[6]}
              initialNote={areaNotes.find((note) => note.areaId === a.id)?.note}
              initialVersion={areaNotes.find((note) => note.areaId === a.id)?.updatedAt.toISOString()} />
          </td>
        </tr></tfoot>
      </table></div>
    </section>)}
    </div>
    {!areas.length && <p className="panel p-6 text-sm text-slate-500">Tidak ada area aktif untuk ditampilkan.</p>}
  </div>;
}
