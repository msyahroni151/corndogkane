"use client";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { manageOutletStock } from "@/app/outlet-stock-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { warehouseKindNames } from "@/lib/inventory";
import { quantityLabel } from "@/lib/goods-receipts";
import type { FormState } from "@/lib/form-state";
export type OutletStockOptions = {
  outlets: { id: string; name: string }[];
  items: { id: string; name: string; kind?: string; unit: string; warehouse: number }[];
  balances: { outletId: string; itemId: string; quantity: number; version: number }[];
};
function StockForm({
  children,
  label,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(manageOutletStock, {}),
    [key] = useState(() => crypto.randomUUID()),
    close = useCloseFormDialog(),
    router = useRouter(),
    handled = useRef(false);
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.refresh();
    }
  }, [state.success, pending, close, router]);
  return (
    <form
      action={action}
      aria-busy={pending}
      className="panel p-6"
      onReset={(e) => e.preventDefault()}
    >
      <input type="hidden" name="requestKey" value={key} />
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="button-secondary" disabled={pending} onClick={close}>
          Batal
        </button>
        <button className="button-primary" disabled={pending || disabled}>
          {pending ? "Menyimpan..." : label}
        </button>
      </div>
    </form>
  );
}
export function OutletRequestForm({
  options,
  outletId = "",
}: {
  options: OutletStockOptions;
  outletId?: string;
}) {
  const [outlet, setOutlet] = useState(outletId),
    [rows, setRows] = useState([{ key: "first", itemId: "", quantity: "" }]);
  const patch = (key: string, data: Partial<(typeof rows)[number]>) =>
    setRows((old) => old.map((r) => (r.key === key ? { ...r, ...data } : r)));
  return (
    <StockForm
      label="Simpan Permintaan"
      disabled={!outlet || !rows.every((r) => r.itemId && Number(r.quantity) > 0)}
    >
      <input type="hidden" name="kind" value="REQUEST" />
      <input type="hidden" name="lines" value={JSON.stringify(rows)} />
      <label className="field">
        Outlet *
        <select name="outletId" required value={outlet} onChange={(e) => setOutlet(e.target.value)}>
          <option value="">Pilih outlet...</option>
          {options.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Nama pemohon / crew *
        <input
          name="requesterName"
          required
          maxLength={160}
          placeholder="Nama crew yang meminta barang"
        />
      </label>
      <p className="text-xs text-slate-500">
        Permintaan belum mengubah stok. Gudang memeriksa stok outlet sebelum mengirim barang.
      </p>
      {rows.map((row, index) => {
        const item = options.items.find((i) => i.id === row.itemId),
          stock = options.balances.find((b) => b.outletId === outlet && b.itemId === row.itemId);
        return (
          <div key={row.key} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <label className="field">
              Barang #{index + 1}
              <select
                required
                value={row.itemId}
                onChange={(e) => patch(row.key, { itemId: e.target.value, quantity: "" })}
              >
                <option value="">Pilih barang stok outlet...</option>
                {options.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit.toLowerCase()})
                    {i.kind ? " · " + warehouseKindNames[i.kind] : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Jumlah diminta {item ? "(" + item.unit.toLowerCase() + ")" : ""} *
              <input
                type="number"
                min="0.001"
                max="1000000000"
                step="0.001"
                required
                value={row.quantity}
                onChange={(e) => patch(row.key, { quantity: e.target.value })}
              />
            </label>
            {item && (
              <p className="text-xs text-slate-500">
                Stok outlet: {stock ? quantityLabel(stock.quantity, item.unit) : "belum dicatat"} ·
                Gudang: {quantityLabel(item.warehouse, item.unit)}
              </p>
            )}
            {rows.length > 1 && (
              <button
                type="button"
                className="text-xs text-red-700"
                onClick={() => setRows((old) => old.filter((r) => r.key !== row.key))}
              >
                Hapus barang
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="button-secondary w-full"
        disabled={rows.length >= 50}
        onClick={() =>
          setRows((old) => [...old, { key: crypto.randomUUID(), itemId: "", quantity: "" }])
        }
      >
        + Tambah Barang
      </button>
      <label className="field">
        Catatan
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Kebutuhan untuk penjualan berikutnya..."
        />
      </label>
    </StockForm>
  );
}
export function OutletPhysicalForm({
  options,
  outletId = "",
}: {
  options: OutletStockOptions;
  outletId?: string;
}) {
  const [outlet, setOutlet] = useState(outletId),
    [itemId, setItem] = useState(""),
    [kind, setKind] = useState("COUNT"),
    [qty, setQty] = useState("");
  const item = options.items.find((i) => i.id === itemId),
    balance = options.balances.find((b) => b.outletId === outlet && b.itemId === itemId);
  return (
    <StockForm
      label={kind === "COUNT" ? "Simpan Hasil Hitung" : "Simpan Pemakaian / Susut"}
      disabled={!outlet || !itemId || qty === "" || (kind !== "COUNT" && !balance)}
    >
      <input type="hidden" name="version" value={balance?.version ?? -1} />
      <label className="field">
        Jenis pencatatan
        <select
          name="kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setQty("");
          }}
        >
          <option value="COUNT">Stok awal / hitung fisik</option>
          <option value="USE">Pemakaian untuk penjualan (manual)</option>
          <option value="LOSS">Susut / rusak di outlet</option>
        </select>
      </label>
      <label className="field">
        Outlet *
        <select
          name="outletId"
          required
          value={outlet}
          onChange={(e) => {
            setOutlet(e.target.value);
            setQty("");
          }}
        >
          <option value="">Pilih outlet...</option>
          {options.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Barang *
        <select
          name="itemId"
          required
          value={itemId}
          onChange={(e) => {
            setItem(e.target.value);
            setQty("");
          }}
        >
          <option value="">Pilih barang stok outlet...</option>
          {options.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit.toLowerCase()}){i.kind ? " · " + warehouseKindNames[i.kind] : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-xl bg-slate-50 p-3 text-sm">
        Stok tercatat:{" "}
        {balance && item ? quantityLabel(balance.quantity, item.unit) : "Belum ada stok awal"}
      </p>
      <label className="field">
        {kind === "COUNT" ? "Jumlah fisik yang ada sekarang" : "Jumlah terpakai / susut"}{" "}
        {item ? "(" + item.unit.toLowerCase() + ")" : ""} *
        <input
          name="quantity"
          required
          type="number"
          min={kind === "COUNT" ? "0" : "0.001"}
          max={kind === "COUNT" ? 1000000000 : (balance?.quantity ?? 0)}
          step="0.001"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>
      <p className="text-xs text-slate-500">
        {kind === "COUNT"
          ? "Hitung sebelum menerima kiriman yang masih berstatus Dalam pengiriman. Isi 0 jika stok benar-benar habis. Nilai rupiah stok awal yang belum diketahui tidak akan diasumsikan nol."
          : "Catat bahan yang benar-benar dipakai. Pemakaian ini belum otomatis dari POS; hindari mencatat transaksi yang sama dua kali."}
      </p>
      <label className="field">
        Catatan / referensi *
        <textarea
          name="notes"
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          placeholder="Contoh: hasil hitung akhir shift / pemakaian rekap penjualan 25 Oktober..."
        />
      </label>
    </StockForm>
  );
}
export function OutletOrderAction({
  id,
  version,
  kind,
  label,
  children,
}: {
  id: string;
  version: number;
  kind: "SEND" | "RECEIVE" | "CANCEL";
  label: string;
  children: ReactNode;
}) {
  return (
    <StockForm label={label}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="orderId" value={id} />
      <input type="hidden" name="version" value={version} />
      {children}
    </StockForm>
  );
}
