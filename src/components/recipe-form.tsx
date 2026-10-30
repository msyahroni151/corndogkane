"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRecipe } from "@/app/recipe-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { recipeCost, type RecipeCostItem } from "@/lib/recipe-cost";
import { recipeIngredientAllowed, warehouseKindNames, type RecipeDraft } from "@/lib/inventory";
import type { FormState } from "@/lib/form-state";
const money = (n: number) => "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
export function RecipeForm({
  output,
  items,
  production = false,
}: {
  output: RecipeCostItem;
  items: RecipeCostItem[];
  production?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecipe, {}),
    [recipe, setRecipe] = useState<RecipeDraft[]>(() =>
      output.recipe.map((r) => ({ ...r, quantity: String(r.quantity) })),
    ),
    [yieldQuantity, setYieldQuantity] = useState(String(output.productionYield || 1)),
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
  const eligible = items.filter(
      (i) => i.active && i.id !== output.id && recipeIngredientAllowed(output.kind, i.kind),
    ),
    cost = recipeCost(
      {
        ...output,
        productionYield: production ? Number(yieldQuantity) : 1,
        recipe: recipe.map((r) => ({ ...r, quantity: Number(r.quantity) || 0 })),
      },
      items,
    );
  const patch = (index: number, data: Partial<RecipeDraft>) =>
    setRecipe((old) => old.map((r, i) => (i === index ? { ...r, ...data } : r)));
  return (
    <form action={action} aria-busy={pending} className="panel p-6">
      <input type="hidden" name="scope" value={production ? "production" : "sale"} />
      <input type="hidden" name="id" value={output.id} />
      <input type="hidden" name="version" value={output.version} />
      <input type="hidden" name="recipe" value={JSON.stringify(recipe)} />
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <div className="rounded-xl bg-emerald-50 p-4">
          <p className="font-semibold">{output.name}</p>
          <p className="mt-1 text-sm">
            {production ? (
              "Takaran bahan untuk satu batch produksi gudang."
            ) : (
              <>
                Takaran untuk hasil <strong>1 {output.baseUnit.toLowerCase()}</strong> produk jual
                di outlet.
              </>
            )}
          </p>
        </div>
        {production && (
          <label className="field">
            Hasil Standar per Batch ({output.baseUnit.toLowerCase()}) *
            <input
              type="number"
              name="productionYield"
              min="0.001"
              max="1000000000"
              step="0.001"
              required
              value={yieldQuantity}
              onChange={(e) => setYieldQuantity(e.target.value)}
            />
            <span className="text-xs text-slate-500">
              Isi hasil campuran yang sudah diukur. Contoh bahan: 5.000 gram glaze + 2.000 ml
              minyak. Berat hasil tidak otomatis dijumlahkan dari satuan yang berbeda.
            </span>
          </label>
        )}
        <p className="text-xs text-slate-500">
          {production
            ? "Komposisi di bawah dipakai untuk satu batch. Saat produksi, pilih jumlah batch dan catat hasil aktual. Mengatur resep tidak mengurangi stok."
            : "Isi kebutuhan bahan untuk 1 pcs menu, termasuk bahan siap pakai hasil produksi gudang. Mengatur resep tidak mengurangi stok."}
        </p>
        {recipe.map((r, index) => {
          const ingredient = items.find((i) => i.id === r.ingredientId);
          return (
            <section
              key={index}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
            >
              <label className="field sm:col-span-2">
                Bahan #{index + 1}
                <select
                  required
                  value={r.ingredientId}
                  onChange={(e) => {
                    const i = eligible.find((i) => i.id === e.target.value);
                    patch(index, { ingredientId: e.target.value, baseUnit: i?.baseUnit || "PCS" });
                  }}
                >
                  <option value="">Pilih bahan...</option>
                  {ingredient && !eligible.some((i) => i.id === ingredient.id) && (
                    <option value={ingredient.id}>{ingredient.name} (perlu diperiksa)</option>
                  )}
                  {eligible.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {" · " + (warehouseKindNames[i.kind] || i.kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Jumlah Bahan *
                <input
                  type="number"
                  min="0.001"
                  max="1000000000"
                  step="0.001"
                  required
                  value={r.quantity}
                  onChange={(e) => patch(index, { quantity: e.target.value })}
                />
              </label>
              <label className="field">
                Satuan Bahan
                <input value={r.baseUnit.toLowerCase()} readOnly />
              </label>
              <p className="text-xs text-slate-500 sm:col-span-2">
                Biaya:{" "}
                {cost.lines[index]?.cost == null
                  ? "Belum diketahui"
                  : money(cost.lines[index].cost!)}{" "}
                · {cost.lines[index]?.source}
              </p>
              <button
                type="button"
                className="justify-self-end text-sm text-red-700 sm:col-span-2"
                onClick={() => setRecipe((old) => old.filter((_, i) => i !== index))}
              >
                Hapus bahan #{index + 1}
              </button>
            </section>
          );
        })}
        <button
          type="button"
          className="button-secondary"
          disabled={recipe.length >= 50}
          onClick={() =>
            setRecipe((old) => [...old, { ingredientId: "", quantity: "", baseUnit: "PCS" }])
          }
        >
          + Tambah Bahan Resep
        </button>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">
            Estimasi HPP bahan per 1 {output.baseUnit.toLowerCase()}
          </p>
          <p className="mt-1 text-xl font-bold">
            {cost.total === null ? "Belum dapat dihitung" : money(cost.total)}
          </p>
          {production && (
            <p className="mt-2 text-sm">
              Estimasi biaya 1 batch:{" "}
              {cost.total === null
                ? "Belum dapat dihitung"
                : money(cost.total * Number(yieldQuantity))}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Biaya dari rata-rata stok gudang, batch terakhir, atau estimasi resep sub produk. Belum
            termasuk tenaga kerja dan biaya operasional lainnya.
          </p>
        </div>
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
        <button className="button-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan Resep"}
        </button>
      </div>
    </form>
  );
}
