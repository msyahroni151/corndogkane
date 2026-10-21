"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestPortalLoan, requestPortalLeave, cancelPortalLeave } from "@/app/portal-actions";
import { reviewPortalRequest } from "@/app/portal-review-actions";
import type { FormState } from "@/lib/form-state";
function PortalForm({
  action,
  children,
  button = "Kirim Pengajuan",
  requestKey,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children: React.ReactNode;
  button?: string;
  requestKey?: string;
}) {
  const [state, submit, pending] = useActionState(action, {}),
    router = useRouter(),
    handled = useRef<FormState | null>(null);
  const [key, setKey] = useState(requestKey || "");
  useEffect(() => {
    if (state.success && handled.current !== state) {
      handled.current = state;
      queueMicrotask(() => setKey(crypto.randomUUID()));
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={submit} onReset={(e) => e.preventDefault()} className="space-y-4">
      <input type="hidden" name="requestKey" value={key} />
      <fieldset key={key} disabled={pending} className="space-y-4">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {state.success}
        </p>
      )}
      <button className="button-primary" disabled={pending}>
        {pending ? "Menyimpan..." : button}
      </button>
    </form>
  );
}
export function PortalLoanForm({ requestKey }: { requestKey: string }) {
  return (
    <PortalForm action={requestPortalLoan} requestKey={requestKey}>
      <label className="field">
        Nominal kasbon (Rp)
        <input
          name="amount"
          type="number"
          min="1000"
          max="1000000000"
          step="1"
          required
          inputMode="numeric"
        />
      </label>
      <label className="field">
        Keperluan / alasan
        <textarea name="reason" minLength={5} maxLength={2000} required rows={3} />
      </label>
      <p className="text-xs text-slate-500">
        Pengajuan belum menambah saldo kasbon sampai disetujui admin. Pencairan dikonfirmasi melalui
        admin keuangan.
      </p>
    </PortalForm>
  );
}
export function PortalLeaveForm({ requestKey, today }: { requestKey: string; today: string }) {
  return (
    <PortalForm action={requestPortalLeave} requestKey={requestKey}>
      <label className="field">
        Jenis pengajuan
        <select name="kind">
          <option value="CUTI">Cuti</option>
          <option value="IZIN">Izin</option>
          <option value="LIBUR">Permintaan libur</option>
          <option value="SAKIT">Sakit</option>
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Dari tanggal
          <input type="date" name="startDate" min={today} defaultValue={today} required />
        </label>
        <label className="field">
          Sampai tanggal
          <input type="date" name="endDate" min={today} defaultValue={today} required />
        </label>
      </div>
      <label className="field">
        Alasan
        <textarea name="reason" minLength={5} maxLength={2000} required rows={3} />
      </label>
      <p className="text-xs text-slate-500">
        Menunggu persetujuan admin. Kuota cuti dan kebijakan potongan mengikuti keputusan
        perusahaan; saldo cuti belum dihitung otomatis.
      </p>
    </PortalForm>
  );
}
export function PortalCancel({ id }: { id: string }) {
  return (
    <PortalForm action={cancelPortalLeave} button="Batalkan">
      <input type="hidden" name="id" value={id} />
    </PortalForm>
  );
}
export function PortalReview({
  id,
  type,
  version,
}: {
  id: string;
  type: string;
  version?: string;
}) {
  return (
    <PortalForm action={reviewPortalRequest} button="Simpan Keputusan">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="version" value={version || ""} />
      <label className="field">
        Keputusan
        <select name="decision" required defaultValue="">
          <option value="" disabled>
            Pilih keputusan...
          </option>
          <option value="APPROVED">Setujui</option>
          <option value="REJECTED">Tolak</option>
        </select>
      </label>
      <label className="field">
        Catatan keputusan
        <textarea name="notes" maxLength={1000} rows={2} placeholder="Wajib diisi bila ditolak" />
      </label>
    </PortalForm>
  );
}
