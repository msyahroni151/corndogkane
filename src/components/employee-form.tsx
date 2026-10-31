"use client";
import { notifySuccess } from "@/components/notification-toasts";
import { LocalInput } from "@/components/local-input";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { saveEmployee } from "@/app/employee-actions";
import { employeeFields, usesOutletDailyRate, positionsForDepartment } from "@/lib/employee-fields";
import type { FormState } from "@/lib/form-state";

export function EmployeeForm({
  values = {},
  id,
}: {
  values?: Record<string, string>;
  id?: string;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({
    ...values,
    ...(!id ? { salaryBasis: "HARIAN", employmentStatus: "KONTRAK" } : {}),
    id: id || "",
    activityStatus: values.activityStatus === "TIDAK AKTIF" ? "" : values.activityStatus || "AKTIF",
    employeeType:
      values.employeeType || (values.employmentStatus === "PEGAWAI TETAP" ? "TETAP" : "HARIAN"),
  });
  const outletDailyRate = usesOutletDailyRate(draft);
  const [step, setStep] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const sectionRef = useRef<HTMLHeadingElement>(null);
  const set = (key: string, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const router = useRouter();
  const closeDialog = useCloseFormDialog();
  const [state, action, pending] = useActionState<FormState, FormData>(saveEmployee, {});
  const handledSuccess = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state.success || handledSuccess.current === state.success) return;
    handledSuccess.current = state.success;
    notifySuccess("Biodata berhasil disimpan.");
    closeDialog?.();
    router.push("/karyawan");
  }, [state.success, closeDialog, router]);
  function go(next: number) {
    if (next === 2 && !formRef.current?.reportValidity()) return;
    setStep(next);
    requestAnimationFrame(() => {
      sectionRef.current?.focus({ preventScroll: true });
      formRef.current?.closest("dialog")?.scrollTo({ top: 0 });
    });
  }
  const pill = (selected: boolean) =>
    `relative cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-offset-2 ${selected ? "border-[#4b9e55] bg-[#4b9e55] text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-emerald-50"}`;
  const mainFields = (
    <>
      <label className="field">
        <span>
          Nama Karyawan <span className="text-red-400">*</span>
        </span>
        <LocalInput
          aria-label="Nama Karyawan"
          value={draft.fullName || ""}
          onChange={(e) => set("fullName", e.target.value)}
          required
          maxLength={254}
          placeholder="Contoh: Asep Supraman"
        />
      </label>
      <label className="field">
        No. Telepon
        <LocalInput
          aria-label="No. Telepon"
          type="tel"
          value={draft.phone || ""}
          onChange={(e) => set("phone", e.target.value)}
          maxLength={254}
          placeholder="08xxxxxxxxxx"
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-slate-600">Tipe Karyawan</legend>
        <div className="flex gap-2">
          {["HARIAN", "TETAP"].map((type) => (
            <label key={type} className={pill(draft.employeeType === type)}>
              <LocalInput
                type="radio"
                className="sr-only"
                aria-label={type === "HARIAN" ? "Harian" : "Tetap"}
                checked={draft.employeeType === type}
                onChange={() =>
                  setDraft((previous) => ({
                    ...previous,
                    employeeType: type,
                    salaryBasis: outletDailyRate || type === "HARIAN" ? "HARIAN" : "BULANAN",
                  }))
                }
              />
              {type === "HARIAN" ? "Harian" : "Tetap"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        Gaji Pokok ({!outletDailyRate && draft.employeeType === "TETAP" ? "per Bulan" : "per Hari"})
        <div className="relative">
          {!outletDailyRate && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              Rp
            </span>
          )}
          <LocalInput
            aria-label="Gaji Pokok"
            className={
              outletDailyRate ? "!bg-slate-50 !text-slate-500 disabled:cursor-not-allowed" : "!pl-9"
            }
            disabled={outletDailyRate}
            inputMode="numeric"
            type="text"
            pattern="[0-9.]*"
            maxLength={14}
            value={
              outletDailyRate ? "" : (draft.baseSalary || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
            }
            onChange={(e) =>
              set("baseSalary", e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""))
            }
            placeholder={outletDailyRate ? "Mengikuti tarif Master Outlet" : "0"}
          />
        </div>
        {outletDailyRate && (
          <span className="text-xs font-normal leading-5 text-slate-500">
            Gaji harian dihitung otomatis dari tarif Master Outlet sesuai outlet pada jadwal kerja.
          </span>
        )}
      </label>
      <label className="field">
        Catatan
        <textarea
          aria-label="Catatan"
          rows={2}
          maxLength={2000}
          value={draft.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Catatan internal tentang karyawan…"
        />
      </label>
    </>
  );
  const biodataFields = (
    <>
      <div className="mb-4">
        <h3 className="text-sm font-bold">Biodata Karyawan</h3>
        <p className="mt-1 text-xs text-slate-500">Kolom bertanda * wajib diisi.</p>
      </div>
      {outletDailyRate && (
        <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
          Jabatan Crew Outlet: gaji dihitung dari tarif Master Outlet pada jadwal kerja. Nominal
          gaji manual tidak digunakan.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {employeeFields
          .filter((field) => field.key !== "fullName" && field.key !== "phone")
          .map((field) => {
            const options =
              field.key === "position"
                ? positionsForDepartment(draft.department || "")
                : "options" in field
                  ? field.options
                  : undefined;
            const required = "required" in field && field.required;
            return (
              <label className="field" key={field.key}>
                {field.label}
                {required ? " *" : ""}
                {options ? (
                  <select
                    aria-label={field.label}
                    value={draft[field.key] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (field.key === "position")
                        setDraft((previous) => ({
                          ...previous,
                          position: value,
                          ...(value === "CREW OUTLET"
                            ? { department: "OPERASIONAL OUTLET", salaryBasis: "HARIAN" }
                            : {
                                salaryBasis:
                                  previous.employeeType === "TETAP" ? "BULANAN" : "HARIAN",
                              }),
                        }));
                      else if (field.key === "department")
                        setDraft((previous) => ({
                          ...previous,
                          department: value,
                          position:
                            value === "OPERASIONAL OUTLET" &&
                            !positionsForDepartment(value).includes(previous.position as never)
                              ? ""
                              : previous.position,
                        }));
                      else set(field.key, value);
                    }}
                    required={required}
                  >
                    <option value="">Pilih…</option>
                    {(field.key === "department" ||
                      (field.key === "position" && draft.department !== "OPERASIONAL OUTLET")) &&
                      draft[field.key] &&
                      !options.some((option) => option === draft[field.key]) && (
                        <option value={draft[field.key]}>{draft[field.key]} (data lama)</option>
                      )}
                    {options.map((value) => (
                      <option key={value} value={value}>
                        {field.key === "position" && value === "AREA SUPERVISOR" ? "SPV" : value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <LocalInput
                    aria-label={field.label}
                    value={draft[field.key] || ""}
                    onChange={(e) => set(field.key, e.target.value)}
                    type={"type" in field ? field.type : "text"}
                    required={required}
                    maxLength={254}
                  />
                )}
              </label>
            );
          })}
      </div>
    </>
  );
  return (
    <form
      ref={formRef}
      action={action}
      aria-busy={pending}
      autoComplete="off"
      onReset={(event) => event.preventDefault()}
      onSubmit={(event) => {
        if (!id && step === 1) {
          event.preventDefault();
          go(2);
        }
      }}
      className="employee-wizard panel p-5 [&_.field]:gap-1.5 [&_.field]:text-xs [&_.field]:font-medium [&_input:not([type=hidden]):not([type=radio])]:min-h-9 [&_input:not([type=hidden]):not([type=radio])]:py-2 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs"
    >
      {id && <input type="hidden" name="existingId" value={id} />}
      {Object.entries(draft)
        .filter(
          ([name]) => name !== "applicationRole" && (!outletDailyRate || name !== "baseSalary"),
        )
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {!id && (
        <div aria-label={`Tahap ${step} dari 2`} className="mb-5 flex gap-2">
          {[1, 2].map((number) => (
            <span
              key={number}
              className={`h-[3px] flex-1 rounded-full ${number <= step ? "bg-[#4b9e55]" : "bg-slate-200"}`}
            />
          ))}
        </div>
      )}
      <h3 ref={sectionRef} tabIndex={-1} className="sr-only">
        {step === 1 ? "Data utama karyawan" : "Biodata lengkap karyawan"}
      </h3>
      <fieldset disabled={pending} className={id ? "grid gap-8 lg:grid-cols-2" : "space-y-4"}>
        {id ? (
          <>
            <section
              aria-label="Data utama karyawan"
              className="min-w-0 space-y-4 lg:border-r lg:border-slate-100 lg:pr-8"
            >
              <h3 className="text-sm font-bold">Data Utama</h3>
              {mainFields}
            </section>
            <section aria-label="Biodata karyawan" className="min-w-0 space-y-4">
              {biodataFields}
            </section>
          </>
        ) : step === 1 ? (
          mainFields
        ) : (
          biodataFields
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
        {!id && step === 2 ? (
          <button
            type="button"
            className="button-secondary"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              go(1);
            }}
          >
            ← Kembali
          </button>
        ) : closeDialog ? (
          <button
            type="button"
            className="button-secondary"
            disabled={pending}
            onClick={closeDialog}
          >
            Batal
          </button>
        ) : (
          <Link href="/karyawan" className="button-secondary">
            Batal
          </Link>
        )}
        {!id && step === 1 ? (
          <button
            type="button"
            className="button-primary"
            disabled={!draft.fullName?.trim()}
            onClick={(event) => {
              event.preventDefault();
              go(2);
            }}
          >
            Lanjut →
          </button>
        ) : (
          <button key="save" type="submit" className="button-primary" disabled={pending}>
            {pending ? "Menyimpan…" : id ? "Simpan perubahan" : "Simpan karyawan"}
          </button>
        )}
      </div>
    </form>
  );
}
