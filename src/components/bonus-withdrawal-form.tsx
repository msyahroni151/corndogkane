"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocalInput } from "@/components/local-input";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
import { withdrawBonus } from "@/app/bonus-withdrawal-actions";
import type { FormState } from "@/lib/form-state";
import { rupiah } from "@/lib/money";
export function BonusWithdrawalForm({
  employeeId,
  name,
  balance,
  today,
}: {
  employeeId: string;
  name: string;
  balance: number;
  today: string;
}) {
  const [requestId] = useState(() => crypto.randomUUID()),
    [amount, setAmount] = useState("");
  const [state, action, pending] = useActionState(withdrawBonus, {} as FormState),
    handled = useRef(false),
    router = useRouter(),
    close = useCloseFormDialog();
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      notifySuccess(state.success);
      close?.();
      router.refresh();
    }
  }, [state, pending, router, close]);
  return (
    <form action={action} aria-busy={pending} className="space-y-4 p-6">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="amount" value={amount} />
      <p className="text-sm font-semibold">{name}</p>
      <p className="rounded-xl bg-emerald-50 p-4 text-sm">
        Sisa bonus: <strong>{rupiah(balance)}</strong>
      </p>
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
        Riwayat.
      </p>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          className="button-primary"
          disabled={pending || !amount || Number(amount) < 1 || Number(amount) > balance}
        >
          {pending ? "Menyimpan…" : "Simpan pencairan"}
        </button>
      </div>
    </form>
  );
}
