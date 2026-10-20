"use client";
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
        <input
          name="password"
          type="password"
          autoComplete={setup ? "new-password" : "current-password"}
          required
          minLength={setup ? 12 : undefined}
          maxLength={128}
        />
      </label>
      {setup && (
        <>
          <p className="text-xs text-slate-500">
            Gunakan minimal 12 karakter. Simpan password Anda untuk login berikutnya.
          </p>
          <label className="field">
            Ulangi password
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
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
