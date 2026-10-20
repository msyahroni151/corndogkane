"use client";
import { notifySuccess } from "@/components/notification-toasts";
import { LocalInput } from "@/components/local-input";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { createMoneyEntry, decideMoneyEntry } from "@/app/money-actions";
import { moneyLabels, rupiah } from "@/lib/money";
import type { FormState } from "@/lib/form-state";
export function MoneyForm({
  mode,
  employees = [],
  loans = [],
  today,
  decisionId,
  decisionAmount,
  decisionEmployeeId,
  decisionEmployeeName,
}: {
  mode: "kasbon" | "bonus";
  employees?: { id: string; name: string }[];
  loans?: { id: string; employeeId: string; label: string }[];
  today: string;
  decisionId?: string;
  decisionAmount?: number;
  decisionEmployeeId?: string;
  decisionEmployeeName?: string;
}) {
  const [draft, setDraft] = useState({
    employeeId: "",
    kind: mode === "kasbon" ? "LOAN" : "BONUS_EARNED",
    date: today,
    amount: "",
    notes: "",
    sourceId: "",
    decision: "APPROVED",
    decisionNotes: "",
  });
  const [state, action, pending] = useActionState<FormState, FormData>(
    decisionId ? decideMoneyEntry : createMoneyEntry,
    {},
  );
  const close = useCloseFormDialog(),
    router = useRouter(),
    handled = useRef(false);
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      if (mode === "bonus") {
        notifySuccess(state.success);
        router.push("/bonus?view=history");
        router.refresh();
      } else router.push(`/${mode}?tersimpan=1`);
    }
  }, [state.success, pending, close, router, mode]);
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((old) => ({
      ...old,
      [key]: value,
      ...(key === "employeeId" ? { sourceId: "" } : {}),
    }));
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      className="panel p-6"
      aria-label={decisionId ? "Persetujuan catatan" : "Tambah catatan"}
    >
      {decisionId ? (
        <>
          <input type="hidden" name="id" value={decisionId} />
          <input type="hidden" name="decisionAmount" value={decisionAmount ?? ""} />
          <input type="hidden" name="decisionEmployeeId" value={decisionEmployeeId ?? ""} />
          {decisionAmount != null && (
            <p className="mb-3 text-sm font-semibold">
              {decisionEmployeeName} · {rupiah(decisionAmount)}
            </p>
          )}
          <p className="mb-5 text-sm font-semibold">{decisionId}</p>
          <label className="field">
            Keputusan
            <select
              name="decision"
              value={draft.decision}
              onChange={(e) => change("decision", e.target.value)}
            >
              <option value="APPROVED">Setujui</option>
              <option value="REJECTED">Tolak</option>
            </select>
          </label>
          <label className="field mt-5">
            Catatan persetujuan / alasan penolakan
            <textarea
              name="decisionNotes"
              value={draft.decisionNotes}
              onChange={(e) => change("decisionNotes", e.target.value)}
              maxLength={2000}
              required={draft.decision === "REJECTED"}
            />
          </label>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Catatan yang disetujui langsung memengaruhi saldo. Catatan yang sudah diproses tetap
            disimpan sebagai riwayat.
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field">
              Karyawan *
              <select
                name="employeeId"
                required
                value={draft.employeeId}
                onChange={(e) => change("employeeId", e.target.value)}
              >
                <option value="">Pilih karyawan…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Jenis *
              <select
                name="kind"
                value={draft.kind}
                onChange={(e) => change("kind", e.target.value)}
              >
                {Object.entries(moneyLabels)
                  .filter(([k]) =>
                    mode === "kasbon"
                      ? ["LOAN", "REPAYMENT"].includes(k)
                      : ["BONUS_EARNED", "BONUS_WITHDRAWAL"].includes(k),
                  )
                  .map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Tanggal *
              <LocalInput
                name="date"
                type="date"
                value={draft.date}
                onChange={(e) => change("date", e.target.value)}
                required
              />
            </label>
            <label className="field">
              Nominal (Rp) *
              <LocalInput
                name="amount"
                type="number"
                min={1}
                max={1000000000}
                step={1}
                value={draft.amount}
                onChange={(e) => change("amount", e.target.value)}
                required
              />
            </label>
            {draft.kind === "REPAYMENT" && (
              <label className="field sm:col-span-2">
                ID kasbon yang dibayar *
                <select
                  name="sourceId"
                  value={draft.sourceId}
                  onChange={(e) => change("sourceId", e.target.value)}
                  required
                >
                  <option value="">Pilih kasbon…</option>
                  {loans
                    .filter((l) => l.employeeId === draft.employeeId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="field sm:col-span-2">
              Keterangan *
              <textarea
                name="notes"
                value={draft.notes}
                onChange={(e) => change("notes", e.target.value)}
                required
                maxLength={2000}
                rows={3}
              />
            </label>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            ID dibuat otomatis. Saldo berubah setelah catatan disetujui.
          </p>
        </>
      )}
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={pending} className="button-primary">
          {pending ? "Menyimpan…" : decisionId ? "Simpan keputusan" : "Simpan catatan"}
        </button>
      </div>
    </form>
  );
}
