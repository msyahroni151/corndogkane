import { inventoryRound, recipeIngredientAllowed } from "@/lib/inventory";
export type RecipeCostItem = {
  id: string;
  name: string;
  kind: string;
  baseUnit: string;
  active: boolean;
  version: string;
  sellingPrice: number;
  productionYield?: number;
  recipe: { ingredientId: string; quantity: number; baseUnit: string }[];
  batches: {
    baseUnit: string;
    remainingQuantity: number;
    remainingValue: number;
    initialQuantity: number;
    initialValue: number;
  }[];
};
export type CostLine = {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  cost: number | null;
  source: string;
};
export function recipeCost(item: RecipeCostItem, items: readonly RecipeCostItem[]) {
  const index = new Map(items.map((i) => [i.id, i]));
  function unitCost(
    id: string,
    unit: string,
    seen: Set<string>,
  ): { cost: number | null; source: string } {
    const ingredient = index.get(id);
    if (!ingredient?.active || ingredient.baseUnit !== unit)
      return { cost: null, source: "Bahan / satuan belum sesuai" };
    const batches = ingredient.batches.filter((b) => b.baseUnit === unit),
      quantity = batches.reduce((s, b) => s + b.remainingQuantity, 0);
    if (quantity > 0)
      return {
        cost: inventoryRound(batches.reduce((s, b) => s + b.remainingValue, 0) / quantity, 4),
        source: "Rata-rata stok gudang",
      };
    const last = [...batches].reverse().find((b) => b.initialQuantity > 0);
    if (last)
      return {
        cost: inventoryRound(last.initialValue / last.initialQuantity, 4),
        source: "Batch gudang terakhir",
      };
    if (
      ["SUB", "FINISHED"].includes(ingredient.kind) &&
      ingredient.recipe.length &&
      !seen.has(id)
    ) {
      const visited = new Set(seen);
      visited.add(id);
      let total = 0;
      for (const r of ingredient.recipe) {
        const child = index.get(r.ingredientId);
        if (!child || !recipeIngredientAllowed(ingredient.kind, child.kind))
          return { cost: null, source: "Resep sub produk belum sesuai" };
        const part = unitCost(r.ingredientId, r.baseUnit, visited);
        if (part.cost === null)
          return { cost: null, source: "Biaya bahan sub produk belum tersedia" };
        total += part.cost * r.quantity;
      }
      return {
        cost: inventoryRound(total / (ingredient.productionYield || 1), 4),
        source: "Estimasi resep sub produk",
      };
    }
    return { cost: null, source: "Belum ada harga perolehan" };
  }
  const lines: CostLine[] = item.recipe.map((r) => {
    if (!Number.isFinite(r.quantity) || r.quantity <= 0)
      return {
        ingredientId: r.ingredientId,
        name: index.get(r.ingredientId)?.name || "Bahan belum dipilih",
        quantity: r.quantity,
        unit: r.baseUnit,
        unitCost: null,
        cost: null,
        source: "Takaran belum diisi",
      };
    const ingredient = index.get(r.ingredientId),
      valid =
        ingredient &&
        ingredient.id !== item.id &&
        recipeIngredientAllowed(item.kind, ingredient.kind);
    const price = valid
      ? unitCost(r.ingredientId, r.baseUnit, new Set([item.id]))
      : { cost: null, source: "Jenis bahan tidak sesuai" };
    return {
      ingredientId: r.ingredientId,
      name: ingredient?.name || "Bahan tidak ditemukan",
      quantity: r.quantity,
      unit: r.baseUnit,
      unitCost: price.cost,
      cost: price.cost === null ? null : inventoryRound(price.cost * r.quantity, 4),
      source: price.source,
    };
  });
  const complete = lines.length > 0 && lines.every((l) => l.cost !== null);
  return {
    lines,
    total: complete
      ? inventoryRound(
          lines.reduce((s, l) => s + (l.cost ?? 0), 0) /
            (item.kind === "PRODUCT" ? 1 : item.productionYield || 1),
          4,
        )
      : null,
    complete,
  };
}
