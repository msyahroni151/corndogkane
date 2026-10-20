"use client";
import { LocalInput } from "@/components/local-input";
import { useActionState, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import type { FormState } from "@/lib/form-state";
import type { RecordField, SaveRecordAction } from "@/lib/record-fields";
export function RecordForm({
  title,
  fields,
  saveAction,
  initial = {},
  existingId,
  successRoute,
  cancelRoute = "/master",
}: {
  title: string;
  fields: RecordField[];
  saveAction: SaveRecordAction;
  initial?: Record<string, string>;
  existingId?: string;
  successRoute: string;
  cancelRoute?: string;
}) {
  const defaults = Object.fromEntries(fields.map((field) => [field.key, field.defaultValue || ""]));
  const [draft, setDraft] = useState<Record<string, string>>({ ...defaults, ...initial });
  const suggestionId = useId();
  const router = useRouter();
  const closeDialog = useCloseFormDialog();
  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setDraft((old) => ({ ...old, [name]: value }));
  };
  const [state, action, pending] = useActionState<FormState, FormData>(saveAction, {});
  const handledSuccess = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state.success || handledSuccess.current === state.success) return;
    handledSuccess.current = state.success;
    closeDialog?.();
    router.push(successRoute);
  }, [state.success, closeDialog, router, successRoute]);
  return (
    <form
      aria-busy={pending}
      action={action}
      onReset={(event) => event.preventDefault()}
      className="panel p-6"
      aria-label={title}
    >
      <h2 className="text-lg font-bold">{title}</h2>
      {existingId && <input type="hidden" name="existingId" value={existingId} />}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="field">
            {field.label}
            {field.required ? " *" : ""}
            {field.options ? (
              <select
                name={field.key}
                value={draft[field.key] || ""}
                onChange={change}
                required={field.required}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <LocalInput
                name={field.key}
                value={draft[field.key] || ""}
                onChange={change}
                type={field.type || "text"}
                list={field.suggestions ? suggestionId + "-" + field.key : undefined}
                autoComplete={field.suggestions ? "off" : undefined}
                readOnly={field.readOnly}
                required={field.required}
                maxLength={100}
              />
            )}
            {field.suggestions && (
              <datalist id={suggestionId + "-" + field.key}>
                {field.suggestions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            )}
            {field.help && (
              <span className="text-xs font-normal leading-5 text-slate-500">{field.help}</span>
            )}
          </label>
        ))}
      </div>
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        {existingId && (
          <Link href={cancelRoute} className="button-secondary">
            Batal edit
          </Link>
        )}
        <button type="submit" disabled={pending} className="button-primary">
          {pending
            ? "Menyimpan…"
            : existingId
              ? "Simpan perubahan"
              : "Simpan " + title.toLowerCase()}
        </button>
      </div>
    </form>
  );
}
