"use client";
import { OutletSelect, type ScheduleOutletChoice } from "@/components/schedule-outlet-form";
import { LocalInput } from "@/components/local-input";
import { useActionState, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "@/app/attendance-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { attendanceLabels } from "@/lib/attendance";
import type { FormState } from "@/lib/form-state";

export function AttendanceEditOptions({
  attendance,
  schedule,
}: {
  attendance: ReactNode;
  schedule: ReactNode;
}) {
  const [editSchedule, setEditSchedule] = useState(false);
  if (!attendance || !schedule) return attendance || schedule;
  return (
    <>
      <div
        className="flex gap-5 border-b border-slate-200 px-4 sm:px-6"
        role="group"
        aria-label="Pilihan edit"
      >
        <button
          type="button"
          className="border-b-2 border-transparent py-3 text-sm font-medium text-slate-500 hover:text-emerald-900 aria-pressed:border-[#395848] aria-pressed:text-[#254637]"
          aria-pressed={!editSchedule}
          onClick={() => setEditSchedule(false)}
        >
          Edit absensi
        </button>
        <button
          type="button"
          className="border-b-2 border-transparent py-3 text-sm font-medium text-slate-500 hover:text-emerald-900 aria-pressed:border-[#395848] aria-pressed:text-[#254637]"
          aria-pressed={editSchedule}
          onClick={() => setEditSchedule(true)}
        >
          Ubah status jadwal
        </button>
      </div>
      <div hidden={editSchedule}>{attendance}</div>
      <div hidden={!editSchedule}>{schedule}</div>
    </>
  );
}
export function AttendanceForm({
  record,
  warehouse,
  outlets,
  successRoute,
  future = false,
}: {
  record: {
    scheduleId: string;
    scheduleVersion: string;
    outletId: string;
    outletName: string;
    status: string;
    checkIn: string;
    checkOut: string;
    checkInNextDay: boolean;
    checkOutNextDay: boolean;
    notes: string;
    version: string;
  };
  warehouse: boolean;
  outlets: ScheduleOutletChoice[];
  successRoute: string;
  future?: boolean;
}) {
  const [draft, setDraft] = useState({ ...record, status: future ? "OUTLET_ONLY" : record.status });
  const outletOnly = draft.status === "OUTLET_ONLY";
  const router = useRouter(),
    close = useCloseFormDialog();
  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, form) => {
    const result = await saveAttendance(previous, form);
    if (result.success) {
      close?.();
      router.push(successRoute);
    }
    return result;
  }, {});
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      className="panel px-4 pt-5 pb-4 sm:px-6"
      aria-label="Catat absensi"
    >
      <input type="hidden" name="scheduleId" value={record.scheduleId} />
      <input type="hidden" name="version" value={record.version} />
      <input type="hidden" name="scheduleVersion" value={record.scheduleVersion} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {!warehouse && (
          <div className={future ? "sm:col-span-2" : "min-w-0"}>
            <OutletSelect
              outlets={outlets}
              currentId={record.outletId}
              currentName={record.outletName}
              value={draft.outletId}
              required={outletOnly || draft.status === "HADIR"}
              disabled={pending}
              onChange={(outletId) => setDraft((old) => ({ ...old, outletId }))}
            />
            {draft.outletId !== record.outletId && (
              <p className="mt-2 text-xs text-slate-500">
                Perubahan outlet dan tarif harian ikut tersimpan di jadwal.
              </p>
            )}
          </div>
        )}

        {future ? (
          <input type="hidden" name="status" value="OUTLET_ONLY" />
        ) : (
          <label className={warehouse ? "field sm:col-span-2" : "field"}>
            Status kehadiran
            <select
              name="status"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {!warehouse && <option value="OUTLET_ONLY">Hanya ubah outlet</option>}
              {Object.entries(attendanceLabels)
                .filter(([key]) => warehouse || key !== "SETENGAH_HARI")
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
        )}
        {!outletOnly && (
          <>
            <fieldset className="col-span-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 pb-3 sm:px-4">
              <legend className="px-1 text-sm font-medium text-slate-700">Jam kehadiran</legend>
              <div className="mt-1 grid gap-3 sm:grid-cols-2 sm:gap-4">
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
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
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
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <LocalInput
                      type="checkbox"
                      name="checkOutNextDay"
                      checked={draft.checkOutNextDay}
                      onChange={(e) => setDraft({ ...draft, checkOutNextDay: e.target.checked })}
                    />
                    Pulang hari berikutnya
                  </label>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                Check-out boleh dilengkapi setelah check-in.
              </p>
            </fieldset>
            <label className="field sm:col-span-2">
              Catatan
              <textarea
                name="notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                maxLength={2000}
                rows={2}
              />
            </label>
          </>
        )}
      </div>
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : outletOnly ? "Simpan perubahan" : "Simpan absensi"}
        </button>
      </div>
    </form>
  );
}
