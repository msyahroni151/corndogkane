"use client";
import { LocalInput } from "@/components/local-input";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "@/app/attendance-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { attendanceLabels } from "@/lib/attendance";
import type { FormState } from "@/lib/form-state";
export function AttendanceForm({
  record,
  warehouse,
  successRoute,
}: {
  record: {
    scheduleId: string;
    name: string;
    date: string;
    status: string;
    checkIn: string;
    checkOut: string;
    checkInNextDay: boolean;
    checkOutNextDay: boolean;
    notes: string;
    version: string;
  };
  warehouse: boolean;
  successRoute: string;
}) {
  const [draft, setDraft] = useState(record);
  const router = useRouter(),
    close = useCloseFormDialog();
  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, form) => {
    const result = await saveAttendance(previous, form);
    if (result.success) {
      close?.();
      router.push(successRoute);
      router.refresh();
    }
    return result;
  }, {});
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      className="panel p-6"
      aria-label="Catat absensi"
    >
      <input type="hidden" name="scheduleId" value={record.scheduleId} />
      <input type="hidden" name="version" value={record.version} />
      <p className="font-semibold">{record.name}</p>
      <p className="mt-1 text-xs text-slate-500">{record.date}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Status kehadiran
          <select
            name="status"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            {Object.entries(attendanceLabels)
              .filter(([key]) => warehouse || key !== "SETENGAH_HARI")
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <div>
          <label className="field">
            Check-in
            <LocalInput
              type="time"
              name="checkIn"
              value={draft.checkIn}
              onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <LocalInput
              type="checkbox"
              name="checkInNextDay"
              checked={draft.checkInNextDay}
              onChange={(e) => setDraft({ ...draft, checkInNextDay: e.target.checked })}
            />
            Masuk hari berikutnya
          </label>
        </div>
        <div>
          <label className="field">
            Check-out
            <LocalInput
              type="time"
              name="checkOut"
              value={draft.checkOut}
              onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <LocalInput
              type="checkbox"
              name="checkOutNextDay"
              checked={draft.checkOutNextDay}
              onChange={(e) => setDraft({ ...draft, checkOutNextDay: e.target.checked })}
            />
            Pulang hari berikutnya
          </label>
        </div>
        <label className="field sm:col-span-2">
          Catatan
          <textarea
            name="notes"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            maxLength={2000}
            rows={3}
          />
        </label>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Check-in saja sudah dihitung sebagai hari dibayar; check-out dapat dilengkapi kemudian.
        Izin, sakit, dan alpa tidak memiliki jam kehadiran.
      </p>
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan absensi"}
        </button>
      </div>
    </form>
  );
}
