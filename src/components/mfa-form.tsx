"use client";
import { useActionState } from "react";
import { verifyMfa, enrollOwnMfa } from "@/app/mfa-actions";
export function MfaForm({ enroll = false }: { enroll?: boolean }) {
  const [state, action, pending] = useActionState(enroll ? enrollOwnMfa : verifyMfa, {});
  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4">
      <label className="field">
        {enroll ? "Password akun" : "Kode authenticator atau kode pemulihan"}
        <input
          name={enroll ? "password" : "code"}
          type={enroll ? "password" : "text"}
          autoComplete={enroll ? "current-password" : "one-time-code"}
          required
          maxLength={enroll ? 128 : 80}
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="button-primary">
        {pending ? "Memverifikasi…" : enroll ? "Aktifkan MFA" : "Verifikasi"}
      </button>
    </form>
  );
}
