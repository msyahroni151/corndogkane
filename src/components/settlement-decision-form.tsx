"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
import { decideSettlement } from "@/app/settlement-actions";
import type { FormState } from "@/lib/form-state";
import { rupiah } from "@/lib/money";
export function SettlementDecisionForm({
  operationId,
  version,
  crew,
  outlet,
  cash,
  real,
}: {
  operationId: string;
  version: string;
  crew: string;
  outlet: string;
  cash: number;
  real: number;
}) {
  const [state, action, pending] = useActionState(decideSettlement, {} as FormState),
    [decision, setDecision] = useState("APPROVED"),
    done = useRef(false),
    router = useRouter(),
    close = useCloseFormDialog();
  useEffect(() => {
    if (state.success && !pending && !done.current) {
      done.current = true;
      notifySuccess(state.success);
      close?.();
      router.refresh();
    }
  }, [state, pending, router, close]);
  return (
    <form action={action} aria-busy={pending} className="space-y-4 p-6">
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="version" value={version} />
      <p className="text-sm font-semibold">
        {outlet} · {crew}
      </p>
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
        <dt>CASH seharusnya</dt>
        <dd>{rupiah(cash)}</dd>
        <dt>REAL diterima</dt>
        <dd>{rupiah(real)}</dd>
        <dt>Selisih (REAL − CASH)</dt>
        <dd className={real < cash ? "font-bold text-red-700" : "font-bold text-emerald-700"}>
          {real - cash > 0 ? "+ " : ""}
          {rupiah(real - cash)}
        </dd>
        <dt>Potongan jika disetujui</dt>
        <dd>{rupiah(Math.max(0, cash - real))}</dd>
      </dl>
      <label className="field">
        Keputusan
        <select
          name="decision"
          value={decision}
          disabled={pending}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="APPROVED">Setujui</option>
          <option value="REJECTED">Tolak</option>
        </select>
      </label>
      <label className="field">
        Catatan / alasan penolakan
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          required={decision === "REJECTED"}
          disabled={pending}
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        Persetujuan tidak langsung memotong gaji. Pilih nominal potongan saat membuat payroll. Data
        CASH, REAL, dan crew yang disetujui dikunci untuk menjaga riwayat. Kelebihan setoran tidak
        menjadi potongan atau tambahan gaji.
      </p>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan keputusan"}
        </button>
      </div>
    </form>
  );
}
