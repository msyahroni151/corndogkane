"use client";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { manageStockReturn } from "@/app/stock-return-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { quantityLabel } from "@/lib/goods-receipts";
import { rupiah } from "@/lib/money";
import type { FormState } from "@/lib/form-state";
export type ReturnOptions = {
  outlets: { id: string; name: string }[];
  stocks: {
    outletId: string;
    itemId: string;
    name: string;
    unit: string;
    quantity: number;
    active: boolean;
  }[];
};
export type ReturnReceiptItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  receivedQuantity: number;
  value: number | null;
};
function ReturnForm({
  children,
  label,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(manageStockReturn, {}),
    [key] = useState(() => crypto.randomUUID()),
    handled = useRef(false),
    router = useRouter(),
    close = useCloseFormDialog();
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
      className="panel p-6"
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
    >
      <input type="hidden" name="requestKey" value={key} />
      <fieldset className="min-w-0 space-y-4" disabled={pending}>
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button className="button-secondary" type="button" onClick={close} disabled={pending}>
          Batal
        </button>
        <button className="button-primary" disabled={pending || disabled}>
          {pending ? "Menyimpan…" : label}
        </button>
      </div>
    </form>
  );
}
export function CreateReturnForm({
  options,
  outletId = "",
}: {
  options: ReturnOptions;
  outletId?: string;
}) {
  const [outlet, setOutlet] = useState(outletId),
    [rows, setRows] = useState([{ key: "first", itemId: "", quantity: "" }]);
  const stocks = options.stocks.filter((s) => s.outletId === outlet),
    patch = (key: string, data: Partial<(typeof rows)[number]>) =>
      setRows((old) => old.map((row) => (row.key === key ? { ...row, ...data } : row)));
  return (
    <ReturnForm
      label="Ajukan Retur"
      disabled={!outlet || !rows.every((r) => r.itemId && Number(r.quantity) > 0)}
    >
      <input type="hidden" name="kind" value="CREATE" />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(rows.map((r) => ({ itemId: r.itemId, quantity: r.quantity })))}
      />
      <label className="field">
        Outlet asal *
        <select
          name="outletId"
          value={outlet}
          required
          onChange={(e) => {
            setOutlet(e.target.value);
            setRows([{ key: crypto.randomUUID(), itemId: "", quantity: "" }]);
          }}
        >
          <option value="">Pilih outlet…</option>
          {options.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Nama petugas / crew *<input name="requesterName" required maxLength={160} />
      </label>
      <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
        Tujuan: Gudang Pusat. Pengajuan dan persetujuan belum mengubah stok. Retur ini untuk barang
        layak pakai; barang rusak/spoil dicatat terpisah.
      </p>
      {rows.map((r, index) => {
        const item = stocks.find((s) => s.itemId === r.itemId);
        return (
          <div key={r.key} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <label className="field">
              Barang #{index + 1}
              <select
                required
                value={r.itemId}
                onChange={(e) => patch(r.key, { itemId: e.target.value, quantity: "" })}
              >
                <option value="">Pilih barang stok outlet…</option>
                {stocks.map((s) => (
                  <option key={s.itemId} value={s.itemId}>
                    {s.name} ({s.unit.toLowerCase()}){s.active ? "" : " · Sampah"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Jumlah dikembalikan *
              <input
                type="number"
                min="0.001"
                max={item?.quantity || 1000000000}
                step="0.001"
                required
                value={r.quantity}
                onChange={(e) => patch(r.key, { quantity: e.target.value })}
              />
            </label>
            {item && (
              <p className="text-xs text-slate-500">
                Stok outlet sekarang: {quantityLabel(item.quantity, item.unit)}. Diperiksa ulang
                saat pengiriman.
              </p>
            )}
            {rows.length > 1 && (
              <button
                type="button"
                className="text-xs text-red-700"
                onClick={() => setRows((old) => old.filter((l) => l.key !== r.key))}
              >
                Hapus barang
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="button-secondary"
        disabled={rows.length >= 50 || !outlet}
        onClick={() =>
          setRows((old) => [...old, { key: crypto.randomUUID(), itemId: "", quantity: "" }])
        }
      >
        + Tambah Barang
      </button>
      <label className="field">
        Alasan retur *
        <textarea
          name="notes"
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          placeholder="Contoh: kelebihan stok hasil sidak lapangan"
        />
      </label>
    </ReturnForm>
  );
}
export function ReturnActionForm({
  id,
  version,
  kind,
  label,
  children,
}: {
  id: string;
  version: number;
  kind: "APPROVE" | "SEND" | "CANCEL" | "REJECT";
  label: string;
  children: ReactNode;
}) {
  return (
    <ReturnForm label={label}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="kind" value={kind} />
      {children}
      <label className="field">
        Catatan {kind === "CANCEL" || kind === "REJECT" ? "*" : "(opsional)"}
        <textarea
          name="notes"
          maxLength={2000}
          minLength={kind === "CANCEL" || kind === "REJECT" ? 3 : undefined}
          required={kind === "CANCEL" || kind === "REJECT"}
          rows={3}
        />
      </label>
    </ReturnForm>
  );
}
export function ReceiveReturnForm({
  id,
  version,
  items,
}: {
  id: string;
  version: number;
  items: ReturnReceiptItem[];
}) {
  const [rows, setRows] = useState(() =>
    items
      .filter((l) => l.receivedQuantity < l.quantity)
      .map((l) => ({
        ...l,
        receive: String(Number((l.quantity - l.receivedQuantity).toFixed(3))),
        manual: "",
      })),
  );
  const patch = (id: string, data: Partial<(typeof rows)[number]>) =>
    setRows((old) => old.map((l) => (l.id === id ? { ...l, ...data } : l)));
  return (
    <ReturnForm
      label="Konfirmasi Penerimaan Gudang"
      disabled={!rows.some((l) => Number(l.receive) > 0)}
    >
      <input type="hidden" name="kind" value="RECEIVE" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          rows.map((l) => ({
            lineId: l.id,
            quantity: l.receive || "0",
            manualValue: l.value === null && Number(l.receive) > 0 ? l.manual || null : null,
          })),
        )}
      />
      <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
        Isi jumlah barang layak pakai yang benar-benar sudah tiba. Jika ada selisih atau barang
        rusak, terima hanya jumlah layak pakai dan jelaskan di catatan; sisanya tetap tercatat dalam
        perjalanan.
      </p>
      {rows.map((l) => (
        <div key={l.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-bold">{l.name}</p>
          <p className="text-xs text-slate-500">
            Dikirim {quantityLabel(l.quantity, l.unit)} · Sudah diterima{" "}
            {quantityLabel(l.receivedQuantity, l.unit)}
          </p>
          <label className="field">
            Jumlah diterima ({l.unit.toLowerCase()})
            <input
              type="number"
              min="0"
              max={Number((l.quantity - l.receivedQuantity).toFixed(3))}
              step="0.001"
              required
              value={l.receive}
              onChange={(e) => patch(l.id, { receive: e.target.value })}
            />
          </label>
          {l.value === null && Number(l.receive) > 0 ? (
            <label className="field">
              Nilai perolehan jumlah yang diterima (Rp) *
              <input
                inputMode="numeric"
                required
                maxLength={18}
                value={l.manual.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                onChange={(e) => patch(l.id, { manual: e.target.value.replace(/\D/g, "") })}
              />
              <span className="text-xs font-normal text-amber-700">
                Nilai asal belum tercatat. Isi berdasarkan bukti perolehan; nilai manual akan
                ditandai dalam audit.
              </span>
            </label>
          ) : (
            <p className="text-xs text-slate-500">
              Nilai seluruh kiriman: {l.value === null ? "belum tersedia" : rupiah(l.value)}. Nilai
              penerimaan dibawa otomatis secara proporsional.
            </p>
          )}
        </div>
      ))}
      <label className="field">
        Catatan penerimaan *
        <textarea
          name="notes"
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          placeholder="Kondisi barang, jumlah diterima, atau alasan selisih…"
        />
      </label>
    </ReturnForm>
  );
}
