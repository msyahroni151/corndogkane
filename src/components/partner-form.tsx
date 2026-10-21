"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { savePartner } from "@/app/partner-actions";
import { supplierBusinessTypes, supplierPaymentMethods } from "@/lib/supplier-options";
import type { FormState } from "@/lib/form-state";
export type PartnerDraft = {
  id?: string;
  version?: string;
  name: string;
  city: string;
  businessType: string;
  defaultPaymentMethod?: string;
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
      businessType: kind === "SUPPLIER" ? "PERORANGAN" : "",
      defaultPaymentMethod: "TUNAI",
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
    placeholder?: string,
    className = "",
  ) {
    return (
      <label className={`field ${className}`}>
        {label}
        {required ? " *" : ""}
        <input
          placeholder={placeholder}
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
      <div
        className={`grid gap-5 ${kind === "SUPPLIER" ? "min-[400px]:grid-cols-2" : "sm:grid-cols-2"}`}
      >
        {kind === "SUPPLIER" ? (
          <>
            {field(
              "name",
              "Nama Supplier / Toko",
              150,
              true,
              "text",
              "Pak Budi / CV Sumber Tani",
              "min-[400px]:col-span-2",
            )}
            {field("contactPerson", "PIC / Nama Kontak", 150, false, "text", "Budi Santoso")}
            {field("phone", "No HP / WhatsApp", 40, false, "tel", "08xxxxxxxxxx")}
            <fieldset className="min-w-0 min-[400px]:col-span-2">
              <legend className="mb-2 text-sm font-semibold text-slate-700">Jenis Usaha</legend>
              <div className="flex flex-wrap gap-2">
                {(initial?.businessType && !supplierBusinessTypes.includes(initial.businessType)
                  ? [...supplierBusinessTypes, initial.businessType]
                  : supplierBusinessTypes
                ).map((value) => (
                  <label key={value} className="cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="businessType"
                      value={value}
                      checked={draft.businessType === value}
                      onChange={() => setDraft((old) => ({ ...old, businessType: value }))}
                    />
                    <span className="inline-flex rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-500 peer-checked:border-[#4ca259] peer-checked:bg-[#4ca259] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-600">
                      {value}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {field("city", "Kota", 100, false, "text", "Bandung")}
            <label className="field">
              Metode Default
              <select
                name="defaultPaymentMethod"
                value={draft.defaultPaymentMethod || "TUNAI"}
                onChange={(e) =>
                  setDraft((old) => ({ ...old, defaultPaymentMethod: e.target.value }))
                }
              >
                {supplierPaymentMethods.map((value) => (
                  <option key={value} value={value}>
                    {value === "COD" ? "COD" : value === "TUNAI" ? "Tunai" : "Transfer"}
                  </option>
                ))}
              </select>
            </label>
            {initial?.id ? (
              <label className="field min-[400px]:col-span-2">
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
              </label>
            ) : (
              <input type="hidden" name="outstandingDebt" value="0" />
            )}
          </>
        ) : (
          <>
            {field("name", "Nama pelanggan", 150, true)}
            {field("city", "Kota", 100)}
            {field("businessType", "Jenis usaha", 100)}
            {field("contactPerson", "Nama kontak / PIC", 150)}
            {field("phone", "No. HP / telepon", 40, false, "tel")}
          </>
        )}
        <label
          className={`field ${kind === "SUPPLIER" ? "min-[400px]:col-span-2" : "sm:col-span-2"}`}
        >
          {kind === "SUPPLIER" ? "Alamat Lengkap" : "Alamat"}
          <textarea
            placeholder={kind === "SUPPLIER" ? "Pasar Caringin Blok B No. 12" : undefined}
            name="address"
            rows={2}
            maxLength={1000}
            value={draft.address}
            onChange={(e) => setDraft((old) => ({ ...old, address: e.target.value }))}
          />
        </label>
        <label
          className={`field ${kind === "SUPPLIER" ? "min-[400px]:col-span-2" : "sm:col-span-2"}`}
        >
          {kind === "SUPPLIER" ? "Catatan Khusus" : "Keterangan"}
          <textarea
            placeholder={kind === "SUPPLIER" ? "Catatan internal tentang supplier..." : undefined}
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
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
        {close && (
          <button type="button" className="button-secondary" disabled={pending} onClick={close}>
            Batal
          </button>
        )}
        <button className="button-primary" disabled={pending || !draft.name.trim()}>
          {pending ? "Menyimpan…" : kind === "SUPPLIER" ? "Simpan Supplier" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
