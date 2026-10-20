import { parseCivilDate } from "@/lib/placements";
export const assetConditions = {
  BAIK: "Baik",
  RUSAK_RINGAN: "Rusak ringan",
  RUSAK_BERAT: "Rusak berat",
} as const;
export const assetStatuses = {
  DIGUNAKAN: "Digunakan",
  DISIMPAN: "Disimpan",
  PERBAIKAN: "Dalam perbaikan",
  NONAKTIF: "Tidak digunakan",
  DIJUAL: "Dijual",
} as const;
export const assetEvents = {
  CREATED: "Pendaftaran",
  UPDATED: "Perubahan data",
  MOVED: "Pemindahan",
} as const;
export function assetInvalid(message: string): never {
  const e = new Error(message);
  e.name = "AssetValidation";
  throw e;
}
function text(form: FormData, key: string, max: number, required = false) {
  const raw = form.get(key);
  if (raw != null && typeof raw !== "string") assetInvalid("Isian " + key + " tidak valid.");
  const value = String(raw ?? "").trim();
  if (value.length > max || (required && !value))
    assetInvalid("Lengkapi " + key + " (maksimal " + max + " karakter).");
  return value;
}
export function assetRequestKey(form: FormData) {
  const key = text(form, "requestKey", 36, true);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    assetInvalid("Formulir tidak valid. Tutup dan buka kembali.");
  return key;
}
export function isFixedAssetAccount(a: {
  kind: string;
  subGroup: string;
  active: boolean;
  code: string;
}) {
  return (
    a.active &&
    a.kind === "ASET" &&
    a.subGroup.trim().toUpperCase() === "ASET TETAP" &&
    !a.code.startsWith("159")
  );
}
export function parseAssetGeneral(form: FormData, today: string, automaticCode = false) {
  const code = automaticCode ? "" : text(form, "code", 40, true).toUpperCase();
  if (!automaticCode && !/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(code))
    assetInvalid(
      "Kode aset hanya boleh berisi huruf, angka, titik, garis miring, strip, dan garis bawah.",
    );
  const date = (key: string) => {
    const value = text(form, key, 10);
    if (!value) return null;
    let parsed;
    try {
      parsed = parseCivilDate(value);
    } catch {
      assetInvalid("Tanggal perolehan atau mulai pakai tidak valid.");
    }
    if (value > today) assetInvalid("Tanggal aset tidak boleh melebihi hari ini.");
    return parsed;
  };
  const acquiredAt = date("acquiredAt"),
    inUseAt = date("inUseAt");
  if (acquiredAt && inUseAt && inUseAt < acquiredAt)
    assetInvalid("Tanggal mulai pakai tidak boleh sebelum tanggal perolehan.");
  const raw = text(form, "acquisitionCost", 12);
  if (raw && !/^\d{1,12}$/.test(raw))
    assetInvalid("Harga perolehan harus rupiah bulat antara 0 dan 999.999.999.999.");
  const condition = text(form, "condition", 15, true),
    status = text(form, "status", 12, true),
    registrationType = text(form, "registrationType", 8, true);
  if (
    !Object.hasOwn(assetConditions, condition) ||
    !Object.hasOwn(assetStatuses, status) ||
    !["NEW", "EXISTING"].includes(registrationType)
  )
    assetInvalid("Kondisi, status, atau jenis pencatatan tidak valid.");
  const evidenceUrl = text(form, "evidenceUrl", 1000);
  if (evidenceUrl) {
    let url;
    try {
      url = new URL(evidenceUrl);
    } catch {
      assetInvalid("Link bukti tidak valid.");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      assetInvalid("Link bukti harus berupa alamat http atau https yang valid.");
  }
  return {
    code,
    name: text(form, "name", 160, true),
    categoryAccountId: text(form, "categoryAccountId", 100, true),
    brandModel: text(form, "brandModel", 160),
    serialNumber: text(form, "serialNumber", 100),
    registrationType,
    acquiredAt,
    inUseAt,
    acquisitionCost: raw ? BigInt(raw).toString() : null,
    invoiceNumber: text(form, "invoiceNumber", 100),
    evidenceUrl,
    responsibleName: text(form, "responsibleName", 160),
    condition,
    status,
    notes: text(form, "notes", 2000),
  };
}
export function parseAssetLocation(form: FormData) {
  const locationType = text(form, "locationType", 6, true);
  if (!["KANTOR", "OUTLET"].includes(locationType))
    assetInvalid("Pilih lokasi Kantor atau Outlet.");
  return {
    locationType,
    outletId: locationType === "OUTLET" ? text(form, "outletId", 100, true) : null,
    locationName: locationType === "KANTOR" ? text(form, "officeName", 160, true) : "",
    locationDetail: text(form, "locationDetail", 160),
  };
}
export function assetChangeReason(form: FormData) {
  return text(form, "changeReason", 1000);
}
export function assetMoney(value: bigint | string | null | undefined) {
  return value == null ? "—" : "Rp " + BigInt(value).toLocaleString("id-ID");
}
export function assetLocationLabel(row: {
  locationType: string;
  locationName: string;
  locationDetail?: string;
}) {
  return (
    (row.locationType === "KANTOR" ? "Kantor" : "Outlet") +
    " · " +
    row.locationName +
    (row.locationDetail ? " / " + row.locationDetail : "")
  );
}
export type AssetFormRecord = {
  id: string;
  version: string;
  code: string;
  name: string;
  categoryAccountId: string;
  categoryCode: string;
  categoryName: string;
  brandModel: string;
  serialNumber: string;
  registrationType: string;
  acquiredAt: string;
  inUseAt: string;
  acquisitionCost: string | null;
  invoiceNumber: string;
  evidenceUrl: string;
  locationType: string;
  outletId: string | null;
  locationName: string;
  locationDetail: string;
  responsibleName: string;
  condition: string;
  status: string;
  notes: string;
};
export type AssetChoices = {
  accounts: { id: string; code: string; name: string }[];
  outlets: { id: string; name: string }[];
  people: string[];
};

export type AssetActionState = { error?: string; success?: string; assetCode?: string };
