"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { createGoodsReceipt } from "@/app/goods-receipt-actions";

import { useCloseFormDialog } from "@/components/form-dialog";

import { EditableCombobox } from "@/components/editable-combobox";
import { StockUnitInput } from "@/components/stock-unit-input";
import { LocalInput } from "@/components/local-input";

import {
  itemKey,
  normalizedQuantity,
  packagingUnits,
  quantityLabel,
  receiptMethods,
  type ItemOption,
  type ReceiptLineDraft,
} from "@/lib/goods-receipts";

import { rupiah } from "@/lib/money";

import type { FormState } from "@/lib/form-state";

const blankLine = (key: string): ReceiptLineDraft => ({
  key,

  name: "",

  packCount: "1",

  packagingUnit: "",

  quantityPerPack: "",

  inputUnit: "PCS",

  amount: "",
});

function RupiahInput({
  value,
  onValueChange,
  required = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      placeholder="0"
      value={value.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
      onChange={(event) => {
        const input = event.currentTarget;
        const digitsBeforeCursor = input.value
          .slice(0, input.selectionStart ?? input.value.length)
          .replace(/\D/g, "").length;
        const raw = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        input.setCustomValidity(
          Number(raw) > 1_000_000_000 ? "Nominal maksimal Rp 1.000.000.000." : "",
        );
        onValueChange(raw);
        input.value = formatted;
        let cursor = 0;
        let digits = 0;
        while (cursor < formatted.length && digits < digitsBeforeCursor) {
          if (/\d/.test(formatted[cursor])) digits++;
          cursor++;
        }
        input.setSelectionRange(cursor, cursor);
      }}
    />
  );
}

export function GoodsReceiptForm({
  today,

  suppliers,

  items,
}: {
  today: string;

  suppliers: { id: string; name: string; defaultPaymentMethod: string }[];

  items: ItemOption[];
}) {
  const [lines, setLines] = useState<ReceiptLineDraft[]>([blankLine("first")]),
    [date, setDate] = useState(today),
    [method, setMethod] = useState("TUNAI"),
    [codPaid, setCodPaid] = useState(true),
    [porter, setPorter] = useState(false),
    [fee, setFee] = useState(""),
    [postingKey] = useState(() => crypto.randomUUID());

  const [state, action, pending] = useActionState<FormState, FormData>(createGoodsReceipt, {}),
    close = useCloseFormDialog(),
    router = useRouter(),
    handled = useRef(false);

  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;

      close?.();

      router.push(
        "/barang-masuk?" +
          new URLSearchParams({ from: date || today, to: date || today, saved: "1" }),
      );

      router.refresh();
    }
  }, [state.success, pending, close, router, date, today]);

  const update = (key: string, patch: Partial<ReceiptLineDraft>) =>
    setLines((old) => old.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const subtotal = lines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    total = subtotal + (porter ? Number(fee) || 0 : 0);

  const ready =
    !!postingKey &&
    lines.every(
      (row) =>
        row.name.trim() &&
        row.packagingUnit.trim() &&
        Number(row.packCount) > 0 &&
        Number(row.quantityPerPack) > 0 &&
        row.amount !== "",
    );

  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
      className="panel p-6"
    >
      <input type="hidden" name="postingKey" value={postingKey} />

      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <input type="hidden" name="porterFee" value={porter ? fee || "0" : "0"} />

      <fieldset disabled={pending} className="min-w-0 space-y-6">
        <section className="space-y-4">
          <h3 className="receipt-section">
            <span>1</span> Info Supplier
          </h3>

          <label className="field">
            Supplier (opsional)
            <select
              name="supplierId"
              defaultValue=""
              onChange={(e) => {
                const supplier = suppliers.find((row) => row.id === e.target.value);

                if (supplier) {
                  setMethod(supplier.defaultPaymentMethod);

                  setCodPaid(true);
                }
              }}
            >
              <option value="">— Tanpa supplier —</option>

              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-700">
              Metode Pembayaran *
            </legend>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {receiptMethods.map((value) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className="peer sr-only"
                  />

                  <span className="flex justify-center rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-500 peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-focus-visible:outline-2 peer-focus-visible:outline-emerald-600">
                    {value === "HUTANG"
                      ? "Hutang"
                      : value === "COD"
                        ? "COD"
                        : value === "TUNAI"
                          ? "Tunai"
                          : "Transfer"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {method === "COD" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="codPaid"
                value="true"
                checked={codPaid}
                onChange={(e) => setCodPaid(e.target.checked)}
              />
              COD sudah dibayar saat barang diterima
            </label>
          )}

          {(method === "HUTANG" || (method === "COD" && !codPaid)) && (
            <p className="text-xs text-amber-700">
              Belum dibayar. Jika supplier dipilih, tagihan ini menambah saldo hutang supplier.
            </p>
          )}

          <label className="field">
            Tanggal Barang Datang (opsional)
            <LocalInput
              type="date"
              name="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <span className="text-xs font-normal text-slate-500">
              Jika dikosongkan, menggunakan tanggal hari ini.
            </span>
          </label>
        </section>

        <section className="space-y-4">
          <h3 className="receipt-section">
            <span>2</span> Daftar Barang
          </h3>

          {lines.map((row, index) => {
            const normalized = normalizedQuantity(
              Number(row.packCount),

              Number(row.quantityPerPack),

              row.inputUnit,
            );

            return (
              <fieldset key={row.key} className="min-w-0 rounded-xl border border-slate-200 p-4">
                <legend className="px-2 text-sm font-semibold">Barang #{index + 1}</legend>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field sm:col-span-2">
                    Nama Barang *
                    <EditableCombobox
                      options={items.map((item) => item.name)}
                      required
                      maxLength={150}
                      placeholder="Cari / pilih barang, atau ketik nama baru..."
                      value={row.name}
                      onValueChange={(name) => {
                        const match = items.find((item) => itemKey(item.name) === itemKey(name));

                        update(row.key, {
                          name,

                          ...(match
                            ? {
                                packagingUnit: match.packagingUnit,
                                inputUnit: match.baseUnit || row.inputUnit,

                                quantityPerPack:
                                  match.packagingUnit === "PCS" ? "1" : row.quantityPerPack,
                              }
                            : {}),
                        });
                      }}
                    />
                    <span className="text-xs font-normal text-slate-500">
                      Nama barang baru otomatis ditambahkan ke daftar saat disimpan.
                    </span>
                  </label>

                  <label className="field">
                    Jumlah Kemasan *
                    <input
                      type="number"
                      min="0.001"
                      max="1000000"
                      step="0.001"
                      required
                      value={row.packCount}
                      onChange={(e) => update(row.key, { packCount: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    Satuan Kemasan *
                    <EditableCombobox
                      options={[...packagingUnits, ...items.map((item) => item.packagingUnit)]}
                      required
                      maxLength={40}
                      placeholder="Karton, pack, karung..."
                      value={row.packagingUnit}
                      onValueChange={(value) => update(row.key, { packagingUnit: value })}
                    />
                  </label>

                  <label className="field">
                    Qty per Kemasan *
                    <input
                      type="number"
                      min="0.001"
                      max="1000000"
                      step="0.001"
                      required
                      placeholder="Contoh: 500"
                      value={row.quantityPerPack}
                      onChange={(e) => update(row.key, { quantityPerPack: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    Satuan Isi *
                    <StockUnitInput
                      receipt
                      value={row.inputUnit}
                      onChange={(value) => update(row.key, { inputUnit: value })}
                      units={items.flatMap((item) => (item.baseUnit ? [item.baseUnit] : []))}
                    />
                  </label>

                  <label className="field sm:col-span-2">
                    Harga Total Barang (Rp) *
                    <RupiahInput
                      required
                      value={row.amount}
                      onValueChange={(amount) => update(row.key, { amount })}
                    />
                    <span className="text-xs font-normal text-slate-500">
                      Total harga untuk seluruh kemasan barang ini.
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                    <p className="text-xs text-slate-500">
                      Total isi: {quantityLabel(normalized.quantity, normalized.baseUnit)}
                    </p>

                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600"
                        onClick={() =>
                          setLines((old) => old.filter((line) => line.key !== row.key))
                        }
                      >
                        Hapus barang #{index + 1}
                      </button>
                    )}
                  </div>
                </div>
              </fieldset>
            );
          })}

          <button
            type="button"
            className="button-secondary w-full border-dashed text-emerald-700"
            disabled={lines.length >= 50}
            onClick={() => setLines((old) => [...old, blankLine(crypto.randomUUID())])}
          >
            + Tambah Barang Lain
          </button>

          <details className="rounded-xl border border-dashed border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Biaya Porter (opsional)
            </summary>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={porter}
                onChange={(e) => setPorter(e.target.checked)}
              />
              Tambahkan biaya porter
            </label>

            {porter && (
              <label className="field mt-3">
                Biaya Porter (Rp)
                <RupiahInput value={fee} onValueChange={setFee} />
              </label>
            )}
          </details>
        </section>

        <section className="space-y-4">
          <h3 className="receipt-section">
            <span>3</span> Ringkasan
          </h3>

          <div className="rounded-xl border border-slate-200 text-sm">
            <div className="flex justify-between gap-4 p-4">
              <span>Subtotal ({lines.length} barang)</span>

              <strong>{rupiah(subtotal)}</strong>
            </div>

            {porter && (
              <div className="flex justify-between gap-4 px-4 pb-4">
                <span>Biaya porter</span>

                <span>{rupiah(Number(fee) || 0)}</span>
              </div>
            )}

            <div className="flex justify-between gap-4 border-t border-slate-200 bg-emerald-50 p-4">
              <strong>Total Tagihan</strong>

              <strong className="text-emerald-700">{rupiah(total)}</strong>
            </div>
          </div>

          <label className="field">
            Catatan (opsional)
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="Catatan tambahan, kondisi barang, nomor surat jalan..."
            />
          </label>
        </section>
      </fieldset>

      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
        <button type="button" className="button-secondary" disabled={pending} onClick={close}>
          Batal
        </button>

        <button className="button-primary" disabled={pending || !ready}>
          {pending ? "Menyimpan..." : "Simpan Barang Masuk"}
        </button>
      </div>
    </form>
  );
}
