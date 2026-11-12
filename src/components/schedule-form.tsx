"use client";
import { ScheduleOutletForm } from "@/components/schedule-outlet-form";
import { LocalInput } from "@/components/local-input";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSchedules, updateSchedule, updateScheduleFromAttendance } from "@/app/schedule-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { isWarehouse, isWorkingSchedule, shiftLabels } from "@/lib/schedules";
import type { FormState } from "@/lib/form-state";

type EmployeeChoice = { id: string; name: string; group: "outlet" | "warehouse"; backup: boolean };
type OutletChoice = { id: string; name: string };
type Edit = {
  id: string;
  version: string;
  hasAttendance: boolean;
  outletName: string;
  date: string;
  name: string;
  role: string;
  status: string;
  shift: string;
  outletId: string;
  startTime: string;
  endTime: string;
  notes: string;
};
type Props = {
  employees?: EmployeeChoice[];
  outlets?: OutletChoice[];
  edit?: Edit;
  successRoute?: string;
  fromAttendance?: boolean;
};
export function ScheduleForm({
  employees = [],
  outlets = [],
  edit,
  successRoute = "/jadwal?tersimpan=1",
  fromAttendance = false,
}: Props) {
  if (edit?.hasAttendance && !isWarehouse(edit.role) && isWorkingSchedule(edit.status))
    return (
      <ScheduleOutletForm
        outlets={outlets}
        record={{
          scheduleId: edit.id,
          scheduleVersion: edit.version,
          name: edit.name,
          date: edit.date,
          outletId: edit.outletId,
          outletName: edit.outletName,
        }}
      />
    );
  return edit ? (
    <DailyScheduleForm
      edit={edit}
      outlets={outlets}
      successRoute={successRoute}
      fromAttendance={fromAttendance}
    />
  ) : (
    <CreateScheduleForm employees={employees} outlets={outlets} successRoute={successRoute} />
  );
}
function useScheduleAction(save: typeof createSchedules, successRoute: string) {
  const router = useRouter(),
    close = useCloseFormDialog(),
    handled = useRef(false);
  const [state, action, pending] = useActionState<FormState, FormData>(save, {});
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.push(successRoute);
    }
  }, [state.success, pending, close, router, successRoute]);
  return { state, action, pending };
}
function CreateScheduleForm({
  employees,
  outlets,
  successRoute,
}: {
  employees: EmployeeChoice[];
  outlets: OutletChoice[];
  successRoute: string;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState({ startDate: "", endDate: "" });
  const [status, setStatus] = useState("KERJA");
  const [holidays, setHolidays] = useState([{ key: 0, date: "", status: "LIBUR" }]);
  const nextHoliday = useRef(1);
  const [backupRows, setBackupRows] = useState([
    { key: 0, outletId: "", date: "", status: "KERJA" },
  ]);
  const nextBackupRow = useRef(1);
  const [regularRows, setRegularRows] = useState([
    { key: 0, outletId: "", startDate: "", endDate: "", status: "KERJA" },
  ]);
  const nextRegularRow = useRef(1);
  const regularStart = regularRows
    .map((r) => r.startDate)
    .filter(Boolean)
    .sort()[0];
  const regularEnd = regularRows
    .map((r) => r.endDate)
    .filter(Boolean)
    .sort()
    .at(-1);

  const employee = employees.find((e) => e.id === employeeId),
    warehouse = employee?.group === "warehouse",
    backup = employee?.backup && !warehouse;
  const { state, action, pending } = useScheduleAction(createSchedules, successRoute);
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      aria-label="Buat jadwal periode"
      className="panel p-6"
    >
      <fieldset disabled={pending} className="space-y-5">
        <input type="hidden" name="standbyMode" value="dates" />
        <label className="field">
          Nama Karyawan *
          <select
            name="employeeId"
            required
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setStatus("KERJA");
              setRegularRows([
                {
                  key: nextRegularRow.current++,
                  outletId: "",
                  startDate: "",
                  endDate: "",
                  status: "KERJA",
                },
              ]);
              setHolidays([{ key: nextHoliday.current++, date: "", status: "LIBUR" }]);
              setBackupRows([
                { key: nextBackupRow.current++, outletId: "", date: "", status: "KERJA" },
              ]);
            }}
          >
            <option value="">Pilih karyawan…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        {backup ? (
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-semibold">Jadwal Crew Backup</legend>
            <input type="hidden" name="scheduleMode" value="backup" />
            {backupRows.map((row, index) => (
              <div key={row.key} className="flex items-end gap-2">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)]">
                  <label className="field">
                    Pilih Outlet {row.status === "STANBY" ? "(opsional)" : "*"}
                    <select
                      name="backupOutletId"
                      aria-label={`Pilih Outlet ${index + 1}`}
                      value={row.outletId}
                      required={row.status !== "STANBY"}
                      onChange={(e) =>
                        setBackupRows((old) =>
                          old.map((r) =>
                            r.key === row.key ? { ...r, outletId: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">Pilih outlet…</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Tanggal Jaga *
                    <LocalInput
                      type="date"
                      name="backupDate"
                      aria-label={`Tanggal Jaga ${index + 1}`}
                      required
                      value={row.date}
                      onChange={(e) =>
                        setBackupRows((old) =>
                          old.map((r) => (r.key === row.key ? { ...r, date: e.target.value } : r)),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Status *
                    <select
                      name="backupStatus"
                      aria-label={`Status Jaga ${index + 1}`}
                      required
                      value={row.status}
                      onChange={(e) =>
                        setBackupRows((old) =>
                          old.map((r) =>
                            r.key === row.key ? { ...r, status: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="KERJA">Kerja</option>
                      <option value="STANBY">Standby</option>
                      <option value="OPENINGAN">Openingan</option>
                    </select>
                  </label>
                </div>
                {backupRows.length > 1 && (
                  <button
                    type="button"
                    className="button-secondary mb-0.5"
                    aria-label={`Hapus jadwal backup ${index + 1}`}
                    onClick={() => setBackupRows((old) => old.filter((r) => r.key !== row.key))}
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              aria-label="Tambah jadwal backup"
              className="flex w-full items-center gap-3 py-2 text-emerald-700 hover:text-emerald-900"
              onClick={() => {
                const key = nextBackupRow.current++;
                setBackupRows((old) => [...old, { key, outletId: "", date: "", status: "KERJA" }]);
              }}
            >
              <span className="h-px flex-1 bg-emerald-100" />
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 text-xl">
                +
              </span>
              <span className="h-px flex-1 bg-emerald-100" />
            </button>
            <p className="text-xs text-slate-500">
              Satu outlet dan satu tanggal per baris. Tambahkan jadwal sesuai kebutuhan; tanggal
              crew yang sama tidak boleh berulang.
            </p>
          </fieldset>
        ) : !warehouse ? (
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-semibold">Jadwal Crew Reguler</legend>
            <input type="hidden" name="scheduleMode" value="regular-periods" />
            {regularRows.map((row, index) => (
              <div key={row.key} className="flex items-end gap-2">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="field min-w-0">
                    Pilih Outlet {row.status === "STANBY" ? "(opsional)" : "*"}
                    <select
                      name="regularOutletId"
                      aria-label={`Pilih Outlet Reguler ${index + 1}`}
                      required={row.status !== "STANBY"}
                      value={row.outletId}
                      onChange={(e) =>
                        setRegularRows((old) =>
                          old.map((r) =>
                            r.key === row.key ? { ...r, outletId: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">Pilih outlet…</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field min-w-0">
                    Tanggal Mulai *
                    <LocalInput
                      type="date"
                      name="regularStartDate"
                      aria-label={`Tanggal Mulai Reguler ${index + 1}`}
                      required
                      value={row.startDate}
                      max={row.endDate || undefined}
                      onChange={(e) =>
                        setRegularRows((old) =>
                          old.map((r) =>
                            r.key === row.key ? { ...r, startDate: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field min-w-0">
                    Tanggal Selesai *
                    <LocalInput
                      type="date"
                      name="regularEndDate"
                      aria-label={`Tanggal Selesai Reguler ${index + 1}`}
                      required
                      value={row.endDate}
                      min={row.startDate || undefined}
                      onChange={(e) =>
                        setRegularRows((old) =>
                          old.map((r) =>
                            r.key === row.key ? { ...r, endDate: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field min-w-0">
                    Status Kerja *
                    <select
                      name="regularStatus"
                      aria-label={`Status Reguler ${index + 1}`}
                      required
                      value={row.status}
                      onChange={(e) =>
                        setRegularRows((old) =>
                          old.map((r) =>
                            r.key === row.key ? { ...r, status: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="KERJA">Kerja</option>
                      <option value="STANBY">Standby</option>
                      <option value="OPENINGAN">Openingan</option>
                    </select>
                  </label>
                </div>
                {regularRows.length > 1 && (
                  <button
                    type="button"
                    className="button-secondary mb-0.5"
                    aria-label={`Hapus periode reguler ${index + 1}`}
                    onClick={() => setRegularRows((old) => old.filter((r) => r.key !== row.key))}
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              aria-label="Tambah periode reguler"
              disabled={regularRows.length >= 31}
              className="flex w-full items-center gap-3 py-2 text-emerald-700 hover:text-emerald-900"
              onClick={() => {
                const key = nextRegularRow.current++;
                setRegularRows((old) => [
                  ...old,
                  { key, outletId: "", startDate: "", endDate: "", status: "KERJA" },
                ]);
              }}
            >
              <span className="h-px flex-1 bg-emerald-100" />
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 text-xl">
                +
              </span>
              <span className="h-px flex-1 bg-emerald-100" />
            </button>
            <p className="text-xs text-slate-500">
              Satu outlet dan satu periode mulai–selesai per baris, maksimal 31 hari per periode.
              Status berlaku sepanjang periode; tanggal libur / standby khusus dapat ditambahkan di
              bawah. Periode tidak boleh bertumpang tindih dan jadwal lama tidak ditimpa.
            </p>
          </fieldset>
        ) : (
          <>
            {warehouse ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="field">
                  Lokasi gudang *
                  <input name="location" required defaultValue="GUDANG" maxLength={100} />
                </label>
                <label className="field">
                  Shift gudang *
                  <select name="shift" required>
                    {Object.entries(shiftLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="field">
                Pilih Outlet *
                <select name="outletId" required defaultValue="">
                  <option value="">Pilih outlet…</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-semibold">Periode jaga</legend>
              <div className="grid gap-5 sm:grid-cols-3">
                <label className="field">
                  Tanggal Mulai *
                  <LocalInput
                    type="date"
                    name="startDate"
                    required
                    value={period.startDate}
                    max={period.endDate || undefined}
                    onChange={(e) => setPeriod((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </label>
                <label className="field">
                  Tanggal Selesai *
                  <LocalInput
                    type="date"
                    name="endDate"
                    required
                    value={period.endDate}
                    min={period.startDate || undefined}
                    onChange={(e) => setPeriod((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </label>
                <label className="field">
                  Status Kerja *
                  <select
                    name="status"
                    value={status}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStatus(value);
                      if (value === "STANBY" && !holidays.some((h) => h.status === "STANBY"))
                        setHolidays((old) => [
                          ...old,
                          { key: nextHoliday.current++, date: "", status: "STANBY" },
                        ]);
                    }}
                  >
                    <option value="KERJA">Kerja</option>
                    <option value="STANBY" disabled={warehouse}>
                      Stanby
                    </option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Maksimal 31 hari per periode. Jadwal yang sudah ada tidak ditimpa.
              </p>
            </fieldset>
          </>
        )}
        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-semibold">Tanggal libur / standby (opsional)</legend>
          {holidays.map((holiday, i) => (
            <div key={holiday.key} className="flex items-end gap-2">
              <label className="field min-w-0 flex-1">
                {holiday.status === "STANBY" ? "Tanggal standby" : "Tanggal libur"} {i + 1}
                <LocalInput
                  type="date"
                  name={holiday.status === "STANBY" ? "standby" : "holiday"}
                  required={holiday.status === "STANBY" && status === "STANBY"}
                  value={holiday.date}
                  min={
                    backup ? undefined : warehouse ? period.startDate || undefined : regularStart
                  }
                  max={backup ? undefined : warehouse ? period.endDate || undefined : regularEnd}
                  onChange={(e) =>
                    setHolidays((old) =>
                      old.map((h) => (h.key === holiday.key ? { ...h, date: e.target.value } : h)),
                    )
                  }
                />
              </label>
              <label className="field min-w-32">
                Status Kerja
                <select
                  aria-label={`Status tanggal ${i + 1}`}
                  value={holiday.status}
                  onChange={(e) =>
                    setHolidays((old) =>
                      old.map((h) =>
                        h.key === holiday.key ? { ...h, status: e.target.value } : h,
                      ),
                    )
                  }
                >
                  <option value="LIBUR">Libur</option>
                  {!warehouse && !backup && <option value="STANBY">Standby</option>}
                </select>
              </label>
              <button
                type="button"
                className="button-secondary mb-0.5"
                aria-label={`Hapus tanggal libur ${i + 1}`}
                onClick={() => setHolidays((old) => old.filter((h) => h.key !== holiday.key))}
              >
                Hapus
              </button>
            </div>
          ))}
          <button
            type="button"
            aria-label="Tambah tanggal libur"
            className="flex w-full items-center gap-3 py-2 text-emerald-700 hover:text-emerald-900"
            onClick={() => {
              const key = nextHoliday.current++;
              setHolidays((old) => [...old, { key, date: "", status: "LIBUR" }]);
            }}
          >
            <span className="h-px flex-1 bg-emerald-100" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 text-xl">
              +
            </span>
            <span className="h-px flex-1 bg-emerald-100" />
          </button>
          <p className="text-xs text-slate-500">
            {backup
              ? "Tambahkan tanggal libur sesuai kebutuhan. Tanggal ini disimpan sebagai LIBUR, termasuk jika sama dengan tanggal jaga."
              : "Tambah tanggal sesuai kebutuhan. Setiap tanggal harus berbeda dan berada dalam periode jaga."}
          </p>
        </fieldset>
        {!warehouse && (
          <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            Jam kerja otomatis mengikuti jam operasional Senin–Minggu di Master Outlet. Hari outlet
            tutup menjadi LIBUR untuk jadwal Kerja.
          </div>
        )}
        {!warehouse && (
          <p className="text-xs text-slate-500">
            Standby boleh tanpa outlet dan dibayar Rp50.000 per hari. Jika jadi bertugas, ubah
            jadwal hari tersebut ke Kerja dan pilih outlet; payroll mengikuti tarif outlet tanpa
            uang standby. Openingan mengikuti jam dan tarif outlet seperti Kerja.
          </p>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button disabled={pending} type="submit" className="button-primary">
          {pending ? "Menyimpan…" : "Buat jadwal"}
        </button>
      </div>
    </form>
  );
}
function DailyScheduleForm({
  edit,
  outlets,
  successRoute,
  fromAttendance,
}: {
  edit: Edit;
  outlets: OutletChoice[];
  successRoute: string;
  fromAttendance: boolean;
}) {
  const [draft, setDraft] = useState({
    status: edit.status,
    shift: edit.shift || "S1",
    outletId: edit.outletId,
    timeMode: edit.startTime && edit.endTime ? "manual" : "outlet",
    startTime: edit.startTime,
    endTime: edit.endTime,
    notes: edit.notes,
  });
  const warehouse = isWarehouse(edit.role);
  const { state, action, pending } = useScheduleAction(
    fromAttendance ? updateScheduleFromAttendance : updateSchedule,
    successRoute,
  );
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      aria-label="Ubah jadwal harian"
      className="panel p-6"
    >
      <input name="id" type="hidden" value={edit.id} />
      <input name="version" type="hidden" value={edit.version} />
      <p className="mb-5 text-sm font-semibold">{edit.name}</p>
      {!warehouse && (
        <p className="mb-5 text-xs text-slate-500">
          Standby: Rp50.000 per hari, outlet opsional. Jika jadi masuk, pilih Kerja dan outlet yang
          dijaga agar payroll memakai tarif outlet tanpa uang standby.
        </p>
      )}
      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <label className="field">
          Status jadwal
          <select
            name="status"
            value={draft.status}
            onChange={(e) => {
              change("status", e.target.value);
              if (!isWorkingSchedule(edit.status) && isWorkingSchedule(e.target.value))
                change("timeMode", "outlet");
            }}
          >
            <option value="KERJA">Kerja</option>
            <option value="LIBUR">Libur</option>
            {!warehouse && (
              <>
                <option value="STANBY">Standby</option>
                <option value="OPENINGAN">Openingan</option>
              </>
            )}
          </select>
        </label>
        {!warehouse && (isWorkingSchedule(draft.status) || draft.status === "STANBY") && (
          <label className="field">
            Outlet kerja {draft.status === "STANBY" ? "(opsional)" : "*"}
            <select
              name="outletId"
              required={draft.status !== "STANBY"}
              value={draft.outletId}
              onChange={(e) => change("outletId", e.target.value)}
            >
              <option value="">Pilih outlet…</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isWorkingSchedule(draft.status) &&
          (warehouse ? (
            <label className="field">
              Shift gudang *
              <select
                name="shift"
                value={draft.shift}
                onChange={(e) => change("shift", e.target.value)}
              >
                {Object.entries(shiftLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="field">
                Acuan jam kerja
                <select
                  name="timeMode"
                  value={draft.timeMode}
                  onChange={(e) => change("timeMode", e.target.value)}
                >
                  <option value="outlet">Otomatis dari Master Outlet per hari</option>
                  <option value="manual">Jam manual / khusus</option>
                </select>
              </label>
              {draft.timeMode === "manual" &&
                (["startTime", "endTime"] as const).map((key, i) => (
                  <label key={key} className="field">
                    {i === 0 ? "Jam masuk *" : "Jam pulang *"}
                    <LocalInput
                      name={key}
                      type="time"
                      required
                      value={draft[key]}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </label>
                ))}
            </>
          ))}
        <label className="field sm:col-span-2">
          Catatan
          <textarea
            name="notes"
            value={draft.notes}
            onChange={(e) => change("notes", e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </label>
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button disabled={pending} type="submit" className="button-primary">
          {pending ? "Menyimpan…" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}
