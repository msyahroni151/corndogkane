"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveReceiptTemplate } from "@/app/receipt-template-actions";
import { ReceiptPaper, PrintableReceipt } from "@/components/receipt-paper";
import {
  defaultReceiptSettings,
  receiptKindLabels,
  receiptDateFormats,
  type ReceiptData,
  type ReceiptKind,
  type ReceiptSettings,
  type ReceiptTemplateRecord,
} from "@/lib/receipt-templates";
import { previewProducts } from "@/lib/pos-preview";
import type { FormState } from "@/lib/form-state";
type Draft = { settings: ReceiptSettings; revision: number };
export function ReceiptTemplateEditor({
  records,
  outlets,
  sampleDate,
}: {
  records: ReceiptTemplateRecord[];
  outlets: { id: string; name: string }[];
  sampleDate: string;
}) {
  const [submittingKey, setSubmittingKey] = useState(""),
    [scope, setScope] = useState("GLOBAL"),
    [kind] = useState<ReceiptKind>("CUSTOMER"),
    [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [printJob, setPrintJob] = useState<{
      key: string;
      settings: ReceiptSettings;
      data: ReceiptData;
      kind: ReceiptKind;
    } | null>(null),
    [state, action, pending] = useActionState<FormState, FormData>(saveReceiptTemplate, {}),
    router = useRouter(),
    submitted = useRef<{ key: string; draft: Draft } | null>(null),
    handled = useRef<FormState | null>(null);
  const key = scope + ":" + kind,
    exact = records.find((r) => r.scope === scope && r.kind === kind),
    base = exact || records.find((r) => r.scope === "GLOBAL" && r.kind === kind),
    settings = drafts[key]?.settings || base?.settings || defaultReceiptSettings(kind),
    revision = drafts[key]?.revision ?? exact?.revision ?? 0,
    dirty =
      JSON.stringify(settings) !== JSON.stringify(base?.settings || defaultReceiptSettings(kind)),
    outlet = outlets.find((o) => o.id === scope)?.name || "CONTOH OUTLET";
  useEffect(() => {
    if (state.success && !pending && handled.current !== state) {
      handled.current = state;
      const saved = submitted.current;
      if (saved)
        queueMicrotask(() =>
          setDrafts((old) => ({
            ...old,
            [saved.key]: { settings: saved.draft.settings, revision: saved.draft.revision + 1 },
          })),
        );
      router.refresh();
    }
  }, [state, pending, router]);
  function change<K extends keyof ReceiptSettings>(field: K, value: ReceiptSettings[K]) {
    setDrafts((old) => ({
      ...old,
      [key]: { settings: { ...settings, [field]: value }, revision },
    }));
  }
  const product = previewProducts[0],
    second = previewProducts.find((p) => p.name === "Mix Original") || previewProducts[1],
    subtotal = product.price * 2 + second.price,
    total = subtotal - 1000;
  const sample: ReceiptData = {
    id: "CONTOH-0001",
    dateISO: sampleDate,
    outlet,
    cashier: "Kasir Contoh",
    method: "TUNAI",
    received: Math.ceil(total / 10000) * 10000,
    total,
    discount: 1000,
    tax: 0,
    customer: "Pelanggan Contoh",
    loyaltyEarned: 10,
    loyaltyBalance: 100,
    preview: true,
    items: [
      {
        name: product.name,
        quantity: 2,
        price: product.price,
        addons: [{ name: "Saus: Saos Cabe, Saos Tomat" }],
      },
      {
        name: second.name,
        quantity: 1,
        price: second.price,
        addons: [{ name: "Packing: pisahkan saus" }],
      },
    ],
    settlement: {
      transactions: 1,
      total,
      payments: [{ method: "TUNAI", amount: total }],
      cashExpected: total,
      cashActual: total,
    },
  };
  const text = (
    field: keyof ReceiptSettings,
    label: string,
    max: number,
    type = "text",
    placeholder = "",
  ) => (
    <label className="field">
      {label}
      <input
        type={type}
        value={String(settings[field])}
        maxLength={max}
        required={field === "brand"}
        placeholder={placeholder}
        onChange={(e) => change(field, e.target.value as never)}
      />
    </label>
  );
  const toggles: { key: keyof ReceiptSettings; label: string }[] = [
    { key: "showLogo", label: "Logo toko" },
    { key: "showOutlet", label: "Nama outlet" },
    { key: "showCashier", label: "Nama kasir" },
    { key: "showCustomer", label: "Informasi pelanggan" },
    { key: "showLoyalty", label: "Poin loyalty (jika tersedia)" },
    { key: "showAddons", label: "Rincian glaze, topping & saus" },
    { key: "showDiscount", label: "Rincian diskon / promo" },
    { key: "showTax", label: "Rincian pajak (jika tersedia)" },
    { key: "showQuantity", label: "Total QTY" },
    { key: "active", label: "Template aktif" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="field min-w-0 sm:min-w-64">
          Berlaku untuk
          <select value={scope} disabled={pending} onChange={(e) => setScope(e.target.value)}>
            <option value="GLOBAL">Semua outlet (template umum)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="button-secondary"
            disabled={pending}
            onClick={() => setPrintJob({ key: crypto.randomUUID(), settings, data: sample, kind })}
          >
            Cetak Contoh
          </button>
          <button
            type="submit"
            form="receipt-template-editor"
            className="button-primary"
            disabled={pending}
          >
            {pending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form
          id="receipt-template-editor"
          action={action}
          aria-busy={pending}
          onReset={(e) => e.preventDefault()}
          onSubmit={() => {
            submitted.current = { key, draft: { settings, revision } };
            setSubmittingKey(key);
          }}
          className="min-w-0 space-y-5"
        >
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="revision" value={revision} />
          <input type="hidden" name="settings" value={JSON.stringify(settings)} />
          {scope !== "GLOBAL" && !exact && (
            <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
              Outlet ini memakai template umum. Simpan untuk membuat pengaturan khusus {outlet}.
            </p>
          )}
          <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
            <section className="panel space-y-4 p-5">
              <h2 className="border-b border-slate-100 pb-3 text-sm font-bold">Informasi Toko</h2>
              {text("brand", "Nama Toko *", 150)}
              <label className="field">
                Alamat
                <textarea
                  rows={3}
                  maxLength={500}
                  value={settings.address}
                  onChange={(e) => change("address", e.target.value)}
                />
              </label>
              {text("phone", "Telepon", 50, "tel")}
              {text("email", "Email", 254, "email")}
              {text("website", "Website", 500, "url", "https://...")}
              {text(
                "logoUrl",
                "URL Logo",
                500,
                "text",
                "https://... atau logo bawaan Corndog Kane",
              )}
              <button
                type="button"
                className="text-xs font-semibold text-emerald-700"
                onClick={() => change("logoUrl", "/corndog-kane-logo.png")}
              >
                Gunakan logo Corndog Kane
              </button>
            </section>
            <div className="min-w-0 space-y-5">
              <section className="panel space-y-4 p-5">
                <h2 className="border-b border-slate-100 pb-3 text-sm font-bold">Konten Struk</h2>
                {text("headerText", "Teks Header", 500)}
                <label className="field">
                  Teks Footer
                  <textarea
                    maxLength={2000}
                    rows={4}
                    value={settings.footerText}
                    onChange={(e) => change("footerText", e.target.value)}
                  />
                  <span className="text-xs font-normal text-slate-400">
                    Maksimal 2.000 karakter.
                  </span>
                </label>
              </section>
              <section className="panel space-y-4 p-5">
                <h2 className="border-b border-slate-100 pb-3 text-sm font-bold">
                  Format & Ukuran
                </h2>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-slate-700">
                    Ukuran Kertas
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([58, 80] as const).map((width) => (
                      <label key={width} className="cursor-pointer">
                        <input
                          type="radio"
                          name="paper-choice"
                          value={width}
                          checked={settings.paperWidth === width}
                          onChange={() => change("paperWidth", width)}
                          className="peer sr-only"
                        />
                        <span className="flex justify-center rounded-xl border border-slate-200 px-3 py-3 text-sm peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-800 peer-focus-visible:outline-2 peer-focus-visible:outline-emerald-600">
                          {width} mm
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {text("taxLabel", "Label Pajak", 80)}
                <p className="text-xs text-slate-400">
                  Label ini tidak menambahkan pajak pada transaksi.
                </p>
                <label className="field">
                  Format Mata Uang
                  <select
                    value={settings.currencyFormat}
                    onChange={(e) =>
                      change("currencyFormat", e.target.value as ReceiptSettings["currencyFormat"])
                    }
                  >
                    <option value="RP">Rp 10.000</option>
                    <option value="IDR">IDR 10.000</option>
                  </select>
                </label>
                <label className="field">
                  Format Tanggal
                  <select
                    value={settings.dateFormat}
                    onChange={(e) =>
                      change("dateFormat", e.target.value as ReceiptSettings["dateFormat"])
                    }
                  >
                    {receiptDateFormats.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
            <section className="panel p-5 sm:col-span-2">
              <h2 className="mb-4 border-b border-slate-100 pb-3 text-sm font-bold">
                Tampilkan di Struk
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {toggles.map((toggle) => (
                  <label
                    key={toggle.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm"
                  >
                    <span>{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[toggle.key])}
                      onChange={(e) => change(toggle.key, e.target.checked as never)}
                      className="h-4 w-4 shrink-0 accent-emerald-700"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Template nonaktif tidak digunakan POS. POS memakai template umum yang aktif atau
                format bawaan.
              </p>
            </section>
            <section className="panel space-y-4 p-5 sm:col-span-2">
              <h2 className="border-b border-slate-100 pb-3 text-sm font-bold">Field Kustom</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {text("customLabel1", "Label Field 1", 100)}
                {text("customValue1", "Nilai Field 1", 500)}
                {text("customLabel2", "Label Field 2", 100)}
                {text("customValue2", "Nilai Field 2", 500)}
              </div>
            </section>
          </fieldset>
          {state.error && submittingKey === key && (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {state.error}
            </p>
          )}
          {state.success && submittingKey === key && (
            <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              {state.success}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {dirty ? "Ada perubahan pada template ini." : "Template siap digunakan."}
            </p>
            <button className="button-primary" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Template"}
            </button>
          </div>
        </form>
        <aside className="receipt-editor-preview" aria-label="Pratinjau Template Struk">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-slate-600">PREVIEW STRUK</h2>
            <span className="text-xs text-slate-400">{settings.paperWidth} mm</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">{receiptKindLabels[kind]} - contoh tampilan</p>
          <div className="receipt-editor-roll" style={{ width: settings.paperWidth + "mm" }}>
            <ReceiptPaper settings={settings} data={sample} kind={kind} />
          </div>
        </aside>
      </div>
      <p className="text-xs text-slate-400">
        Format awal mengikuti struk POS Apps Script Corndog Kane. Pengaturan ini digunakan oleh POS
        aplikasi ini; data contoh tidak disimpan sebagai transaksi.
      </p>
      {printJob && (
        <PrintableReceipt
          settings={printJob.settings}
          data={printJob.data}
          kind={printJob.kind}
          printKey={printJob.key}
        />
      )}
    </div>
  );
}
