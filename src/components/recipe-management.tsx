import { warehouseKindNames } from "@/lib/inventory";
import { recipeCost, type RecipeCostItem } from "@/lib/recipe-cost";
import { FormDialog } from "@/components/form-dialog";
import { RecipeForm } from "@/components/recipe-form";
import { SortableTable } from "@/components/sortable-table";
const money = (n: number) => "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
export function RecipeManagement({
  items,
  q = "",
  kind = "",
  production = false,
}: {
  items: RecipeCostItem[];
  q?: string;
  kind?: string;
  production?: boolean;
}) {
  const outputs = items.filter((i) =>
      (production ? ["SUB", "FINISHED"] : ["PRODUCT"]).includes(i.kind),
    ),
    visible = outputs.filter(
      (i) => (!kind || i.kind === kind) && i.name.toLowerCase().includes(q.toLowerCase()),
    ),
    complete = outputs.filter((i) => recipeCost(i, items).complete).length;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            production ? "BAHAN SETENGAH JADI" : "PRODUK JUAL",
            outputs.filter((i) => i.kind === (production ? "SUB" : "PRODUCT")).length,
          ],
          [
            production ? "BAHAN JADI" : "RESEP SUDAH DIATUR",
            outputs.filter((i) => (production ? i.kind === "FINISHED" : i.recipe.length > 0))
              .length,
          ],
          ["HPP BAHAN TERHITUNG", complete],
        ].map(([label, value]) => (
          <section key={label} className="panel p-4">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-3 text-xl font-bold">{value}</p>
          </section>
        ))}
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        {production
          ? "Atur komposisi bahan dan hasil standar untuk satu batch produksi gudang. Pencatatan produksi mengurangi bahan gudang dan menambah stok hasil olahan; stok outlet tetap terpisah."
          : "Atur kebutuhan bahan untuk 1 pcs produk jual. Bahan siap pakai memakai HPP hasil produksi gudang. Pengurangan stok outlet dari POS belum aktif."}
      </p>
      <form className="panel flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="tab" value="resep" />
        <label className="field flex-1">
          Cari resep
          <input
            name="q"
            defaultValue={q}
            maxLength={150}
            placeholder={production ? "Nama hasil produksi..." : "Nama menu jual..."}
          />
        </label>
        {production && (
          <label className="field">
            Jenis hasil
            <select name="recipeKind" defaultValue={kind}>
              <option value="">Semua jenis</option>
              <option value="SUB">Bahan Setengah Jadi</option>
              <option value="FINISHED">Bahan Jadi</option>
            </select>
          </label>
        )}
        <button className="button-secondary">Cari</button>
      </form>
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[940px] text-left text-sm">
            <thead>
              <tr>
                {[
                  "Produk / Hasil",
                  "Jenis",
                  "Komposisi",
                  "HPP Bahan / Satuan",
                  production ? "Hasil / Batch" : "Harga Jual",
                  production ? "Biaya / Batch" : "Margin Bahan",
                  "Status",
                  "Aksi",
                ].map((label) => (
                  <th key={label} className="p-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((output) => {
                const cost = recipeCost(output, items),
                  margin = cost.total === null ? null : output.sellingPrice - cost.total;
                return (
                  <tr key={output.id}>
                    <td className="p-4">
                      <p className="font-semibold">{output.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Hasil {production ? output.productionYield || 1 : 1}{" "}
                        {output.baseUnit.toLowerCase()}
                        {production ? " / batch" : " / menu"}
                        {!output.active ? " · Nonaktif" : ""}
                      </p>
                    </td>
                    <td className="p-4 text-xs">
                      {output.kind === "PRODUCT"
                        ? "Produk Jual / Outlet"
                        : warehouseKindNames[output.kind] + " / Gudang"}
                    </td>
                    <td className="p-4 text-xs">
                      {!cost.lines.length ? (
                        "Belum ada resep"
                      ) : (
                        <ul className="space-y-1">
                          {cost.lines.map((line) => (
                            <li key={line.ingredientId}>
                              {line.name}: {line.quantity.toLocaleString("id-ID")}{" "}
                              {line.unit.toLowerCase()}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-4 font-semibold">
                      {cost.total === null ? "Belum diketahui" : money(cost.total)}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {production
                        ? `${output.productionYield || 1} ${output.baseUnit.toLowerCase()}`
                        : money(output.sellingPrice)}
                    </td>
                    <td
                      className={`whitespace-nowrap p-4 ${margin !== null && margin < 0 ? "text-red-700" : ""}`}
                    >
                      {production
                        ? cost.total === null
                          ? "Belum diketahui"
                          : money(cost.total * (output.productionYield || 1))
                        : margin !== null
                          ? money(margin)
                          : "—"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${cost.complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        {!output.recipe.length
                          ? "Belum diatur"
                          : cost.complete
                            ? "Terhitung"
                            : "Biaya belum lengkap"}
                      </span>
                    </td>
                    <td className="p-4">
                      <FormDialog title={"Atur Resep · " + output.name} trigger="Atur Resep" wide>
                        <RecipeForm output={output} items={items} production={production} />
                      </FormDialog>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    {production
                      ? "Belum ada hasil produksi yang sesuai. Tambahkan Bahan Setengah Jadi atau Bahan Jadi melalui Stok & Inventori."
                      : "Belum ada menu jual yang sesuai. Tambahkan Produk terlebih dahulu."}
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
        <p className="border-t border-slate-100 p-4 text-xs text-slate-500">
          HPP dan margin di sini merupakan estimasi bahan serta kemasan, belum termasuk gaji,
          listrik, sewa, dan biaya operasional. Harga berasal dari rata-rata stok gudang atau batch
          terakhir; harga yang belum tersedia ditandai belum diketahui.
        </p>
      </section>
    </div>
  );
}
