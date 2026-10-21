"use client";
import { PasswordInput } from "@/components/password-input";
import {
  passwordHint,
  passwordMinLength,
  passwordMaxLength,
  passwordPattern,
} from "@/lib/password-policy";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
import { saveAccessRole, saveLoginAccount } from "@/app/role-actions";
import { permissionMenus } from "@/lib/permissions";
import type { FormState } from "@/lib/form-state";
function useSettingsAction(save: typeof saveAccessRole) {
  const [state, action, pending] = useActionState<FormState, FormData>(save, {});
  const close = useCloseFormDialog();
  const router = useRouter();
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state.success || handled.current === state.success) return;
    handled.current = state.success;
    notifySuccess(state.success);
    close?.();
    router.refresh();
  }, [state.success, close, router]);
  return { state, action, pending, close };
}
type RoleValues = {
  id: string;
  name: string;
  description: string | null;
  systemKey: string | null;
  active: boolean;
  permissions: string[];
  version: string;
};
function Feedback({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {error}
    </p>
  ) : null;
}
export function AccessRoleForm({ values }: { values?: RoleValues }) {
  const { state, action, pending, close } = useSettingsAction(saveAccessRole);
  const owner = values?.systemKey === "OWNER";
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      aria-busy={pending}
      className="p-6"
    >
      {values && (
        <>
          <input type="hidden" name="id" value={values.id} />
          <input type="hidden" name="version" value={values.version} />
        </>
      )}
      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Nama role *
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={values?.name}
              readOnly={owner}
            />
          </label>
          <label className="field">
            Status *
            {owner ? (
              <>
                <input value="Aktif" readOnly />
                <input type="hidden" name="active" value="true" />
              </>
            ) : (
              <select name="active" defaultValue={values?.active === false ? "false" : "true"}>
                <option value="true">Aktif</option>
                <option value="false">Tidak aktif</option>
              </select>
            )}
          </label>
        </div>
        <label className="field">
          Deskripsi
          <textarea
            name="description"
            rows={2}
            maxLength={1000}
            defaultValue={values?.description || ""}
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">Hak akses menu</legend>
          <p className="mb-3 mt-1 text-xs leading-5 text-slate-500">
            Menu yang dipilih dapat dibuka dan datanya dapat dikelola. Akses Role &amp; Akun Login
            mencakup pengaturan semua akun dan hak akses.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {permissionMenus.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  name="permission"
                  value={item.key}
                  defaultChecked={
                    owner ||
                    (values ? values.permissions.includes(item.key) : item.key === "dashboard")
                  }
                  disabled={owner}
                  className="h-4 w-4 accent-emerald-700"
                />
                {item.label}
              </label>
            ))}
          </div>
          {owner && (
            <p className="mt-3 text-xs text-slate-500">
              Owner selalu memiliki akses penuh dan tetap aktif.
            </p>
          )}
        </fieldset>
      </fieldset>
      <Feedback error={state.error} />
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="button-secondary" disabled={pending} onClick={close}>
          Batal
        </button>
        <button className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan role"}
        </button>
      </div>
    </form>
  );
}
type AccountValues = {
  id: string;
  employeeId: string | null;
  name: string;
  email: string;
  roleId: string | null;
  active: boolean;
  version: string;
};
export function LoginAccountForm({
  values,
  employees,
  roles,
}: {
  values?: AccountValues;
  employees: { id: string; name: string }[];
  roles: { id: string; name: string; active: boolean }[];
}) {
  const { state, action, pending, close } = useSettingsAction(saveLoginAccount);
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      aria-busy={pending}
      autoComplete="off"
      className="p-6"
    >
      {values && (
        <>
          <input type="hidden" name="id" value={values.id} />
          <input type="hidden" name="version" value={values.version} />
        </>
      )}
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Karyawan *
          {values ? (
            <input readOnly value={values.name} />
          ) : (
            <select aria-label="Karyawan" name="employeeId" required defaultValue="">
              <option value="">Pilih karyawan…</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} · {employee.id}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="field">
          Email login *
          <input
            aria-label="Email login"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="username"
            defaultValue={values?.email}
          />
        </label>
        <label className="field">
          Role *
          <select aria-label="Role" name="roleId" required defaultValue={values?.roleId || ""}>
            <option value="">Pilih role…</option>
            {roles
              .filter((role) => role.active || role.id === values?.roleId)
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.active ? "" : " (tidak aktif)"}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          {values ? "Password baru (opsional)" : "Password *"}
          <PasswordInput
            aria-label="Password akun"
            visibilityLabel="password akun"
            name="password"
            required={!values}
            minLength={passwordMinLength}
            pattern={passwordPattern}
            title={passwordHint}
            maxLength={passwordMaxLength}
            autoComplete="new-password"
          />
          <span className="text-xs font-normal text-slate-500">
            {passwordHint}
            {values ? " Kosongkan agar password tetap." : ""}
          </span>
        </label>
        <label className="field">
          Konfirmasi password
          <PasswordInput
            aria-label="Konfirmasi password"
            visibilityLabel="konfirmasi password"
            name="confirmation"
            required={!values}
            maxLength={passwordMaxLength}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          Status akun *
          <select
            aria-label="Status akun"
            name="active"
            defaultValue={values?.active ? "true" : "false"}
          >
            <option value="false">Tidak aktif</option>
            <option value="true">Aktif</option>
          </select>
        </label>
        <p className="self-center text-xs leading-5 text-slate-500">
          Akun aktif dapat login menggunakan email dan password. Hak akses mengikuti role yang
          dipilih.
        </p>
      </fieldset>
      <Feedback error={state.error} />
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="button-secondary" disabled={pending} onClick={close}>
          Batal
        </button>
        <button className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan akun"}
        </button>
      </div>
    </form>
  );
}
