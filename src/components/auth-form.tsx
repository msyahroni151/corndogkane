"use client";
import { PasswordInput } from "@/components/password-input";
import {
  passwordHint,
  passwordMinLength,
  passwordMaxLength,
  passwordPattern,
} from "@/lib/password-policy";
import { useActionState, useState } from "react";
import { login, setupAdmin } from "@/app/auth-actions";
import type { FormState } from "@/lib/form-state";
export function AuthForm({ setup = false }: { setup?: boolean }) {
  const [email, setEmail] = useState(setup ? "corndogkane.management@gmail.com" : "");
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    setup ? setupAdmin : login,
    {},
  );
  return (
    <form onReset={(event) => event.preventDefault()} action={action} className="space-y-5">
      {setup && (
        <label className="field">
          Nama administrator
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            maxLength={100}
          />
        </label>
      )}
      <label className="field">
        Email
        <input
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label className="field">
        Password
        <PasswordInput
          name="password"
          aria-label="Password"
          autoComplete={setup ? "new-password" : "current-password"}
          required
          minLength={setup ? passwordMinLength : undefined}
          pattern={setup ? passwordPattern : undefined}
          title={setup ? passwordHint : undefined}
          maxLength={passwordMaxLength}
        />
      </label>
      {setup && (
        <>
          <p className="text-xs text-slate-500">
            {passwordHint} Simpan password Anda untuk login berikutnya.
          </p>
          <label className="field">
            Ulangi password
            <PasswordInput
              name="confirmation"
              aria-label="Ulangi password"
              visibilityLabel="ulangi password"
              autoComplete="new-password"
              required
              minLength={passwordMinLength}
              maxLength={passwordMaxLength}
            />
          </label>
        </>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="button-primary w-full">
        {pending ? "Memproses…" : setup ? "Buat akun administrator" : "Masuk"}
      </button>
    </form>
  );
}
