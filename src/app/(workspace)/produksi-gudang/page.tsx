import { ProductionPlanForm, ProductionPlanStatus } from "@/components/production-plan-forms";
import { ProductionRemainders } from "@/components/production-remainders";
import { RecipeManagement } from "@/components/recipe-management";
import type { RecipeCostItem } from "@/lib/recipe-cost";
import { NavigationLink } from "@/components/navigation-link";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseCivilDate, todayWib, displayDate } from "@/lib/placements";
import { quantityLabel } from "@/lib/goods-receipts";
import { rupiah } from "@/lib/money";
import {
  inventoryRound,
  recipeIngredientAllowed,
  warehouseKindNames,
  type SubProductOption,
} from "@/lib/inventory";
import { FormDialog } from "@/components/form-dialog";
import { InventoryProductionForm } from "@/components/inventory-forms";
import { LocalInput } from "@/components/local-input";
import { SortableTable } from "@/components/sortable-table";
import { UiIcon } from "@/components/ui-icon";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    saved?: string;
    q?: string;
    recipeKind?: string;
    reuse?: string;
    plan?: string;
  }>;
}) {
  await requireAccess("produksi-gudang");
  const query = await searchParams,
    today = todayWib(),
    tab = ["catat", "sisa", "resep", "riwayat", "rencana", "pemakaian"].includes(query.tab || "")
      ? query.tab!
      : "catat",
    from = typeof query.from === "string" ? query.from : today.slice(0, 8) + "01",
    to =
      typeof query.to === "string"
        ? query.to
        : tab === "rencana"
          ? new Date(Date.parse(today + "T00:00:00Z") + 60 * 86400000).toISOString().slice(0, 10)
          : today;
  let start = new Date(0),
    end = new Date(0),
    valid = true;
  try {
    start = parseCivilDate(from);
    end = parseCivilDate(to);
    if (end < start || end.getTime() - start.getTime() > 366 * 86400000) throw Error();
  } catch {
    valid = false;
  }
  const db = getPrisma(),
    [items, operations, recipeItems, remainders, plans, selectedPlan] = await Promise.all([
      ["catat", "riwayat", "rencana"].includes(tab)
        ? db.inventoryItem.findMany({
            where: { kind: { in: ["SUB", "FINISHED"] }, active: true },
            include: {
              recipe: {
                include: {
                  ingredient: {
                    include: { batches: { select: { baseUnit: true, remainingQuantity: true } } },
                  },
                },
              },
              batches: { select: { remainingQuantity: true, baseUnit: true } },
            },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      valid && ["catat", "riwayat", "pemakaian"].includes(tab)
        ? db.inventoryOperation.findMany({
            where: { kind: "PRODUCTION", date: { gte: start, lte: end } },
            include: {
              createdBy: { select: { name: true } },
              movements: {
                include: { batch: { include: { item: { select: { name: true, kind: true } } } } },
              },
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 500,
          })
        : [],
      tab === "resep"
        ? db.inventoryItem.findMany({
            select: {
              id: true,
              name: true,
              kind: true,
              active: true,
              baseUnit: true,
              updatedAt: true,
              sellingPrice: true,
              productionYield: true,
              recipe: { select: { ingredientId: true, quantity: true, baseUnit: true } },
              batches: {
                select: {
                  baseUnit: true,
                  remainingQuantity: true,
                  remainingValue: true,
                  initialQuantity: true,
                  initialValue: true,
                },
                orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
              },
            },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      tab === "catat"
        ? db.productionRemainder.findMany({
            where: { stockBatch: { remainingQuantity: { gt: 0 }, item: { active: true } } },
            include: { stockBatch: { include: { item: true } } },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          })
        : Promise.resolve([]),
      valid && tab === "rencana"
        ? db.productionPlan.findMany({
            where: { date: { gte: start, lte: end } },
            include: {
              item: { select: { name: true, baseUnit: true } },
              createdBy: { select: { name: true } },
              operation: {
                select: {
                  outputBatches: {
                    select: { itemId: true, initialQuantity: true, baseUnit: true },
                  },
                },
              },
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
            take: 500,
          })
        : Promise.resolve([]),
      tab === "catat" && typeof query.plan === "string"
        ? db.productionPlan.findFirst({
            where: { id: query.plan, status: { in: ["PLANNED", "IN_PROGRESS"] } },
          })
        : Promise.resolve(null),
    ]);
  const ready = (item: (typeof items)[number]) =>
    item.recipe.length > 0 &&
    item.recipe.every(
      (r) =>
        r.ingredient.active &&
        recipeIngredientAllowed(item.kind, r.ingredient.kind) &&
        r.baseUnit === r.ingredient.baseUnit,
    );
  const options: SubProductOption[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    version: i.updatedAt.toISOString(),
    unit: i.baseUnit,
    productionYield: Number(i.productionYield),
    ready: ready(i),
    recipe: i.recipe.map((r) => ({
      ingredientId: r.ingredientId,
      name: r.ingredient.name,
      quantity: Number(r.quantity),
      unit: r.baseUnit,
    })),
  }));
  const totals = new Map<string, number>();
  for (const op of operations)
    for (const m of op.movements) {
      const qty = Number(m.quantityAfter) - Number(m.quantityBefore);
      if (qty > 0)
        totals.set(m.batch.baseUnit, inventoryRound((totals.get(m.batch.baseUnit) || 0) + qty));
    }
  const produced =
      [...totals].map(([unit, qty]) => quantityLabel(qty, unit)).join(" / ") ||
      "Belum ada produksi",
    value = operations.reduce(
      (sum, op) =>
        sum +
        op.movements
          .filter((m) => Number(m.quantityAfter) > Number(m.quantityBefore))
          .reduce((s, m) => s + Number(m.valueAfter) - Number(m.valueBefore), 0),
      0,
    );
  const href = (next: string) => "/produksi-gudang?" + new URLSearchParams({ tab: next, from, to });
  const dateFilter = (
    <form className="flex min-w-0 flex-wrap items-end gap-3">
      <input type="hidden" name="tab" value={tab} />
      <label className="field">
        Dari tanggal
        <LocalInput type="date" name="from" defaultValue={from} required />
      </label>
      <label className="field">
        Sampai tanggal
        <LocalInput type="date" name="to" defaultValue={to} required />
      </label>
      <button className="button-secondary">Terapkan</button>
      {!valid && (
        <p role="alert" className="text-sm text-red-700">
          Rentang tanggal tidak valid, maksimal 1 tahun.
        </p>
      )}
    </form>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Olah bahan mentah atau setengah jadi di gudang menjadi barang hasil produksi untuk dikirim
          ke outlet.
        </p>
      </div>
      <nav aria-label="Submenu Produksi Gudang" className="min-w-0 border-b border-[#dbe7df]">
        <div className="flex gap-1 overflow-x-auto">
          {[
            ["rencana", "Rencana Produksi"],
            ["catat", "Catat Produksi"],
            ["pemakaian", "Pemakaian Bahan"],
            ["sisa", "Sisa Produksi"],
            ["resep", "Resep Produksi"],
            ["riwayat", "Riwayat Produksi"],
          ].map(([key, label]) => (
            <NavigationLink
              key={key}
              href={href(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-xs font-semibold ${tab === key ? "border-[#44785a] bg-[#e4f0e7] text-[#244c3a]" : "border-transparent text-slate-500"}`}
            >
              <UiIcon name={key === "catat" ? "box" : "receipt"} size={17} />
              {label}
            </NavigationLink>
          ))}
        </div>
      </nav>
      {tab === "catat" && (
        <div className="panel flex flex-wrap items-end justify-between gap-4 p-4">
          {dateFilter}
          <FormDialog
            title="Catat Produksi Gudang"
            trigger="+ Catat Produksi"
            wide
            initiallyOpen={!!query.reuse || !!selectedPlan}
            cancelRoute="/produksi-gudang?tab=catat"
          >
            <InventoryProductionForm
              items={options}
              plan={
                selectedPlan
                  ? {
                      id: selectedPlan.id,
                      itemId: selectedPlan.itemId,
                      quantity: Number(selectedPlan.quantity),
                      version: selectedPlan.updatedAt.toISOString(),
                      date: selectedPlan.date.toISOString().slice(0, 10),
                    }
                  : undefined
              }
              today={today}
              initialReuseId={typeof query.reuse === "string" ? query.reuse : ""}
              remainders={remainders.map((r) => ({
                id: r.stockBatchId,
                itemId: r.stockBatch.itemId,
                label:
                  r.stockBatch.item.name +
                  " - " +
                  displayDate(r.date) +
                  " - " +
                  r.stockBatchId.slice(-6),
                unit: r.stockBatch.baseUnit,
                quantity: Number(r.stockBatch.remainingQuantity),
                value: Number(r.stockBatch.remainingValue),
                version: r.stockBatch.version,
              }))}
            />
          </FormDialog>
        </div>
      )}
      {query.saved && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {tab === "sisa"
            ? "Sisa produksi berhasil disimpan."
            : "Produksi gudang berhasil disimpan."}
        </p>
      )}
      {tab === "rencana" ? (
        <>
          <section className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="font-bold">Jadwal & Rencana Produksi</h2>
              <p className="mt-1 text-xs text-slate-500">
                Rencana tidak mengubah stok. Pemakaian bahan dan hasil dicatat saat produksi selesai
                dilakukan.
              </p>
            </div>
            <FormDialog title="Rencana Produksi" trigger="+ Rencana Produksi">
              <ProductionPlanForm items={options} today={today} />
            </FormDialog>
          </section>
          <form className="panel flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="tab" value="rencana" />
            <label className="field">
              Dari tanggal
              <input type="date" name="from" defaultValue={from} required />
            </label>
            <label className="field">
              Sampai tanggal
              <input type="date" name="to" defaultValue={to} required />
            </label>
            <button className="button-secondary">Terapkan</button>
          </form>
          {!valid ? (
            <p role="alert" className="text-red-700">
              Periode tidak valid, maksimal 366 hari.
            </p>
          ) : (
            <section className="panel overflow-x-auto">
              <SortableTable className="w-full min-w-[880px] text-left text-xs">
                <thead>
                  <tr>
                    {[
                      "Tanggal",
                      "Hasil Produksi",
                      "Target / Aktual",
                      "Status",
                      "Catatan",
                      "Dibuat oleh",
                      "Aksi",
                    ].map((h) => (
                      <th className="p-4" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td className="p-4">{displayDate(p.date)}</td>
                      <td className="p-4 font-semibold">{p.item.name}</td>
                      <td className="p-4">
                        Target: {quantityLabel(Number(p.quantity), p.item.baseUnit)}
                        {p.operation && (
                          <p className="mt-1 text-emerald-700">
                            Aktual:{" "}
                            {quantityLabel(
                              p.operation.outputBatches
                                .filter((b) => b.itemId === p.itemId)
                                .reduce((n, b) => n + Number(b.initialQuantity), 0),
                              p.item.baseUnit,
                            )}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        {
                          (
                            {
                              PLANNED: "Direncanakan",
                              IN_PROGRESS: "Dalam proses",
                              COMPLETED: "Selesai",
                              CANCELLED: "Dibatalkan",
                            } as Record<string, string>
                          )[p.status]
                        }
                      </td>
                      <td className="max-w-56 whitespace-pre-wrap p-4">{p.notes || "—"}</td>
                      <td className="p-4">{p.createdBy.name}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {p.status === "PLANNED" && (
                            <FormDialog title="Edit Rencana Produksi" trigger="Edit">
                              <ProductionPlanForm
                                items={options}
                                today={today}
                                initial={{
                                  id: p.id,
                                  version: p.updatedAt.toISOString(),
                                  itemId: p.itemId,
                                  date: p.date.toISOString().slice(0, 10),
                                  quantity: p.quantity.toString(),
                                  notes: p.notes,
                                }}
                              />
                            </FormDialog>
                          )}
                          {["PLANNED", "IN_PROGRESS"].includes(p.status) && (
                            <Link
                              className="button-primary"
                              href={
                                "/produksi-gudang?" +
                                new URLSearchParams({ tab: "catat", plan: p.id })
                              }
                            >
                              Catat Hasil
                            </Link>
                          )}
                          <ProductionPlanStatus
                            id={p.id}
                            version={p.updatedAt.toISOString()}
                            status={p.status}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!plans.length && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400">
                        Belum ada rencana produksi pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableTable>
            </section>
          )}
        </>
      ) : tab === "pemakaian" ? (
        <>
          <section className="panel p-4">
            <h2 className="font-bold">Riwayat Bahan Dipakai Produksi</h2>
            <p className="mt-1 text-xs text-slate-500">
              Terisi otomatis dari pengurangan batch gudang saat Catat Produksi. Ini tidak memotong
              stok lagi. Maksimal 500 produksi per periode.
            </p>
          </section>
          <form className="panel flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="tab" value="pemakaian" />
            <label className="field">
              Dari tanggal
              <input type="date" name="from" defaultValue={from} required />
            </label>
            <label className="field">
              Sampai tanggal
              <input type="date" name="to" defaultValue={to} required />
            </label>
            <button className="button-secondary">Terapkan</button>
          </form>
          <section className="panel overflow-x-auto">
            <SortableTable className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr>
                  {[
                    "Tanggal",
                    "Hasil Produksi",
                    "Bahan",
                    "Jenis",
                    "Batch Bahan",
                    "Jumlah Terpakai",
                    "Nilai Bahan",
                    "Petugas",
                  ].map((h) => (
                    <th className="p-4" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operations.flatMap((op) =>
                  op.movements
                    .filter((m) => Number(m.quantityAfter) < Number(m.quantityBefore))
                    .map((m) => (
                      <tr key={m.id}>
                        <td className="p-4">{displayDate(op.date)}</td>
                        <td className="p-4 font-semibold">
                          {op.movements.find(
                            (x) => Number(x.quantityAfter) > Number(x.quantityBefore),
                          )?.batch.item.name || "Produksi gudang"}
                        </td>
                        <td className="p-4">{m.batch.item.name}</td>
                        <td className="p-4">
                          {warehouseKindNames[m.batch.item.kind] || m.batch.item.kind}
                        </td>
                        <td className="p-4 font-mono">{m.batchId.slice(-10)}</td>
                        <td className="p-4">
                          {quantityLabel(
                            Number(m.quantityBefore) - Number(m.quantityAfter),
                            m.batch.baseUnit,
                          )}
                        </td>
                        <td className="p-4">
                          {rupiah(Math.round(Number(m.valueBefore) - Number(m.valueAfter)))}
                        </td>
                        <td className="p-4">{op.createdBy.name}</td>
                      </tr>
                    )),
                )}
                {!operations.some((op) =>
                  op.movements.some((m) => Number(m.quantityAfter) < Number(m.quantityBefore)),
                ) && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      Belum ada pemakaian bahan produksi pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableTable>
          </section>
        </>
      ) : tab === "sisa" ? (
        <ProductionRemainders
          today={today}
          q={typeof query.q === "string" ? query.q.slice(0, 150) : ""}
        />
      ) : tab === "resep" ? (
        <RecipeManagement
          production
          q={typeof query.q === "string" ? query.q.slice(0, 150) : ""}
          kind={["SUB", "FINISHED"].includes(query.recipeKind || "") ? query.recipeKind : ""}
          items={recipeItems.map(
            (i): RecipeCostItem => ({
              id: i.id,
              name: i.name,
              kind: i.kind,
              baseUnit: i.baseUnit,
              active: i.active,
              version: i.updatedAt.toISOString(),
              sellingPrice: i.sellingPrice,
              productionYield: Number(i.productionYield),
              recipe: i.recipe.map((r) => ({
                ingredientId: r.ingredientId,
                quantity: Number(r.quantity),
                baseUnit: r.baseUnit,
              })),
              batches: i.batches.map((b) => ({
                baseUnit: b.baseUnit,
                remainingQuantity: Number(b.remainingQuantity),
                remainingValue: Number(b.remainingValue),
                initialQuantity: Number(b.initialQuantity),
                initialValue: Number(b.initialValue),
              })),
            }),
          )}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["RESEP GUDANG SIAP", String(items.filter(ready).length) + " item"],
              ["HASIL PRODUKSI PERIODE", produced],
              ["NILAI BAHAN DIPRODUKSI", rupiah(Math.round(value))],
            ].map(([label, amount]) => (
              <section key={label} className="panel p-4">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-3 break-words text-xl font-bold">{amount}</p>
              </section>
            ))}
          </div>
          {tab !== "catat" && <div className="panel p-4">{dateFilter}</div>}
          <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            Produksi mengurangi bahan gudang menggunakan batch FIFO, lalu menambah batch sub produk
            hasil olahan. Ini tidak mengurangi stok outlet. Bahan rusak atau susut dicatat sesuai
            kejadian melalui menu Susut. Pembuatan menu langsung saat jualan mengikuti resep produk
            jual ketika POS nanti dihubungkan.
          </p>
          {tab === "catat" ? (
            <section className="panel overflow-hidden">
              <h2 className="border-b border-slate-100 p-4 text-sm font-bold">
                BAHAN SETENGAH JADI & BAHAN JADI GUDANG
              </h2>
              <div className="overflow-x-auto">
                <SortableTable className="w-full min-w-[740px] text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Hasil Produksi",
                        "Komposisi 1 Batch",
                        "Stok Hasil di Gudang",
                        "Kesiapan Resep",
                      ].map((label) => (
                        <th key={label} className="p-4">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className="p-4 font-semibold">
                          {i.name}
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {warehouseKindNames[i.kind]} · Hasil{" "}
                            {Number(i.productionYield).toLocaleString("id-ID")}{" "}
                            {i.baseUnit.toLowerCase()} / batch
                          </p>
                        </td>
                        <td className="p-4 text-xs">
                          {i.recipe.length ? (
                            <ul className="space-y-2">
                              {i.recipe.map((r) => (
                                <li key={r.id}>
                                  <p>
                                    {r.ingredient.name}:{" "}
                                    {quantityLabel(Number(r.quantity), r.baseUnit)}
                                  </p>
                                  <p className="mt-1 text-slate-400">
                                    Stok bahan gudang:{" "}
                                    {quantityLabel(
                                      r.ingredient.batches
                                        .filter((b) => b.baseUnit === r.baseUnit)
                                        .reduce((s, b) => s + Number(b.remainingQuantity), 0),
                                      r.baseUnit,
                                    )}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "Belum ada resep"
                          )}
                        </td>
                        <td className="p-4">
                          {quantityLabel(
                            i.batches
                              .filter((b) => b.baseUnit === i.baseUnit)
                              .reduce((s, b) => s + Number(b.remainingQuantity), 0),
                            i.baseUnit,
                          )}
                        </td>
                        <td className="p-4 text-xs">
                          {ready(i)
                            ? "Resep siap; cek stok sebelum produksi"
                            : "Atur melalui submenu Resep Produksi"}
                        </td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-slate-400">
                          Belum ada barang hasil produksi aktif. Tambahkan melalui Stok & Inventori
                          → Tambah Barang Gudang.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </SortableTable>
              </div>
            </section>
          ) : (
            <section className="panel overflow-hidden">
              <h2 className="border-b border-slate-100 p-4 text-sm font-bold">
                RIWAYAT PRODUKSI GUDANG · 500 TERBARU
              </h2>
              <div className="overflow-x-auto">
                <SortableTable className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Tanggal / Petugas",
                        "Hasil Produksi",
                        "Bahan Dipakai",
                        "Nilai Produksi",
                        "Catatan",
                      ].map((label) => (
                        <th key={label} className="p-4">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((op) => (
                      <tr key={op.id}>
                        <td className="whitespace-nowrap p-4">
                          {displayDate(op.date)}
                          <p className="mt-1 text-xs text-slate-500">{op.createdBy.name}</p>
                        </td>
                        <td className="p-4 text-xs">
                          <ul className="space-y-1">
                            {op.movements
                              .filter((m) => Number(m.quantityAfter) > Number(m.quantityBefore))
                              .map((m) => (
                                <li key={m.id}>
                                  {m.batch.item.name}:{" "}
                                  {quantityLabel(
                                    Number(m.quantityAfter) - Number(m.quantityBefore),
                                    m.batch.baseUnit,
                                  )}
                                </li>
                              ))}
                          </ul>
                        </td>
                        <td className="p-4 text-xs">
                          <ul className="space-y-1">
                            {op.movements
                              .filter((m) => Number(m.quantityAfter) < Number(m.quantityBefore))
                              .map((m) => (
                                <li key={m.id}>
                                  {m.batch.item.name}:{" "}
                                  {quantityLabel(
                                    Number(m.quantityBefore) - Number(m.quantityAfter),
                                    m.batch.baseUnit,
                                  )}
                                </li>
                              ))}
                          </ul>
                        </td>
                        <td className="whitespace-nowrap p-4">
                          {rupiah(
                            Math.round(
                              op.movements
                                .filter((m) => Number(m.quantityAfter) > Number(m.quantityBefore))
                                .reduce(
                                  (s, m) => s + Number(m.valueAfter) - Number(m.valueBefore),
                                  0,
                                ),
                            ),
                          )}
                        </td>
                        <td className="max-w-64 whitespace-pre-wrap p-4 text-xs">{op.notes}</td>
                      </tr>
                    ))}
                    {!operations.length && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400">
                          Belum ada produksi gudang pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </SortableTable>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
