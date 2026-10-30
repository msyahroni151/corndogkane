"use client";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  saveProductionRemainder,
  changeInventoryItemStatus,
  adjustInventory,
  produceInventory,
  saveInventoryItem,
  reclassifyWarehouseStock,
} from "@/app/inventory-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { StockUnitInput } from "@/components/stock-unit-input";
import { LocalInput } from "@/components/local-input";
import {
  changedBatch,
  inventoryRound,
  kindNames,
  warehouseKinds,
  warehouseKindNames,
  type BatchOption,
  type CatalogDraft,
  type SubProductOption,
  type RemainderBatchOption,
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
  danger = false,
}: {
  state: FormState;
  pending: boolean;
  close?: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
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
        <button
          className={"button-primary" + (danger ? " button-danger" : "")}
          disabled={pending || disabled}
        >
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
  kind: initialKind,
  warehouse = false,
  units = [],
}: {
  initial?: CatalogDraft;
  kind: string;
  warehouse?: boolean;
  units?: string[];
  ingredients: { id: string; name: string; baseUnit: string }[];
}) {
  const [kind, setKind] = useState(initialKind);
  const labelKind = warehouse ? warehouseKindNames[kind] : kindNames[kind];
  const { state, action, pending, close } = useInventoryForm(
      saveInventoryItem,
      warehouse || kind === "RAW" || kind === "FINISHED"
        ? "/stok-inventory?tab=stock"
        : "/setting-menu?tab=" + (kind === "PRODUCT" ? "produk" : "subproduk"),
    ),
    [unit, setUnit] = useState(initial?.baseUnit || "PCS");
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="id" value={initial?.id || ""} />
      <input type="hidden" name="version" value={initial?.version || ""} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="catalogScope" value={warehouse ? "warehouse" : "menu"} />
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {warehouse && (
          <label className="field sm:col-span-2">
            Jenis stok gudang *
            <select value={kind} disabled={!!initial?.id} onChange={(e) => setKind(e.target.value)}>
              {warehouseKinds.map((k) => (
                <option key={k} value={k}>
                  {warehouseKindNames[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field sm:col-span-2">
          Nama {labelKind} *
          <input name="name" defaultValue={initial?.name || ""} required maxLength={150} />
        </label>
        {!warehouse && (
          <label className="field">
            Kategori *
            <input
              name="category"
              defaultValue={
                initial?.category ||
                (warehouse
                  ? "Persediaan Gudang"
                  : kind === "PRODUCT"
                    ? "Corndog"
                    : kind === "SUB"
                      ? "Adonan"
                      : "Bahan Baku")
              }
              required
              maxLength={100}
            />
          </label>
        )}
        {!warehouse && (
          <label className="field">
            Emoji Visual (opsional)
            <input
              name="emoji"
              defaultValue={initial?.emoji || ""}
              maxLength={20}
              placeholder="Emoji untuk penanda barang"
            />
          </label>
        )}
        <label className="field">
          Satuan Acuan *
          <StockUnitInput name="baseUnit" value={unit} onChange={setUnit} units={units} />
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
        {!warehouse && (
          <>
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
          </>
        )}
        {!warehouse && (
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input
              type="checkbox"
              name="active"
              value="true"
              defaultChecked={initial?.active ?? true}
            />
            {labelKind} aktif
          </label>
        )}
        {(kind === "SUB" || kind === "PRODUCT" || kind === "FINISHED") && (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 sm:col-span-2">
            {kind === "PRODUCT"
              ? "Komposisi bahan per pcs dan HPP diatur melalui Setting Menu / Resep & HPP."
              : "Komposisi bahan per batch dan hasil standar diatur melalui Produksi Gudang / Resep Produksi."}
          </p>
        )}
      </fieldset>
      <Footer
        state={state}
        pending={pending}
        close={close}
        label={initial ? "Simpan Perubahan" : "Simpan " + labelKind}
      />
    </Form>
  );
}
export function InventoryProductionForm({
  items,
  today,
  remainders = [],
  initialReuseId = "",
}: {
  items: SubProductOption[];
  today: string;
  remainders?: RemainderBatchOption[];
  initialReuseId?: string;
}) {
  const initialRemainder = remainders.find((r) => r.id === initialReuseId);
  const initialItem = items.find((i) => i.id === initialRemainder?.itemId);
  const { state, action, pending, postingKey, close } = useInventoryForm(
      produceInventory,
      "/produksi-gudang?tab=riwayat",
    ),
    [itemId, setItemId] = useState(initialItem?.id || ""),
    [quantity, setQuantity] = useState(
      String(
        (initialItem?.productionYield || 1) + (initialItem ? initialRemainder?.quantity || 0 : 0),
      ),
    ),
    [reuseBatchId, setReuseBatchId] = useState(initialItem ? initialRemainder?.id || "" : ""),
    [reuseQuantity, setReuseQuantity] = useState(
      initialItem ? String(initialRemainder?.quantity || 0) : "0",
    ),
    [batchCount, setBatchCount] = useState("1"),
    item = items.find((i) => i.id === itemId),
    selectedRemainder = remainders.find((r) => r.id === reuseBatchId);
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="reuseVersion" value={selectedRemainder?.version ?? ""} />
      <input type="hidden" name="postingKey" value={postingKey} />
      <input type="hidden" name="recipeVersion" value={item?.version || ""} />
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Hasil Produksi *
          <select
            name="itemId"
            required
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              setReuseBatchId("");
              setReuseQuantity("0");
              const selected = items.find((i) => i.id === e.target.value);
              setQuantity(
                String(inventoryRound(Number(batchCount) * (selected?.productionYield || 1))),
              );
            }}
          >
            <option value="">Pilih bahan setengah jadi / bahan jadi...</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={!i.recipe.length || i.ready === false}>
                {i.name}
                {!i.recipe.length
                  ? " (resep belum diatur)"
                  : i.ready === false
                    ? " (resep perlu diperiksa)"
                    : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Jumlah Batch *
          <input
            type="number"
            name="batchCount"
            min="0.001"
            max="1000000000"
            step="0.001"
            required
            value={batchCount}
            onChange={(e) => {
              setBatchCount(e.target.value);
              setQuantity(
                String(
                  inventoryRound(
                    Number(e.target.value) * (item?.productionYield || 1) +
                      Number(reuseQuantity || 0),
                  ),
                ),
              );
            }}
          />
        </label>
        <label className="field sm:col-span-2">
          Gunakan sisa produksi (opsional)
          <select
            name="reuseBatchId"
            value={reuseBatchId}
            onChange={(e) => {
              setReuseBatchId(e.target.value);
              const r = remainders.find((b) => b.id === e.target.value);
              const qty = r?.quantity || 0;
              setReuseQuantity(String(qty));
              setQuantity(
                String(inventoryRound(Number(batchCount) * (item?.productionYield || 1) + qty)),
              );
            }}
          >
            <option value="">Tanpa sisa produksi</option>
            {remainders
              .filter((r) => r.itemId === itemId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} - {quantityLabel(r.quantity, r.unit)} tersedia
                </option>
              ))}
          </select>
          <span className="text-xs font-normal text-slate-500">
            Sisa harus berasal dari bahan hasil produksi yang sama. Bahan resep tetap mengikuti
            jumlah batch baru.
          </span>
        </label>
        {selectedRemainder ? (
          <label className="field">
            Jumlah sisa dipakai ({selectedRemainder.unit.toLowerCase()}) *
            <input
              type="number"
              name="reuseQuantity"
              required
              min="0.001"
              step="0.001"
              max={selectedRemainder.quantity}
              value={reuseQuantity}
              onChange={(e) => {
                setReuseQuantity(e.target.value);
                setQuantity(
                  String(
                    inventoryRound(
                      Number(batchCount) * (item?.productionYield || 1) +
                        Number(e.target.value || 0),
                    ),
                  ),
                );
              }}
            />
          </label>
        ) : (
          <input type="hidden" name="reuseQuantity" value="0" />
        )}
        <label className="field">
          Jumlah Diproduksi Aktual{item ? " (" + item.unit.toLowerCase() + ")" : ""} *
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
          <span className="text-xs font-normal text-slate-500">Isi total hasil aktual, termasuk bagian yang akan disimpan sebagai sisa. Pisahkan bagian tersebut melalui submenu Sisa Produksi setelah produksi tersimpan.</span>
        </label>
        <label className="field">
          Tanggal *<LocalInput type="date" name="date" defaultValue={today} max={today} required />
        </label>
        {item && (
          <div className="rounded-xl bg-emerald-50 p-4 text-sm sm:col-span-2">
            <p className="font-semibold">Kebutuhan bahan untuk {batchCount || "0"} batch</p>
            <p className="mt-1 text-xs">
              Hasil standar:{" "}
              {quantityLabel(Number(batchCount) * (item.productionYield || 1), item.unit)}.
              Sesuaikan jumlah diproduksi aktual setelah diukur; jumlah bahan mengikuti batch.
            </p>
            <ul className="mt-2 space-y-1">
              {item.recipe.map((row) => (
                <li key={row.ingredientId + row.unit}>
                  {row.name}:{" "}
                  {quantityLabel(inventoryRound(Number(batchCount) * row.quantity), row.unit)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-600">
              {selectedRemainder && (
                <>
                  Sisa tambahan: {quantityLabel(Number(reuseQuantity || 0), selectedRemainder.unit)}
                  . Hasil standar gabungan:{" "}
                  {quantityLabel(
                    Number(batchCount) * (item.productionYield || 1) + Number(reuseQuantity || 0),
                    item.unit,
                  )}
                  .{" "}
                </>
              )}
              Bahan dipakai dari batch paling awal (FIFO). Modal bahan dipindahkan ke batch hasil
              produksi.
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
        disabled={!item?.recipe.length || item.ready === false || Number(quantity) <= 0}
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

export function LegacyWarehouseForm({
  id,
  version,
  name,
  today,
}: {
  id: string;
  version: string;
  name: string;
  today: string;
}) {
  const { state, action, pending, postingKey, close } = useInventoryForm(
    reclassifyWarehouseStock,
    "/stok-inventory?tab=stock&stage=FINISHED",
  );
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="postingKey" value={postingKey} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="date" value={today} />
      <fieldset disabled={pending} className="space-y-4">
        <p className="text-sm">
          Batch lama untuk <strong>{name}</strong> akan dipindahkan ke barang stok gudang terpisah.
          Jumlah, nilai perolehan dan riwayat batch tetap tersimpan. Menu jual, harga jual dan
          resepnya tetap dipertahankan.
        </p>
        <label className="field">
          Nama bahan jadi gudang *
          <input
            name="warehouseName"
            required
            maxLength={150}
            defaultValue={name.slice(0, 130) + " (Stok Gudang)"}
          />
        </label>
        <p className="text-xs text-slate-500">
          Setelah dipisahkan, barang dapat dikirim melalui Control Stok. Atur resep menu jual untuk
          menunjuk barang ini jika memang digunakan oleh menu tersebut.
        </p>
      </fieldset>
      <Footer state={state} pending={pending} close={close} label="Pisahkan Stok Gudang" />
    </Form>
  );
}

export function InventoryItemLifecycleForm({
  item,
  operation,
  today,
  blocked = "",
  ownRecipes = 0,
}: {
  item: { id: string; name: string; version: string };
  operation: "ARCHIVE" | "RESTORE" | "DELETE";
  today: string;
  blocked?: string;
  ownRecipes?: number;
}) {
  const { state, action, pending, postingKey, close } = useInventoryForm(
    changeInventoryItemStatus,
    "/stok-inventory?tab=stock&status=" + (operation === "RESTORE" ? "active" : "inactive"),
  );
  const [confirmation, setConfirmation] = useState("");
  const label =
    operation === "ARCHIVE"
      ? "Pindahkan ke Sampah"
      : operation === "RESTORE"
        ? "Kembalikan Bahan"
        : "Hapus Permanen";
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="version" value={item.version} />
      <input type="hidden" name="postingKey" value={postingKey} />
      <input type="hidden" name="date" value={today} />
      <input type="hidden" name="operation" value={operation} />
      <p className="font-semibold break-words">{item.name}</p>
      <p className="mt-3 text-sm text-slate-600">
        {operation === "ARCHIVE"
          ? "Bahan dipindahkan ke Sampah dan tidak tersedia untuk transaksi baru. Stok, nilai stok, dan riwayat tetap tersimpan. Bahan dapat dikembalikan kapan saja."
          : operation === "RESTORE"
            ? "Bahan akan kembali Aktif dan tersedia untuk transaksi baru. Stok dan riwayat tetap sama."
            : "Penghapusan permanen tidak dapat dibatalkan. Hanya bahan tanpa stok dan riwayat transaksi yang dapat dihapus."}
      </p>
      {operation === "DELETE" &&
        (blocked ? (
          <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            {blocked}
          </p>
        ) : (
          <>
            {ownRecipes > 0 && (
              <p className="mt-3 text-sm text-red-700">Resep milik bahan ini juga akan dihapus.</p>
            )}
            <label className="field mt-4">
              Ketik nama bahan untuk konfirmasi
              <input
                className="input mt-2 w-full"
                name="confirmationName"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                required
              />
            </label>
          </>
        ))}
      <Footer
        state={state}
        pending={pending}
        close={close}
        label={label}
        danger={operation !== "RESTORE"}
        disabled={operation === "DELETE" && (!!blocked || confirmation !== item.name)}
      />
    </Form>
  );
}

export function InventoryRemainderForm({
  batches,
  today,
}: {
  batches: RemainderBatchOption[];
  today: string;
}) {
  const { state, action, pending, postingKey, close } = useInventoryForm(
      saveProductionRemainder,
      "/produksi-gudang?tab=sisa",
    ),
    [batchId, setBatchId] = useState(""),
    [quantity, setQuantity] = useState("");
  const batch = batches.find((b) => b.id === batchId);
  return (
    <Form action={action} pending={pending}>
      <input type="hidden" name="postingKey" value={postingKey} />
      <input type="hidden" name="version" value={batch?.version ?? ""} />
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 sm:col-span-2">
          Pilih sisa hasil olahan yang masih dapat dipakai. Jumlah dan nilainya dipindahkan dari
          batch asal, bukan ditambahkan sebagai stok baru. Jika hasil utama 6.000 gram dan sisa 200
          gram, catat produksi total 6.200 gram terlebih dahulu, lalu pisahkan sisa 200 gram di
          sini.
        </p>
        <label className="field sm:col-span-2">
          Batch hasil produksi asal *
          <select
            name="sourceBatchId"
            required
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setQuantity("");
            }}
          >
            <option value="">Pilih batch produksi...</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} - {quantityLabel(b.quantity, b.unit)} tersedia
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Jumlah sisa{batch ? " (" + batch.unit.toLowerCase() + ")" : ""} *
          <input
            type="number"
            name="quantity"
            required
            min="0.001"
            step="0.001"
            max={batch?.quantity || 1000000000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="field">
          Tanggal *<LocalInput type="date" name="date" defaultValue={today} max={today} required />
        </label>
        <label className="field sm:col-span-2">
          Lokasi penyimpanan
          <input name="location" maxLength={160} placeholder="Contoh: Gudang - rak bahan olahan" />
        </label>
        <label className="field sm:col-span-2">
          Catatan / kondisi sisa
          <textarea
            name="notes"
            maxLength={2000}
            rows={3}
            placeholder="Kondisi sisa dan keterangan penyimpanan..."
          />
        </label>
        {batch && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm sm:col-span-2">
            Perkiraan nilai yang dipindahkan:{" "}
            {rupiah(
              Math.round(
                Number(quantity || 0) * (batch.quantity > 0 ? batch.value / batch.quantity : 0),
              ),
            )}
            . Stok total dan nilai total gudang tetap sama.
          </p>
        )}
        {!batches.length && (
          <p className="text-sm text-amber-700 sm:col-span-2">
            Belum ada batch hasil produksi yang dapat dipisahkan. Catat produksi terlebih dahulu.
          </p>
        )}
      </fieldset>
      <Footer
        state={state}
        pending={pending}
        close={close}
        label="Simpan Sisa Produksi"
        disabled={!batch || Number(quantity) <= 0 || Number(quantity) > batch.quantity}
      />
    </Form>
  );
}
