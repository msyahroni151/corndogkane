"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { savePartner } from "@/app/partner-actions";
import type { FormState } from "@/lib/form-state";
export type PartnerDraft = {
  id?: string;
  version?: string;
  name: string;
  city: string;
  businessType: string;
  contactPerson: string;
  phone: string;
  address: string;
  notes: string;
  outstandingDebt: string;
};
export function PartnerForm({
  kind,
  initial,
  successRoute,
}: {
  kind: "SUPPLIER" | "CUSTOMER";
  initial?: PartnerDraft;
  successRoute: string;
}) {
  const [draft, setDraft] = useState<PartnerDraft>(
    initial || {
      name: "",
      city: "",
      businessType: "",
      contactPerson: "",
      phone: "",
      address: "",
      notes: "",
      outstandingDebt: "0",
    },
  );
  const [state, action, pending] = useActionState<FormState, FormData>(savePartner, {}),
    handled = useRef(false),
    router = useRouter(),
    close = useCloseFormDialog();
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.push(successRoute);
    }
  }, [state.success, pending, close, router, successRoute]);
  function field(
    key: keyof PartnerDraft,
    label: string,
    max: number,
    required = false,
    type = "text",
  ) {
    return (
      <label className="field">
        {label}
        {required ? " *" : ""}
        <input
          name={key}
          type={type}
          required={required}
          maxLength={max}
          value={draft[key] || ""}
          onChange={(e) => setDraft((old) => ({ ...old, [key]: e.target.value }))}
        />
      </label>
    );
  }
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      className="panel p-6"
    >
      <input name="kind" type="hidden" value={kind} />
      {initial?.id && (
        <>
          <input name="id" type="hidden" value={initial.id} />
          <input name="version" type="hidden" value={initial.version || ""} />
        </>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", kind === "SUPPLIER" ? "Nama supplier" : "Nama pelanggan", 150, true)}
        {field("city", "Kota", 100)}
        {field("businessType", "Jenis usaha", 100)}
        {field("contactPerson", "Nama kontak / PIC", 150)}
        {field("phone", "No. HP / telepon", 40, false, "tel")}
        {kind === "SUPPLIER" && (
          <label className="field">
            Saldo hutang (Rp)
            <input
              name="outstandingDebt"
              type="number"
              min="0"
              max="1000000000"
              step="1"
              required
              value={draft.outstandingDebt}
              onChange={(e) => setDraft((old) => ({ ...old, outstandingDebt: e.target.value }))}
            />
            <span className="text-xs font-normal text-slate-400">
              Saldo dicatat manual; isi 0 jika tidak ada hutang.
            </span>
          </label>
        )}
        <label className="field sm:col-span-2">
          Alamat
          <textarea
            name="address"
            rows={2}
            maxLength={1000}
            value={draft.address}
            onChange={(e) => setDraft((old) => ({ ...old, address: e.target.value }))}
          />
        </label>
        <label className="field sm:col-span-2">
          Keterangan
          <textarea
            name="notes"
            rows={2}
            maxLength={2000}
            value={draft.notes}
            onChange={(e) => setDraft((old) => ({ ...old, notes: e.target.value }))}
          />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
