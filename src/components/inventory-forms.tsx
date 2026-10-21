"use client";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { adjustInventory, produceInventory, saveInventoryItem } from "@/app/inventory-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { LocalInput } from "@/components/local-input";
import {
  changedBatch,
  stockUnits,
  kindNames,
  type BatchOption,
  type CatalogDraft,
  type RecipeDraft,
  type SubProductOption,
} from "@/lib/inventory";
import { quantityLabel } from "@/lib/goods-receipts";
import { rupiah } from "@/lib/money";
import type { FormState } from "@/lib/form-state";
type Action = (state: FormState, form: FormData) => Promise<FormState>;
function useInventoryForm(serverAction: Action, route: string) {
  const [state, action, pending] = useActionState<FormState, FormData>(serverAction, {}),
    [postingKey] = useState(() => crypto.randomUUID()),
    close = useCloseFormDialog(),
    router = useRouter(),
    handled = useRef(false);
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.push(route + "&saved=" + postingKey);
      router.refresh();
    }
  }, [state.success, pending, close, router, route, postingKey]);
  return { state, action, pending, postingKey, close };
}
function Footer({
  state,
  pending,
  close,
  label,
  disabled = false,
}: {
  state: FormState;
  pending: boolean;
  close?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <>
      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        {close && (
          <button type="button" className="button-secondary" disabled={pending} onClick={close}>
            Batal
          </button>
        )}
        <button className="button-primary" disabled={pending || disabled}>
          {pending ? "Menyimpan..." : label}
        </button>
      </div>
    </>
  );
}
function Form({
  action,
  pending,
  children,
}: {
  action: (form: FormData) => void;
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      className="panel p-6"
    >
      {children}
    </form>
  );
}
export function InventoryAdjustmentForm({
  batches,
  today,
  initialKind = "ADJUST",
}: {
  batches: BatchOption[];
  today: string;
  initialKind?: string;
}) {
  const { state, action, pending, postingKey, close } = useInventoryForm(
      adjustInventory,
      "/stok-inventory?tab=" + (initialKind === "PREP" ? "susut" : "stock"),
    ),
    [kind, setKind] = useState(initialKind),
    [batchId, setBatchId] = useState(""),
    [quantity, setQuantity] = useState("");
  const batch = batches.find((b) => b.id === batchId);
  let next: ReturnType<typeof changedBatch> | undefined,
    previewError = "";
  if (batch && quantity !== "")
    try {
      next = changedBatch(
        kind,
        batch.quantity,
        batch.value,
        Number(quantity),
        batch.initialQuantity,
        batch.initialValue,
      );
    } catch (e) {
      previewError = (e as Error).message;
    }
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="postingKey" value={postingKey} />
      <input
        type="hidden"
        name="rows"
        value={JSON.stringify(
          batch ? [{ batchId: batch.id, version: batch.version, quantity }] : [],
        )}
      />
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Jenis Koreksi
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="ADJUST">Koreksi jumlah stok</option>
            <option value="PREP">Susut prep / pengolahan</option>
            <option value="LOSS">Rusak, terbuang, atau busuk</option>
          </select>
        </label>
        <label className="field sm:col-span-2">
          Barang & Batch *
          <select
            required
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setQuantity("");
            }}
          >
            <option value="">Pilih barang dan batch...</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} - {b.label} - {quantityLabel(b.quantity, b.unit)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {kind === "ADJUST" ? "Stok Aktual" : "Jumlah Susut"}
          {batch ? " (" + batch.unit.toLowerCase() + ")" : ""} *
          <input
            type="number"
            min={kind === "ADJUST" ? "0" : "0.001"}
            max={kind === "ADJUST" ? "1000000000" : batch?.quantity || 0}
            step="0.001"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="field">
          Tanggal *
          <LocalInput
            type="date"
            name="date"
            defaultValue={today}
            max={today}
            min={batch?.date}
            required
          />
        </label>
        {batch && (
          <div className="rounded-xl bg-slate-50 p-4 text-sm sm:col-span-2">
            <p>
              Stok saat ini: <strong>{quantityLabel(batch.quantity, batch.unit)}</strong>
            </p>
            {next && (
              <>
                <p className="mt-2">
                  Stok setelah koreksi: <strong>{quantityLabel(next.after, batch.unit)}</strong>
                </p>
                <p className="mt-2">
                  Nilai stok: <strong>{rupiah(Math.round(next.value))}</strong>
                </p>
              </>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {kind === "PREP"
                ? "Susut prep mempertahankan modal batch sehingga HPP per satuan meningkat."
                : "Koreksi jumlah dan kerusakan menyesuaikan nilai stok menurut HPP batch."}
            </p>
          </div>
        )}
        {previewError && <p className="text-sm text-red-700 sm:col-span-2">{previewError}</p>}
        <label className="field sm:col-span-2">
          Alasan / Catatan *
          <textarea
            name="notes"
            required
            maxLength={2000}
            rows={3}
            placeholder="Contoh: kemasan bocor, susut setelah pengolahan, atau hasil pemeriksaan fisik..."
          />
        </label>
      </fieldset>
      {!batches.length && (
        <p className="mt-4 text-sm text-slate-500">
          Belum ada batch. Catat Barang Masuk terlebih dahulu.
        </p>
      )}
      <Footer
        state={state}
        pending={pending}
        close={close}
        label="Simpan Koreksi"
        disabled={!batch || !next || !!previewError}
      />
    </Form>
  );
}
export function InventoryCountForm({
  batches,
  today,
  kind,
}: {
  batches: BatchOption[];
  today: string;
  kind: "OPNAME" | "DAILY";
}) {
  const { state, action, pending, postingKey, close } = useInventoryForm(
      adjustInventory,
      "/stok-inventory?tab=" + (kind === "OPNAME" ? "opname" : "susut&mode=harian"),
    ),
    [values, setValues] = useState<Record<string, string>>({});
  const rows = batches
    .filter(
      (b) =>
        values[b.id] !== undefined &&
        values[b.id] !== "" &&
        (kind === "OPNAME" || Number(values[b.id]) > 0),
    )
    .map((b) => ({ batchId: b.id, version: b.version, quantity: values[b.id] }));
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="postingKey" value={postingKey} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <label className="field">
          Tanggal
          <LocalInput type="date" name="date" defaultValue={today} max={today} required />
        </label>
        <p className="text-sm text-slate-500">
          {kind === "OPNAME"
            ? "Isi hanya batch yang sudah diperiksa. Kosong berarti belum dihitung; isi 0 jika stok fisik habis."
            : "Isi jumlah barang rusak atau terbuang hari ini. Batch yang kosong tidak akan berubah."}
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Barang / Batch</th>
                <th className="p-3">Stok Sistem</th>
                <th className="p-3">{kind === "OPNAME" ? "Stok Fisik" : "Susut"}</th>
                <th className="p-3">{kind === "OPNAME" ? "Selisih" : "Sisa"}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="p-3">
                    <p className="font-semibold">{batch.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{batch.label}</p>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {quantityLabel(batch.quantity, batch.unit)}
                  </td>
                  <td className="p-3">
                    <input
                      aria-label={
                        (kind === "OPNAME" ? "Fisik " : "Susut ") + batch.name + " " + batch.label
                      }
                      type="number"
                      min="0"
                      max={kind === "OPNAME" ? "1000000000" : batch.quantity}
                      step="0.001"
                      placeholder="Belum diisi"
                      value={values[batch.id] ?? ""}
                      onChange={(e) => setValues((old) => ({ ...old, [batch.id]: e.target.value }))}
                      className="w-36 rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {values[batch.id] !== undefined && values[batch.id] !== ""
                      ? quantityLabel(
                          kind === "OPNAME"
                            ? Number(values[batch.id]) - batch.quantity
                            : batch.quantity - Number(values[batch.id]),
                          batch.unit,
                        )
                      : "-"}
                  </td>
                </tr>
              ))}
              {!batches.length && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    Belum ada batch stok untuk dicatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-sm font-semibold">
          {rows.length} batch {kind === "OPNAME" ? "diperiksa" : "dipilih"}
        </p>
        <label className="field">
          Catatan / Alasan *
          <textarea
            name="notes"
            required
            rows={3}
            maxLength={2000}
            placeholder={
              kind === "OPNAME"
                ? "Hasil pemeriksaan stok fisik gudang..."
                : "Alasan kerusakan atau susut harian..."
            }
          />
        </label>
      </fieldset>
      <Footer
        state={state}
        pending={pending}
        close={close}
        label={kind === "OPNAME" ? "Simpan & Selesai Hitung" : "Simpan Susut Harian"}
        disabled={!rows.length}
      />
    </Form>
  );
}
export function InventoryCatalogForm({
  initial,
  kind,
  ingredients,
}: {
  initial?: CatalogDraft;
  kind: string;
  ingredients: { id: string; name: string; baseUnit: string }[];
}) {
  const { state, action, pending, close } = useInventoryForm(
      saveInventoryItem,
      "/stok-inventory?tab=" +
        (kind === "PRODUCT" ? "produk" : kind === "SUB" ? "subproduk" : "stock"),
    ),
    [unit, setUnit] = useState(initial?.baseUnit || "PCS"),
    [recipe, setRecipe] = useState<RecipeDraft[]>(initial?.recipe || []);
  const patch = (index: number, data: Partial<RecipeDraft>) =>
    setRecipe((old) => old.map((row, i) => (i === index ? { ...row, ...data } : row)));
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="id" value={initial?.id || ""} />
      <input type="hidden" name="version" value={initial?.version || ""} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="recipe" value={JSON.stringify(recipe)} />
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Nama {kindNames[kind]} *
          <input name="name" defaultValue={initial?.name || ""} required maxLength={150} />
        </label>
        <label className="field">
          Kategori *
          <input
            name="category"
            defaultValue={
              initial?.category ||
              (kind === "PRODUCT" ? "Corndog" : kind === "SUB" ? "Adonan" : "Bahan Baku")
            }
            required
            maxLength={100}
          />
        </label>
        <label className="field">
          Emoji Visual (opsional)
          <input
            name="emoji"
            defaultValue={initial?.emoji || ""}
            maxLength={20}
            placeholder="Emoji untuk penanda barang"
          />
        </label>
        <label className="field">
          Satuan Acuan *
          <select name="baseUnit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {stockUnits.map((u) => (
              <option key={u} value={u}>
                {u.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Alert Stok Minimum
          <input
            name="minimumStock"
            type="number"
            min="0"
            max="1000000000"
            step="0.001"
            defaultValue={initial?.minimumStock || "0"}
          />
          <span className="text-xs font-normal text-slate-500">
            Dalam {unit.toLowerCase()}; isi 0 untuk menonaktifkan alert minimum.
          </span>
        </label>
        {kind === "PRODUCT" && (
          <>
            <label className="field">
              Harga Jual (Rp)
              <input
                type="number"
                name="sellingPrice"
                min="0"
                max="1000000000"
                step="1"
                defaultValue={initial?.sellingPrice || "0"}
              />
            </label>
            <label className="field">
              Harga Modal Acuan (Rp)
              <input
                type="number"
                name="standardCost"
                min="0"
                max="1000000000"
                step="1"
                defaultValue={initial?.standardCost || "0"}
              />
            </label>
          </>
        )}
        <label className="field sm:col-span-2">
          Foto (opsional)
          <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" />
          <span className="text-xs font-normal text-slate-500">
            PNG, JPEG, WebP; maksimal 256 KB.
          </span>
        </label>
        {initial?.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="removePhoto" value="true" />
            Hapus foto yang tersimpan
          </label>
        )}
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked={initial?.active ?? true}
          />
          {kindNames[kind]} aktif
        </label>
        {kind === "SUB" && (
          <section className="space-y-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
            <h3 className="text-sm font-semibold">Resep untuk 1 {unit.toLowerCase()} sub-produk</h3>
            <p className="text-xs text-slate-500">
              Gunakan satuan stok bahan (pcs, gram, atau ml). Isi takaran bahan yang sudah
              diketahui; resep boleh disiapkan kemudian sebelum produksi.
            </p>
            {recipe.map((row, index) => (
              <div key={index} className="grid gap-3 border-b border-slate-100 pb-3 sm:grid-cols-2">
                <label className="field sm:col-span-2">
                  Bahan #{index + 1}
                  <select
                    required
                    value={row.ingredientId}
                    onChange={(e) =>
                      patch(index, {
                        ingredientId: e.target.value,
                        baseUnit:
                          ingredients.find((i) => i.id === e.target.value)?.baseUnit || "PCS",
                      })
                    }
                  >
                    <option value="">Pilih bahan...</option>
                    {ingredients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Jumlah Bahan
                  <input
                    type="number"
                    min="0.001"
                    max="1000000000"
                    step="0.001"
                    required
                    value={row.quantity}
                    onChange={(e) => patch(index, { quantity: e.target.value })}
                  />
                </label>
                <label className="field">
                  Satuan Bahan
                  <select
                    value={row.baseUnit}
                    onChange={(e) => patch(index, { baseUnit: e.target.value })}
                  >
                    {stockUnits.map((u) => (
                      <option key={u} value={u}>
                        {u.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="justify-self-end text-sm text-red-700 sm:col-span-2"
                  onClick={() => setRecipe((old) => old.filter((_, i) => i !== index))}
                >
                  Hapus bahan #{index + 1}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button-secondary"
              disabled={recipe.length >= 50}
              onClick={() =>
                setRecipe((old) => [...old, { ingredientId: "", quantity: "", baseUnit: "GRAM" }])
              }
            >
              + Tambah Bahan Resep
            </button>
          </section>
        )}
      </fieldset>
      <Footer
        state={state}
        pending={pending}
        close={close}
        label={initial ? "Simpan Perubahan" : "Simpan " + kindNames[kind]}
      />
    </Form>
  );
}
export function InventoryProductionForm({
  items,
  today,
}: {
  items: SubProductOption[];
  today: string;
}) {
  const { state, action, pending, postingKey, close } = useInventoryForm(
      produceInventory,
      "/stok-inventory?tab=subproduk",
    ),
    [itemId, setItemId] = useState(""),
    [quantity, setQuantity] = useState("1"),
    item = items.find((i) => i.id === itemId);
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="postingKey" value={postingKey} />
      <input type="hidden" name="recipeVersion" value={item?.version || ""} />
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Sub-Produk *
          <select name="itemId" required value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Pilih sub-produk...</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={!i.recipe.length}>
                {i.name}
                {i.recipe.length ? "" : " (resep belum diatur)"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Jumlah Diproduksi{item ? " (" + item.unit.toLowerCase() + ")" : ""} *
          <input
            type="number"
            name="quantity"
            min="0.001"
            max="1000000000"
            step="0.001"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="field">
          Tanggal *<LocalInput type="date" name="date" defaultValue={today} max={today} required />
        </label>
        {item && (
          <div className="rounded-xl bg-emerald-50 p-4 text-sm sm:col-span-2">
            <p className="font-semibold">Kebutuhan bahan</p>
            <ul className="mt-2 space-y-1">
              {item.recipe.map((row) => (
                <li key={row.ingredientId + row.unit}>
                  {row.name}: {quantityLabel(Number(quantity) * row.quantity, row.unit)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-600">
              Bahan dipakai dari batch paling awal (FIFO). Modal bahan dipindahkan ke batch
              sub-produk.
            </p>
          </div>
        )}
        <label className="field sm:col-span-2">
          Catatan (opsional)
          <textarea name="notes" rows={3} maxLength={2000} />
        </label>
      </fieldset>
      <Footer
        state={state}
        pending={pending}
        close={close}
        label="Produksi Sekarang"
        disabled={!item?.recipe.length || Number(quantity) <= 0}
      />
    </Form>
  );
}
export function InventorySyncButton() {
  const router = useRouter();
  return (
    <button type="button" className="button-secondary" onClick={() => router.refresh()}>
      Sync Stok
    </button>
  );
}
