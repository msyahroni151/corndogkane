"use client";
import { LocalInput } from "@/components/local-input";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { saveAttendance } from "@/app/attendance-actions";
import { createPayroll, decidePayroll, type PayrollFormState } from "@/app/payroll-actions";
import { rupiah } from "@/lib/money";
import type { FormState } from "@/lib/form-state";

type LateDay = NonNullable<PayrollFormState["preview"]>["lateDays"][number];

function PayrollAttendanceCorrection({ day, onSaved }: { day: LateDay; onSaved: () => void }) {
  const [waive, setWaive] = useState(!!day.waiver);
  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, form) => {
    const result = await saveAttendance(previous, form);
    if (result.success) onSaved();
    return result;
  }, {});
  return (
    <form
      action={action}
      aria-busy={pending}
      className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4"
    >
      <input type="hidden" name="scheduleId" value={day.scheduleId} />
      <input type="hidden" name="scheduleVersion" value={day.scheduleVersion} />
      <input type="hidden" name="version" value={day.version} />
      <input type="hidden" name="status" value={day.status} />
      <input type="hidden" name="notes" value={day.notes} />
      <p className="font-medium">
        {day.date} · {day.outlet}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field">
            Check-in
            <LocalInput type="time" name="checkIn" defaultValue={day.checkIn} required />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="checkInNextDay" defaultChecked={day.checkInNextDay} />
            Masuk hari berikutnya
          </label>
        </div>
        <div>
          <label className="field">
            Check-out
            <LocalInput type="time" name="checkOut" defaultValue={day.checkOut} />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="checkOutNextDay" defaultChecked={day.checkOutNextDay} />
            Pulang hari berikutnya
          </label>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={waive}
          onChange={(event) => setWaive(event.target.checked)}
        />
        Bebaskan denda
      </label>
      {waive ? (
        <label className="field">
          Alasan pembebasan denda
          <input
            name="lateFineWaiver"
            defaultValue={day.waiver}
            maxLength={500}
            pattern=".*\S.*"
            required
          />
        </label>
      ) : (
        <input type="hidden" name="lateFineWaiver" value="" />
      )}
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button type="submit" className="button-primary" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan koreksi absensi"}
      </button>
    </form>
  );
}

