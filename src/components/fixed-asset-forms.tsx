"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { LocalInput } from "@/components/local-input";
import { notifySuccess } from "@/components/notification-toasts";
import { createFixedAsset, updateFixedAsset, moveFixedAsset } from "@/app/fixed-asset-actions";
import {
  assetConditions,
  assetStatuses,
  assetLocationLabel,
  type AssetChoices,
  type AssetActionState,
  type AssetFormRecord,
} from "@/lib/fixed-assets";
import type { FormState } from "@/lib/form-state";
function useAssetAction(save: typeof createFixedAsset, code: string) {
  const [state, action, pending] = useActionState<AssetActionState, FormData>(save, {}),
    [key, setKey] = useState("");
  const close = useCloseFormDialog(),
    router = useRouter(),
    handled = useRef(false);
  useEffect(() => setKey(crypto.randomUUID()), []);
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      notifySuccess(state.success);
      close?.();
      router.push(
        "/finance/aset-tetap?tab=daftar&q=" + encodeURIComponent((state.assetCode || code).trim()),
      );
      router.refresh();
    }
  }, [state.success, state.assetCode, pending, close, router, code]);
  return { state, action, pending, key, close };
}
function LocationFields({ choices, record }: { choices: AssetChoices; record?: AssetFormRecord }) {
  const [type, setType] = useState(record?.locationType || "KANTOR");
  return (
    <>
      <label className="field">
        Jenis lokasi *
        <select
          aria-label="Jenis lokasi"
          name="locationType"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="KANTOR">Kantor</option>
          <option value="OUTLET">Outlet</option>
        </select>
      </label>
      {type === "KANTOR" ? (
        <label className="field">
          Nama kantor *
          <input
            aria-label="Nama kantor"
            name="officeName"
            maxLength={160}
            required
            defaultValue={record?.locationType === "KANTOR" ? record.locationName : ""}
            placeholder="Contoh: Kantor pusat"
          />
        </label>
      ) : (
        <label className="field">
          Outlet tujuan *
          <select
            aria-label="Outlet tujuan"
            name="outletId"
            required
            defaultValue={record?.outletId || ""}
          >
            <option value="">Pilih outlet...</option>
            {choices.outlets.map((o) => (
              <option value={o.id} key={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field asset-span">
        Detail lokasi
        <input
          name="locationDetail"
          aria-label="Detail lokasi"
          maxLength={160}
          defaultValue={record?.locationDetail || ""}
          placeholder="Ruangan, lantai, atau titik penyimpanan"
        />
      </label>
    </>
  );
}
function PersonField({ choices, value }: { choices: AssetChoices; value?: string }) {
  const id = useId();
  return (
    <label className="field">
      Penanggung jawab
      <input
        aria-label="Penanggung jawab"
        name="responsibleName"
        list={id}
        maxLength={160}
        defaultValue={value || ""}
        placeholder="Pilih atau ketik nama"
      />
      <datalist id={id}>
        {choices.people.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </label>
  );
}
function Footer({
  state,
  pending,
  ready,
  label,
  close,
}: {
  state: FormState;
  pending: boolean;
  ready: boolean;
  label: string;
  close: (() => void) | undefined;
}) {
  return (
    <>
      {state.error && (
        <p className="asset-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="asset-form-footer">
        <button type="button" className="button-secondary" disabled={pending} onClick={close}>
          Batal
        </button>
        <button className="button-primary" disabled={pending || !ready}>
          {pending ? "Menyimpan..." : label}
        </button>
      </div>
    </>
  );
}
export function FixedAssetForm({
  choices,
  record,
  today,
}: {
  choices: AssetChoices;
  record?: AssetFormRecord;
  today: string;
}) {
  const code = record?.code || "";
  const [cost, setCost] = useState(record?.acquisitionCost || "");
  const { state, action, pending, key, close } = useAssetAction(
    record ? updateFixedAsset : createFixedAsset,
    code,
  );
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="asset-form"
      aria-label={record ? "Edit aset" : "Tambah aset"}
      aria-busy={pending}
    >
      <fieldset disabled={pending}>
        <input type="hidden" name="requestKey" value={key} />
        {record && (
          <>
            <input type="hidden" name="id" value={record.id} />
            <input type="hidden" name="version" value={record.version} />
          </>
        )}
        <p className="asset-form-note">
          Satu baris untuk satu unit aset. Pendaftaran aset tidak otomatis mencatat pembayaran atau
          penyusutan.
        </p>
        <h3>Identitas aset</h3>
        <div className="asset-form-grid">
          <label className="field">
            Kode aset
            <input
              aria-label="Kode aset"
              name={record ? "code" : undefined}
              value={code || "Otomatis saat disimpan"}
              readOnly
            />
          </label>
          <label className="field">
            Nama aset *
            <input
              aria-label="Nama aset"
              name="name"
              required
              maxLength={160}
              defaultValue={record?.name || ""}
              placeholder="Contoh: Freezer 200 liter"
            />
          </label>
          <label className="field">
            Kategori / akun aset *
            <select
              aria-label="Kategori aset"
              name="categoryAccountId"
              required
              defaultValue={record?.categoryAccountId || ""}
            >
              <option value="">Pilih kategori...</option>
              {record && !choices.accounts.some((a) => a.id === record.categoryAccountId) && (
                <option value={record.categoryAccountId}>
                  {record.categoryCode} · {record.categoryName} (tersimpan)
                </option>
              )}
              {choices.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Jenis pencatatan
            <select
              aria-label="Jenis pencatatan"
              name="registrationType"
              defaultValue={record?.registrationType || "EXISTING"}
            >
              <option value="EXISTING">Pendataan aset lama</option>
              <option value="NEW">Aset baru</option>
            </select>
          </label>
          <label className="field">
            Merek / model
            <input
              aria-label="Merek / model"
              name="brandModel"
              maxLength={160}
              defaultValue={record?.brandModel || ""}
            />
          </label>
          <label className="field">
            Nomor seri
            <input
              aria-label="Nomor seri"
              name="serialNumber"
              maxLength={100}
              defaultValue={record?.serialNumber || ""}
            />
          </label>
        </div>
        <h3>Perolehan</h3>
        <div className="asset-form-grid">
          <label className="field">
            Tanggal perolehan
            <LocalInput
              aria-label="Tanggal perolehan"
              name="acquiredAt"
              type="date"
              max={today}
              defaultValue={record?.acquiredAt || ""}
            />
          </label>
          <label className="field">
            Tanggal mulai pakai
            <LocalInput
              aria-label="Tanggal mulai pakai"
              name="inUseAt"
              type="date"
              max={today}
              defaultValue={record?.inUseAt || ""}
            />
          </label>
          <label className="field">
            Harga perolehan (Rp)
            <input
              aria-label="Harga perolehan (Rp)"
              inputMode="numeric"
              value={cost.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              onChange={(e) => setCost(e.target.value.replace(/\D/g, "").slice(0, 12))}
              maxLength={15}
              placeholder="Kosongkan bila belum diketahui"
            />
            <input type="hidden" name="acquisitionCost" value={cost} />
          </label>
          <label className="field">
            Nomor nota / invoice
            <input
              name="invoiceNumber"
              aria-label="Nomor nota / invoice"
              maxLength={100}
              defaultValue={record?.invoiceNumber || ""}
            />
          </label>
          <label className="field asset-span">
            Link bukti pembelian / foto
            <input
              name="evidenceUrl"
              aria-label="Link bukti pembelian / foto"
              type="url"
              maxLength={1000}
              defaultValue={record?.evidenceUrl || ""}
              placeholder="https://..."
            />
          </label>
        </div>
        <p className="asset-help">
          Tanggal dan harga boleh dikosongkan jika data aset lama belum diketahui.
        </p>
        <h3>Lokasi & penanggung jawab</h3>
        {record ? (
          <p className="asset-current-location">
            {assetLocationLabel(record)}
            <small>Gunakan aksi Pindahkan untuk mengganti lokasi.</small>
          </p>
        ) : null}
        <div className="asset-form-grid">
          {!record && <LocationFields choices={choices} />}
          <PersonField choices={choices} value={record?.responsibleName} />
          <label className="field">
            Kondisi
            <select
              aria-label="Kondisi"
              name="condition"
              defaultValue={record?.condition || "BAIK"}
            >
              {Object.entries(assetConditions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Status
            <select
              aria-label="Status aset"
              name="status"
              defaultValue={record?.status || "DIGUNAKAN"}
            >
              {Object.entries(assetStatuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field asset-span">
            Catatan aset
            <textarea
              aria-label="Catatan aset"
              name="notes"
              rows={2}
              maxLength={2000}
              defaultValue={record?.notes || ""}
            />
          </label>
          {record && (
            <label className="field asset-span">
              Keterangan perubahan
              <textarea
                aria-label="Keterangan perubahan"
                name="changeReason"
                rows={2}
                maxLength={1000}
                placeholder="Opsional, dicatat di riwayat"
              />
            </label>
          )}
        </div>
        <Footer
          state={state}
          pending={pending}
          ready={!!key}
          label={record ? "Simpan perubahan" : "Simpan aset"}
          close={close}
        />
      </fieldset>
    </form>
  );
}
export function FixedAssetMoveForm({
  choices,
  record,
}: {
  choices: AssetChoices;
  record: AssetFormRecord;
}) {
  const { state, action, pending, key, close } = useAssetAction(moveFixedAsset, record.code);
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="asset-form"
      aria-label="Pindahkan aset"
      aria-busy={pending}
    >
      <fieldset disabled={pending}>
        <input type="hidden" name="requestKey" value={key} />
        <input type="hidden" name="id" value={record.id} />
        <input type="hidden" name="version" value={record.version} />
        <p className="asset-current-location">
          <strong>
            {record.code} · {record.name}
          </strong>
          <small>Lokasi sekarang: {assetLocationLabel(record)}</small>
        </p>
        <div className="asset-form-grid">
          <LocationFields choices={choices} record={record} />
          <PersonField choices={choices} value={record.responsibleName} />
          <label className="field asset-span">
            Keterangan pemindahan
            <textarea
              name="changeReason"
              aria-label="Keterangan pemindahan"
              maxLength={1000}
              rows={3}
              placeholder="Alasan atau catatan serah terima"
            />
          </label>
        </div>
        <p className="asset-help">
          Perubahan lokasi dan penanggung jawab disimpan di Riwayat Aset.
        </p>
        <Footer
          state={state}
          pending={pending}
          ready={!!key}
          label="Pindahkan aset"
          close={close}
        />
      </fieldset>
    </form>
  );
}
