"use client";
import { useActionState } from "react";
import { saveSecurityRetention } from "@/app/security-actions";
export function SecurityRetentionForm({ days }: { days: number }) {
  const [state, action, pending] = useActionState(saveSecurityRetention, {});
  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-3">
      <label className="field">
        Tinjau foto absensi setelah (hari)
        <input type="number" name="days" min={30} max={3650} defaultValue={days} required />
      </label>
      <p className="text-xs text-slate-500">
        Foto tetap disimpan dan dienkripsi. Batas ini menandai foto yang perlu ditinjau; penghapusan
        otomatis tidak diaktifkan.
      </p>
      {state.error && (
        <p role="alert" className="text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-green-700">
          {state.success}
        </p>
      )}
      <button disabled={pending} className="button-primary">
        Simpan pengaturan
      </button>
    </form>
  );
}
