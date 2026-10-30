export const inventoryTabs = [
  { key: "stock", name: "Stok & Batch", icon: "boxes" },
  { key: "susut", name: "Susut", icon: "alert" },
  { key: "opname", name: "Hitung Stok", icon: "check" },
] as const;
export const settingMenuTabs = [
  { key: "produk", name: "Produk", icon: "tag" },
  { key: "subproduk", name: "Sub Produk", icon: "box" },
  { key: "resep", name: "Resep & HPP", icon: "receipt" },
] as const;
export { defaultStockUnits as stockUnits } from "@/lib/stock-units";
export const warehouseKinds = ["RAW", "SUB", "FINISHED"] as const;
export const warehouseKindNames: Record<string, string> = {
  RAW: "Bahan Mentah",
  SUB: "Bahan Setengah Jadi",
  FINISHED: "Bahan Jadi",
};
export const recipeIngredientAllowed = (output: string, ingredient: string) =>
  output === "SUB"
    ? ingredient === "RAW"
    : output === "FINISHED"
      ? ["RAW", "SUB"].includes(ingredient)
      : output === "PRODUCT" && warehouseKinds.some((kind) => kind === ingredient);
export const catalogKinds = ["RAW", "PRODUCT", "SUB", "FINISHED"] as const;
export const kindNames: Record<string, string> = {
  RAW: "Bahan Baku",
  FINISHED: "Bahan Jadi",
  PRODUCT: "Produk",
  SUB: "Sub Produk",
};
export const inventoryRound = (value: number, decimals = 3) => Number(value.toFixed(decimals));
export function inventoryNumber(value: unknown, allowZero = false, max = 1_000_000_000) {
  const raw = String(value ?? "");
  if (
    !/^\d{1,10}(\.\d{1,3})?$/.test(raw) ||
    Number(raw) < 0 ||
    (!allowZero && Number(raw) === 0) ||
    Number(raw) > max
  )
    throw Error("Jumlah harus valid, maksimal 1 miliar dengan 3 angka desimal.");
  return Number(raw);
}
export function changedBatch(
  kind: string,
  before: number,
  value: number,
  quantity: number,
  initialQuantity: number,
  initialValue: number,
) {
  const after = inventoryRound(
    kind === "PREP" || kind === "LOSS" || kind === "DAILY" ? before - quantity : quantity,
  );
  if (after < 0) throw Error("Jumlah melebihi stok batch yang tersedia.");
  if (kind === "PREP" && (after <= 0 || after >= before))
    throw Error(
      "Susut prep harus lebih dari 0 dan menyisakan stok. Gunakan susut harian untuk barang rusak seluruhnya.",
    );
  const afterValue =
    kind === "PREP"
      ? value
      : after === 0
        ? 0
        : inventoryRound(after * (before > 0 ? value / before : initialValue / initialQuantity), 4);
  if (!Number.isFinite(afterValue) || afterValue < 0 || afterValue > 1_000_000_000)
    throw Error("Nilai stok setelah koreksi melewati batas Rp1 miliar per batch.");
  return { after, value: afterValue };
}
export type BatchOption = {
  id: string;
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  value: number;
  initialQuantity: number;
  initialValue: number;
  version: number;
  date: string;
  label: string;
};
export type RecipeDraft = { ingredientId: string; quantity: string; baseUnit: string };
export type CatalogDraft = {
  id?: string;
  version?: string;
  name: string;
  kind: string;
  category: string;
  baseUnit: string;
  minimumStock: string;
  active: boolean;
  emoji: string;
  sellingPrice: string;
  standardCost: string;
  recipe: RecipeDraft[];
};
export type SubProductOption = {
  productionYield?: number;
  ready?: boolean;
  version: string;
  id: string;
  name: string;
  unit: string;
  recipe: { ingredientId: string; name: string; quantity: number; unit: string }[];
};

export type RemainderBatchOption = {
  id: string;
  itemId: string;
  label: string;
  unit: string;
  quantity: number;
  value: number;
  version: number;
};
