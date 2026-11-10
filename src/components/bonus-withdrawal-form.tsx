"use client";
import { useActionState, useState } from "react";
import { LocalInput } from "@/components/local-input";
import { withdrawBonus } from "@/app/bonus-withdrawal-actions";
import type { FormState } from "@/lib/form-state";
import { rupiah } from "@/lib/money";
export function BonusWithdrawalForm({
  employees,
  today,
}: {
  employees: {
    id: string;
    fullName: string;
    employeeCode: string | null;
    active: boolean;
    left: number;
  }[];
  today: string;
}) {
  const [requestId] = useState(() => crypto.randomUUID()),
    [employeeId, setEmployeeId] = useState(""),
    [amount, setAmount] = useState("");
  const [state, action, pending] = useActionState(withdrawBonus, {} as FormState);
  const employee = employees.find((candidate) => candidate.id === employeeId);
  return (
    <form action={action} aria-busy={pending} className="space-y-4 p-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="amount" value={amount} />
      <label className="field">
        Karyawan
        <select
          name="employeeId"
          value={employeeId}
          onChange={(event) => {
            setEmployeeId(event.target.value);
            setAmount("");
          }}
          required
          disabled={pending}
        >
          <option value="">Pilih karyawan…</option>
          {employees.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.fullName}
              {candidate.employeeCode && candidate.employeeCode !== candidate.fullName
                ? ` - ${candidate.employeeCode}`
                : ""}
              {!candidate.active ? " (tidak aktif)" : ""}
            </option>
          ))}
        </select>
      </label>
      {employee && (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm">
          Sisa bonus: <strong>{rupiah(employee.left)}</strong>
        </p>
      )}
      <label className="field">
        Tanggal pencairan
        <LocalInput
          type="date"
          name="date"
          defaultValue={today}
          max={today}
          required
          disabled={pending}
        />
      </label>
      <label className="field">
        Nominal pencairan (Rp)
        <input
          type="text"
          inputMode="numeric"
          aria-label="Nominal pencairan (Rp)"
          value={amount.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
          onChange={(e) =>
            setAmount(e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""))
          }
          maxLength={13}
          required
          disabled={pending}
          placeholder="0"
        />
      </label>
      <label className="field">
        Keterangan (opsional)
        <textarea name="notes" maxLength={1000} rows={3} disabled={pending} />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        Catat pencairan bonus yang sudah dilakukan. Nominal akan mengurangi saldo dan tersimpan di
        Riwayat. Slip langsung terbuka setelah pencairan disimpan.
      </p>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          className="button-primary"
          disabled={
            pending || !employee || !amount || Number(amount) < 1 || Number(amount) > employee.left
          }
        >
          {pending ? "Menyimpan…" : "Simpan dan buka slip"}
        </button>
      </div>
    </form>
  );
}