export function PayrollForm({
  employees = [],
  today,
  id,
}: {
  employees?: { id: string; name: string }[];
  today: string;
  id?: string;
}) {
  const [state, action, pending] = useActionState<PayrollFormState, FormData>(
    id ? decidePayroll : createPayroll,
    {},
  );
  const [employee, setEmployee] = useState("");
  const [startDate, setStartDate] = useState(today.slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(today);
  const [reviewed, setReviewed] = useState("");
  const [editLoans, setEditLoans] = useState(false);
  const [loanValues, setLoanValues] = useState<Record<string, string>>({});
  const [loanDirty, setLoanDirty] = useState(false);
  const [showLate, setShowLate] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const close = useCloseFormDialog();
  const handled = useRef(false);
  const inputKey = JSON.stringify([employee, startDate, endDate]);
  const preview = reviewed === inputKey ? state.preview : undefined;
  const day = preview?.lateDays.find((entry) => entry.scheduleId === selectedDay);
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.push("/payroll?tersimpan=1");
    }
  }, [state.success, pending, close, router]);

  function resetPreview() {
    setReviewed("");
    setEditLoans(false);
    setLoanValues({});
    setLoanDirty(false);
    setShowLate(false);
    setSelectedDay("");
  }

  return (
    <div className="panel p-6">
      <form
        ref={formRef}
        action={action}
        onReset={(event) => event.preventDefault()}
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          if (submitter === previewButton.current) {
            setReviewed(inputKey);
            setLoanDirty(false);
          }
        }}
        aria-busy={pending}
      >
        {id ? (
          <>
            <input type="hidden" name="id" value={id} />
            <p className="mb-4 font-semibold">{id}</p>
            <label className="field">
              Keputusan
              <select name="decision">
                <option value="PAID">Catat sudah dibayar</option>
                <option value="CANCELLED">Batalkan draft</option>
              </select>
            </label>
            <p className="mt-4 text-sm text-slate-500">
              Catat setelah gaji dibayar. Potongan kasbon, pengambilan bonus, dan potongan selisih
              setoran akan masuk ke riwayat.
            </p>
          </>
        ) : (
          <>
            <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
              <label className="field sm:col-span-2">
                Karyawan *
                <select
                  name="employeeId"
                  required
                  value={employee}
                  onChange={(e) => {
                    setEmployee(e.target.value);
                    resetPreview();
                  }}
                >
                  <option value="">Pilih karyawan…</option>
                  {employees.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Periode mulai *
                <LocalInput
                  type="date"
                  name="startDate"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    resetPreview();
                  }}
                  required
                />
              </label>
              <label className="field">
                Periode akhir *
                <LocalInput
                  type="date"
                  name="endDate"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    resetPreview();
                  }}
                  required
                />
              </label>
            </fieldset>
            {preview && (
              <div className="mt-6 space-y-4">
                <input type="hidden" name="previewVersion" value={preview.version} />
                <dl className="grid gap-2 rounded-xl bg-slate-50 p-4 text-sm">
                  {[
                    ["Pendapatan kotor", preview.gross],
                    ["Tambahan backup", preview.backup],
                    ["Upah standby", preview.standby],
                    ["Bonus dalam pendapatan", preview.bonus],
                    ["Potongan kasbon", preview.loans.reduce((sum, loan) => sum + loan.amount, 0)],
                    ["Denda telat", preview.late],
                    ["Selisih setoran disetujui", preview.settlement],
                    ["Gaji bersih", preview.netPay],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt>{label}</dt>
                      <dd className="font-semibold">{rupiah(Number(value))}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  {preview.loans.length > 0 && (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setEditLoans(!editLoans)}
                    >
                      {editLoans ? "Tutup rincian kasbon" : "Edit potongan kasbon"}
                    </button>
                  )}
                  {preview.lateDays.length > 0 && (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setShowLate(!showLate);
                        setSelectedDay("");
                      }}
                    >
                      {showLate
                        ? "Tutup riwayat telat"
                        : preview.canEditAttendance
                          ? "Edit denda telat"
                          : "Lihat riwayat telat"}
                    </button>
                  )}
                </div>
                {editLoans && (
                  <p className="text-sm text-slate-500">
                    Isi 0 untuk menunda potongan kasbon. Klik Hitung ulang setelah mengubah nominal.
                  </p>
                )}
                {preview.loans.map((loan) =>
                  editLoans ? (
                    <label className="field" key={loan.id}>
                      {loan.id} · sisa {rupiah(loan.left)}
                      <input
                        type="number"
                        name={"loan:" + loan.id}
                        min="0"
                        max={loan.left}
                        step="1"
                        required
                        value={loanValues[loan.id] ?? String(loan.amount)}
                        onChange={(event) => {
                          setLoanValues({ ...loanValues, [loan.id]: event.target.value });
                          setLoanDirty(true);
                        }}
                      />
                    </label>
                  ) : (
                    <input
                      key={loan.id}
                      type="hidden"
                      name={"loan:" + loan.id}
                      value={loanValues[loan.id] ?? String(loan.amount)}
                    />
                  ),
                )}
                {showLate && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {[
                            "Tanggal",
                            "Outlet / lokasi",
                            "Jam jadwal",
                            "Check-in / out",
                            "Telat",
                            "Denda",
                            "Aksi",
                          ].map((label) => (
                            <th key={label} className="p-2">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.lateDays.map((entry) => (
                          <tr key={entry.scheduleId} className="border-t border-slate-100">
                            <td className="p-2">{entry.date}</td>
                            <td className="p-2">{entry.outlet}</td>
                            <td className="p-2">
                              {entry.scheduledIn || "—"} / {entry.scheduledOut || "—"}
                            </td>
                            <td className="p-2">
                              {entry.checkIn || "—"}
                              {entry.checkInNextDay && " (+1)"} / {entry.checkOut || "—"}
                              {entry.checkOutNextDay && " (+1)"}
                            </td>
                            <td className="p-2">{entry.minutes} menit</td>
                            <td className="p-2">
                              {rupiah(entry.fine)}
                              {entry.waiver && (
                                <p className="text-xs text-slate-600">{entry.waiver}</p>
                              )}
                            </td>
                            <td className="p-2">
                              {entry.paid
                                ? "Periode dibayar"
                                : preview.canEditAttendance && (
                                    <button
                                      type="button"
                                      className="button-secondary"
                                      disabled={pending}
                                      onClick={() => setSelectedDay(entry.scheduleId)}
                                    >
                                      Edit absensi
                                    </button>
                                  )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {state.error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {id ? (
            <button disabled={pending} className="button-primary">
              {pending ? "Menyimpan…" : "Simpan keputusan"}
            </button>
          ) : (
            <>
              <button
                ref={previewButton}
                name="mode"
                value="preview"
                disabled={pending}
                className={preview ? "button-secondary" : "button-primary"}
              >
                {pending ? "Memproses…" : preview ? "Hitung ulang" : "Hitung payroll"}
              </button>
              {preview && (
                <button
                  name="mode"
                  value="save"
                  disabled={
                    pending ||
                    loanDirty ||
                    !!day ||
                    preview.netPay < 0 ||
                    preview.netPay > 1000000000
                  }
                  className="button-primary"
                >
                  Simpan draft
                </button>
              )}
            </>
          )}
        </div>
      </form>
      {day && (
        <PayrollAttendanceCorrection
          key={day.version}
          day={day}
          onSaved={() => {
            setSelectedDay("");
            formRef.current?.requestSubmit(previewButton.current ?? undefined);
          }}
        />
      )}
    </div>
  );
}
