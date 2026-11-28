"use client";
import Link from "next/link";
import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { ScheduleForm } from "@/components/schedule-form";
import { DeleteScheduleForm } from "@/components/delete-schedule-form";
import { WarehouseCalendarForm } from "@/components/warehouse-calendar-form";
import { displayDate, parseCivilDate } from "@/lib/placements";
import { timeLabel, compareWarehouseSchedules } from "@/lib/schedules";
import "./warehouse-calendar.css";

export type CalendarCrew = { id: string; name: string };
export type CalendarRow = { id: string; employeeId: string; name: string; date: string; status: string; shift: string | null; startMinutes: number | null; endMinutes: number | null; role: string; version: string; hasAttendance: boolean; notes: string; location: string };
export function WarehouseCalendar({ month, crew, rows, placements, route }: { month: string; crew: CalendarCrew[]; rows: CalendarRow[]; placements: { employeeId: string; from: string; to: string; location: string }[]; route: string }) {
  const first = parseCivilDate(month + "-01");
  const end = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [selected, setSelected] = useState(today.startsWith(month) ? today : month + "-01");
  const selectedDate = selected.startsWith(month) ? selected : month + "-01";
  const offset = (first.getUTCDay() + 6) % 7;
  const slots = Array.from({ length: Math.ceil((offset + end.getUTCDate()) / 7) * 7 }, (_, i) => new Date(first.getTime() + (i - offset) * 86400000).toISOString().slice(0, 10));
  const title = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const url = (change: number) => { const d = new Date(first); d.setUTCMonth(d.getUTCMonth() + change); const p = new URLSearchParams(route.split("?")[1]); p.set("month", d.toISOString().slice(0, 7)); ["week", "from", "to", "tersimpan"].forEach(k => p.delete(k)); return "/jadwal?" + p; };
  const daily = (date: string) => rows.filter(r => r.date === date).sort(compareWarehouseSchedules);
  const available = (date: string) => crew.filter(e => !daily(date).some(r => r.employeeId === e.id)).map(e => ({ ...e, location: placements.find(p => p.employeeId === e.id && p.from <= date && p.to >= date)?.location || "GUDANG" }));
  const tone = (r: CalendarRow) => r.status === "LIBUR" ? "leave" : r.shift === "FULL" ? "full" : r.shift === "S2" ? "second" : "first";
  const shift = (r: CalendarRow) => r.status === "LIBUR" ? "Libur" : r.shift === "FULL" ? "Full shift" : r.shift === "S2" ? "Shift 2" : "Shift 1";
  const hours = (r: CalendarRow) => r.status === "LIBUR" ? "Tidak bertugas" : `${timeLabel(r.startMinutes) || "—"} – ${timeLabel(r.endMinutes) || "—"}${r.startMinutes !== null && r.endMinutes !== null && r.endMinutes <= r.startMinutes ? " (+1 hari)" : ""}`;
  function edit(row: CalendarRow, detailed = false) { return <FormDialog key={row.id} title={`Ubah jadwal · ${row.name}`} subtitle={`${displayDate(parseCivilDate(row.date))} · ${row.location || "GUDANG"}`} trigger={detailed ? "Edit" : <><strong className="block">{row.name}</strong><span className="block">{shift(row)}</span><span className="block text-[10px]">{hours(row)}</span></>} triggerClassName={detailed ? "button-secondary" : `warehouse-event ${tone(row)}`}>
    <ScheduleForm successRoute={route} edit={{ id: row.id, employeeId: row.employeeId, name: row.name, date: displayDate(parseCivilDate(row.date)), role: row.role, status: row.status, shift: row.shift || "S1", outletId: "", outletName: "", version: row.version, hasAttendance: row.hasAttendance, startTime: timeLabel(row.startMinutes), endTime: timeLabel(row.endMinutes), notes: row.notes }} />
    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4"><FormDialog title="Hapus jadwal gudang" trigger="Hapus jadwal" compact danger><DeleteScheduleForm id={row.id} version={row.version} name={row.name} date={displayDate(parseCivilDate(row.date))} /></FormDialog></div>
  </FormDialog>; }
  function add(date: string, label = "+ Tambah crew") { return <FormDialog title="Tambah jadwal gudang" subtitle={displayDate(parseCivilDate(date))} trigger={label} compact triggerClassName="warehouse-add"><WarehouseCalendarForm date={date} employees={available(date)} /></FormDialog>; }
  return <section className="panel warehouse-calendar" aria-label="Kalender crew gudang">
    <header className="warehouse-calendar-header"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Crew Gudang</p><h2 className="mt-1 text-xl font-bold capitalize">{title}</h2><p className="mt-1 text-xs text-slate-500">Pilih tanggal untuk melihat dan mengatur crew yang bertugas.</p></div><nav className="flex gap-2" aria-label="Navigasi bulan"><Link className="button-secondary" href={url(-1)} scroll={false} aria-label="Bulan sebelumnya">‹</Link><Link className="button-secondary" href={url(1)} scroll={false} aria-label="Bulan berikutnya">›</Link></nav></header>
    <div className="warehouse-legend">{[["first", "Shift 1 · 08:00–17:00"], ["second", "Shift 2 · 15:00–23:59"], ["full", "Full · 08:00–23:59"], ["leave", "Libur"]].map(([c, label]) => <span key={c}><i className={c} />{label}</span>)}<span className="text-slate-400">WIB</span></div>
    <div className="warehouse-weekdays" aria-hidden="true">{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(d => <span key={d}>{d}</span>)}</div>
    <div className="warehouse-days">{slots.map(date => { const inMonth = date.startsWith(month), entries = daily(date), working = entries.filter(r => r.status !== "LIBUR").length; return <div key={date} className={`warehouse-day ${inMonth ? "" : "outside"} ${date === selectedDate ? "selected" : ""} ${date === today ? "today" : ""}`}>
      <button type="button" disabled={!inMonth} className="warehouse-date" aria-label={`${displayDate(parseCivilDate(date))}, ${working} crew masuk`} aria-pressed={date === selectedDate} onClick={() => setSelected(date)}><span>{Number(date.slice(-2))}</span><small>{inMonth && working ? `${working} masuk` : ""}</small></button>
      {inMonth && <><div className="warehouse-desktop-events">{entries.map(r => edit(r))}{add(date)}</div><button type="button" className="warehouse-mobile-events" aria-label={`Lihat jadwal ${displayDate(parseCivilDate(date))}`} onClick={() => setSelected(date)}>{entries.slice(0, 3).map(r => <span key={r.id} className={tone(r)}>{r.name}</span>)}{entries.length > 3 && <small>+{entries.length - 3}</small>}</button></>}
    </div>; })}</div>
    <section className="warehouse-agenda" aria-label="Rincian tanggal terpilih"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(parseCivilDate(selectedDate))}</h3><p className="mt-1 text-xs text-slate-500">{daily(selectedDate).filter(r => r.status !== "LIBUR").length} crew masuk · {daily(selectedDate).filter(r => r.status === "LIBUR").length} libur</p></div>{add(selectedDate)}</div>
      <div className="mt-4 space-y-2">{daily(selectedDate).length ? daily(selectedDate).map(r => <article key={r.id} className={`warehouse-agenda-row ${tone(r)}`}><div className="min-w-0"><p className="font-bold break-words">{r.name}</p><p className="mt-1 text-sm">{shift(r)} · {hours(r)}</p><p className="mt-1 text-xs text-slate-500">{r.location || "GUDANG"}</p></div>{edit(r, true)}</article>) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Belum ada jadwal pada tanggal ini. Pilih Tambah crew untuk mulai mengisi.</p>}</div>
    </section>
  </section>;
}
