"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSchedules } from "@/app/schedule-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { EditableCombobox } from "@/components/editable-combobox";
import { shiftLabels } from "@/lib/schedules";
import type { FormState } from "@/lib/form-state";

export function WarehouseCalendarForm({ date, employees }: { date: string; employees: { id: string; name: string; location: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSchedules, {});
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("KERJA");
  const close = useCloseFormDialog(), router = useRouter();
  useEffect(() => { if (state.success && !pending) { close?.(); router.refresh(); } }, [state.success, pending, close, router]);
  return <form action={action} aria-busy={pending} className="space-y-5 p-5 sm:p-6">
    <input type="hidden" name="startDate" value={date} /><input type="hidden" name="endDate" value={date} />
    <input type="hidden" name="employeeId" value={employeeId} /><input type="hidden" name="status" value="KERJA" />
    <input type="hidden" name="location" value={employees.find(e => e.id === employeeId)?.location || "GUDANG"} />
    {status === "LIBUR" && <input type="hidden" name="holiday" value={date} />}
    <div><label htmlFor="warehouse-crew-choice" className="mb-2 block text-sm font-semibold">Crew gudang</label>
      <EditableCombobox id="warehouse-crew-choice" aria-label="Crew gudang" placeholder="Cari kode nama crew…" required inline
        value={search} selectedValue={employeeId} options={employees.map(e => ({ value: e.id, label: e.name }))}
        className="!rounded-xl !border !border-slate-200 !bg-white !px-3 !py-3"
        onValueChange={v => { setSearch(v); setEmployeeId(""); }} onOptionSelect={id => { setEmployeeId(id); setSearch(employees.find(e => e.id === id)?.name || ""); }} disabled={pending} />
    </div>
    <label className="field">Status jadwal<select value={status} onChange={e => setStatus(e.target.value)} disabled={pending}><option value="KERJA">Kerja</option><option value="LIBUR">Libur</option></select></label>
    <label className={`field ${status === "LIBUR" ? "hidden" : ""}`}>Shift dan jam kerja<select name="shift" defaultValue="S1" disabled={pending}>{Object.entries(shiftLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
    <p className="text-xs leading-5 text-slate-500">Jam dalam WIB. Shift 2 dan Full Shift selesai pukul 23:59 pada tanggal yang sama. Crew yang sudah memiliki jadwal tidak ditampilkan.</p>
    {!employees.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Tidak ada crew gudang yang tersedia. Klik jadwal yang sudah ada untuk mengeditnya.</p>}
    {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    <div className="flex justify-end border-t border-slate-100 pt-4"><button className="button-primary" disabled={pending || !employeeId}>{pending ? "Menyimpan…" : "Simpan jadwal"}</button></div>
  </form>;
}
