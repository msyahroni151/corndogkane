"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateScheduleOutlet } from "@/app/schedule-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
export type ScheduleOutletChoice = { id: string; name: string };
export function OutletSelect({
  outlets,
  value,
  onChange,
  currentId,
  currentName,
  required = true,
  disabled = false,
}: {
  outlets: ScheduleOutletChoice[];
  value: string;
  onChange: (value: string) => void;
  currentId: string;
  currentName: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      Outlet bertugas{required ? " *" : ""}
      <select
        name="outletId"
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Pilih outlet…</option>
        {currentId && !outlets.some((outlet) => outlet.id === currentId) && (
          <option value={currentId}>{currentName || currentId} (tersimpan)</option>
        )}
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ScheduleOutletForm({
  record,
  outlets,
}: {
  record: {
    scheduleId: string;
    scheduleVersion: string;
    name: string;
    date: string;
    outletId: string;
    outletName: string;
  };
  outlets: ScheduleOutletChoice[];
}) {
  const [outletId, setOutletId] = useState(record.outletId),
    close = useCloseFormDialog(),
    router = useRouter();
  const [state, action, pending] = useActionState(updateScheduleOutlet, {});
  useEffect(() => {
    if (state.success) {
      notifySuccess(state.success);
      close?.();
      router.refresh();
    }
  }, [state.success, close, router]);
  return (
    <form
      action={action}
      aria-busy={pending}
      aria-label="Ubah outlet bertugas"
      className="space-y-4 whitespace-normal p-6"
    >
      <input name="scheduleId" type="hidden" value={record.scheduleId} />
      <input name="scheduleVersion" type="hidden" value={record.scheduleVersion} />
      <div>
        <p className="font-semibold">{record.name}</p>
        <p className="mt-1 text-xs text-slate-500">{record.date}</p>
      </div>
      <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
        Outlet saat ini: <strong>{record.outletName || "Belum diatur"}</strong>
      </p>
      <OutletSelect
        outlets={outlets}
        value={outletId}
        onChange={setOutletId}
        currentId={record.outletId}
        currentName={record.outletName}
        disabled={pending}
      />
      <p className="text-xs leading-5 text-slate-500">
        Perubahan berlaku pada jadwal dan rekap absensi tanggal ini. Jam jadwal serta
        check-in/check-out tetap tersimpan. Tarif harian mengikuti outlet baru.
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          className="button-secondary"
          onClick={() => close?.()}
        >
          Batal
        </button>
        <button disabled={pending} className="button-primary">
          {pending ? "Menyimpan…" : "Simpan outlet"}
        </button>
      </div>
    </form>
  );
}
