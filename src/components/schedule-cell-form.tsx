"use client";
import { useActionState, useEffect, useId, useState } from "react";
import { createGridSchedule } from "@/app/schedule-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { EditableCombobox } from "@/components/editable-combobox";
import type { FormState } from "@/lib/form-state";

export function ScheduleCellForm({ date, areaId, outletId = "", status, employees }: {
  date: string; areaId: string; outletId?: string; status: string;
  employees: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createGridSchedule, {});
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const inputId = useId();
  const close = useCloseFormDialog();
  useEffect(() => { if (state.success && !pending) close?.(); }, [state.success, pending, close]);
  return <form action={action} aria-busy={pending} className="space-y-5 p-6">
    <input type="hidden" name="date" value={date} />
    <input type="hidden" name="areaId" value={areaId} />
    <input type="hidden" name="outletId" value={outletId} />
    <input type="hidden" name="status" value={status} />
    <input type="hidden" name="employeeId" value={employeeId} />
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label htmlFor={inputId} className="mb-2 block text-xs font-semibold text-slate-600">Crew bertugas</label>
      <EditableCombobox id={inputId} aria-label="Pilih crew" placeholder="Cari kode nama crew..." required inline
        className="!rounded-lg !border !border-slate-200 !bg-white !px-3 !py-3 !text-sm"
        value={search} disabled={pending}
        options={employees.map((e) => ({ value: e.id, label: e.name }))}
        selectedValue={employeeId}
        onValueChange={(value) => { setSearch(value); setEmployeeId(""); }}
        onOptionSelect={(id) => { setEmployeeId(id); setSearch(employees.find((e) => e.id === id)?.name || ""); }} />
    </div>
    {!employees.length && <p className="text-xs text-amber-700">Semua crew sudah memiliki jadwal pada tanggal ini. Gunakan Edit untuk mengubah jadwal yang ada.</p>}
    {status === "KERJA" && <label className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm"><input type="checkbox" name="opening" disabled={pending} /> Openingan</label>}
    <p className="text-xs leading-5 text-slate-500">Jam dan tarif kerja mengikuti Master Outlet. Crew yang sudah dijadwalkan pada tanggal ini tidak ditampilkan.</p>
    {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    <div className="flex justify-end border-t border-slate-100 pt-4"><button disabled={pending || !employeeId} className="button-primary">{pending ? "Menyimpan..." : "Simpan jadwal"}</button></div>
  </form>;
}
