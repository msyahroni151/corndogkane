import { lifecycleCounts, permanentDeletionReason } from "@/lib/inventory-item-lifecycle";
import Link from "next/link";
import { RecipeManagement } from "@/components/recipe-management";
import type { RecipeCostItem } from "@/lib/recipe-cost";
import Image from "next/image";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate, displayDate } from "@/lib/placements";
import { quantityLabel } from "@/lib/goods-receipts";
import { rupiah as formatRupiah } from "@/lib/money";
import {
  inventoryTabs,
  warehouseKinds,
  warehouseKindNames,
  settingMenuTabs,
  inventoryRound,
  type BatchOption,
  type CatalogDraft,
} from "@/lib/inventory";
import { FormDialog } from "@/components/form-dialog";
import {
  InventoryItemLifecycleForm,
  InventoryAdjustmentForm,
  InventoryCatalogForm,
  InventoryCountForm,
  InventorySyncButton,
  LegacyWarehouseForm,
} from "@/components/inventory-forms";
import { LocalInput } from "@/components/local-input";
import { SortableTable } from "@/components/sortable-table";
import { UiIcon, type IconName } from "@/components/ui-icon";
import type { ReactNode } from "react";
import "@/components/inventory.css";
const productGroups = [
  { key: "", name: "Semua Jenis", categories: [] },
  { key: "moza", name: "Moza", categories: ["moza", "mozarella", "mozzarella"] },
  { key: "mix", name: "Mix", categories: ["mix"] },
  { key: "beng-beng", name: "Beng-beng", categories: ["bengbeng"] },
  { key: "sosis", name: "Sosis", categories: ["sosis"] },
] as const;
const categoryKey = (name: string) => name.toLowerCase().replace(/[\s-]+/g, "");
const currency = (value: number) => formatRupiah(Math.round(value));
const unitPrice = (value: number) => formatRupiah(value);
function Metric({
  label,
  value,
  note,
  icon,
  tone = "text-emerald-700 bg-emerald-50",
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: IconName;
  tone?: string;
}) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <span className={`inline-flex shrink-0 rounded-xl p-2 ${tone}`}>
          <UiIcon name={icon} size={18} />
        </span>
      </div>
      <p className="mt-3 break-words text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </section>
  );
}
function quantities(rows: { quantity: number; unit: string }[], fallbackUnit = "PCS") {
  const grouped = new Map<string, number>();
  for (const row of rows)
    grouped.set(row.unit, inventoryRound((grouped.get(row.unit) || 0) + row.quantity));
  return (
    [...grouped].map(([unit, quantity]) => quantityLabel(quantity, unit)).join(" / ") ||
    quantityLabel(0, fallbackUnit)
  );
}
export default async function InventoryWorkspace({
  searchParams,
  menuSettings = false,
}: {
  menuSettings?: boolean;
  searchParams: Promise<{
    tab?: string;
    mode?: string;
    status?: string;
    group?: string;
    stage?: string;
    recipeKind?: string;
    q?: string;
    from?: string;
    to?: string;
    saved?: string;
  }>;
}) {
  await requireAccess(menuSettings ? "setting-menu" : "stok-inventory");
  const tabs = menuSettings ? settingMenuTabs : inventoryTabs;
  const basePath = menuSettings ? "/setting-menu" : "/stok-inventory";
  const query = await searchParams,
    today = todayWib(),
    tab = tabs.some((t) => t.key === query.tab) ? query.tab! : tabs[0].key,
    mode = query.mode === "harian" ? "harian" : "prep",
    q = typeof query.q === "string" ? query.q.trim().slice(0, 150) : "",
    status = typeof query.status === "string" ? query.status : "",
    stage = warehouseKinds.some((k) => k === query.stage) ? query.stage! : "",
    productGroup =
      tab === "produk"
        ? (productGroups.find((g) => g.key === query.group) ?? productGroups[0])
        : productGroups[0],
    from = typeof query.from === "string" ? query.from : today.slice(0, 8) + "01",
    to = typeof query.to === "string" ? query.to : today;
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
  const db = getPrisma();
  const [items, operations, lastOpname] = await Promise.all([
    db.inventoryItem.findMany({
      include: {
        _count: { select: lifecycleCounts },
        recipe: { include: { ingredient: { select: { name: true } } } },
        batches: {
          orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          include: {
            sourceLine: { select: { receipt: { select: { supplierName: true } } } },
            returnReceipt: {
              select: {
                valueSource: true,
                line: {
                  select: { stockReturn: { select: { outlet: { select: { name: true } } } } },
                },
              },
            },
            movements: {
              select: {
                quantityBefore: true,
                quantityAfter: true,
                valueBefore: true,
                valueAfter: true,
                operation: { select: { kind: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    valid
      ? db.inventoryOperation.findMany({
          where: { date: { gte: start, lte: end } },
          include: {
            createdBy: { select: { name: true } },
            movements: { include: { batch: { include: { item: { select: { name: true } } } } } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 500,
        })
      : [],
    db.inventoryOperation.findFirst({
      where: { kind: "OPNAME" },
      include: { movements: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const savedUnits = [...new Set(items.map((item) => item.baseUnit))].sort();
  const ingredients = items
    .filter((i) => i.kind === "RAW" && i.active)
    .map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit }));
  const batchOptions: BatchOption[] = items.flatMap((item) =>
    item.active && warehouseKinds.some((k) => k === item.kind)
      ? item.batches.map((batch, index) => ({
          id: batch.id,
          itemId: item.id,
          name: item.name,
          unit: batch.baseUnit,
          quantity: Number(batch.remainingQuantity),
          value: Number(batch.remainingValue),
          initialQuantity: Number(batch.initialQuantity),
          initialValue: Number(batch.initialValue),
          version: batch.version,
          date: batch.receivedAt.toISOString().slice(0, 10),
          label: "Batch #" + (index + 1) + " - " + displayDate(batch.receivedAt),
        }))
      : [],
  );
  const draft = (item: (typeof items)[number]): CatalogDraft => ({
    id: item.id,
    version: item.updatedAt.toISOString(),
    name: item.name,
    kind: item.kind,
    category: item.category,
    baseUnit: item.baseUnit,
    minimumStock: item.minimumStock.toString(),
    active: item.active,
    emoji: item.emoji,
    sellingPrice: String(item.sellingPrice),
    standardCost: String(item.standardCost),
    recipe: item.recipe.map((r) => ({
      ingredientId: r.ingredientId,
      quantity: r.quantity.toString(),
      baseUnit: r.baseUnit,
    })),
  });
  const href = (nextTab = tab, patch: Record<string, string> = {}) =>
    basePath +
    "?" +
    new URLSearchParams({
      tab: nextTab,
      ...(nextTab === "susut" ? { mode } : {}),
      ...(q ? { q } : {}),
      ...(nextTab === "stock" && stage ? { stage } : {}),
      ...(status ? { status } : {}),
      ...(nextTab === "produk" && productGroup.key ? { group: productGroup.key } : {}),
      from,
      to,
      ...patch,
    });
  const raw = items.filter((i) => warehouseKinds.some((k) => k === i.kind)),
    activeRaw = raw.filter((i) => i.active),
    products = items.filter((i) => i.kind === "PRODUCT"),
    subItems = items.filter((i) => i.kind === "SUB"),
    allRawBatches = raw.flatMap((i) => i.batches),
    rawLoss = allRawBatches.flatMap((b) =>
      b.movements
        .filter((m) => ["PREP", "LOSS", "DAILY"].includes(m.operation.kind))
        .map((m) => ({
          quantity: Math.max(0, Number(m.quantityBefore) - Number(m.quantityAfter)),
          unit: b.baseUnit,
        })),
    ),
    lostValue = allRawBatches.reduce(
      (sum, b) =>
        sum +
        b.movements
          .filter((m) => ["LOSS", "DAILY"].includes(m.operation.kind))
          .reduce((s, m) => s + Math.max(0, Number(m.valueBefore) - Number(m.valueAfter)), 0),
      0,
    );
  const legacyStocks = products.filter((item) => item.batches.length > 0);
  const legacyValue = legacyStocks
    .flatMap((item) => item.batches)
    .reduce((sum, b) => sum + Number(b.remainingValue), 0);
  const stockValue =
      legacyValue + allRawBatches.reduce((sum, b) => sum + Number(b.remainingValue), 0),
    isAvailable = (item: (typeof items)[number]) =>
      item.batches.some((b) => Number(b.remainingQuantity) > 0),
    stockItems = raw.filter(
      (i) =>
        (status === "inactive" ? !i.active : i.active) &&
        (!stage || i.kind === stage) &&
        i.name.toLowerCase().includes(q.toLowerCase()) &&
        (status !== "available" || isAvailable(i)) &&
        (status !== "empty" || !isAvailable(i)),
    );
  const catalogItems = (tab === "produk" ? products : subItems).filter(
    (i) =>
      i.name.toLowerCase().includes(q.toLowerCase()) &&
      (status !== "active" || i.active) &&
      (status !== "inactive" || !i.active) &&
      (status !== "available" || isAvailable(i)) &&
      (status !== "empty" || !isAvailable(i)) &&
      (!productGroup.key ||
        productGroup.categories.some((category) => category === categoryKey(i.category))),
  );
  const avatar = (item: (typeof items)[number]) => (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-2xl text-emerald-700">
      {menuSettings && item.photo ? (
        <Image
          src={item.photo}
          alt={item.name}
          width={44}
          height={44}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        (menuSettings && item.emoji) || <UiIcon name="box" size={22} />
      )}
    </span>
  );
  const title = tabs.find((t) => t.key === tab)!.name;
  const catalogCard = (item: (typeof items)[number]) => (
    <section key={item.id} className="panel space-y-4 p-5">
      <div className="flex items-start gap-3">
        {avatar(item)}
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{item.name}</h3>
          <p className="mt-1 text-xs text-slate-400">{item.category}</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
        >
          {item.active ? "AKTIF" : "NONAKTIF"}
        </span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-400">Sisa Stok</p>
          <p className="mt-1 font-semibold">
            {quantities(
              item.batches.map((b) => ({
                quantity: Number(b.remainingQuantity),
                unit: b.baseUnit,
              })),
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Alert Stok</p>
          <p className="mt-1">
            {Number(item.minimumStock) > 0
              ? quantityLabel(Number(item.minimumStock), item.baseUnit)
              : "-"}
          </p>
        </div>
        {item.kind === "PRODUCT" && (
          <div>
            <p className="text-xs text-slate-400">Harga Jual</p>
            <p className="mt-1 font-semibold">{currency(item.sellingPrice)}</p>
          </div>
        )}
      </div>
      {item.kind === "PRODUCT" && (
        <p className="text-xs text-slate-500">
          Harga beli rata-rata:{" "}
          {unitPrice(
            item.batches
              .filter((b) => b.baseUnit === item.baseUnit)
              .reduce((sum, b) => sum + Number(b.remainingQuantity), 0) > 0
              ? inventoryRound(
                  item.batches
                    .filter((b) => b.baseUnit === item.baseUnit)
                    .reduce((sum, b) => sum + Number(b.remainingValue), 0) /
                    item.batches
                      .filter((b) => b.baseUnit === item.baseUnit)
                      .reduce((sum, b) => sum + Number(b.remainingQuantity), 0),
                  4,
                )
              : item.standardCost,
          )}{" "}
          / {item.baseUnit.toLowerCase()}
        </p>
      )}
      {item.kind === "SUB" && (
        <p
          className={`rounded-lg p-3 text-xs ${item.recipe.length ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
        >
          {item.recipe.length
            ? "Resep: " +
              item.recipe
                .map((r) => r.ingredient.name + " " + quantityLabel(Number(r.quantity), r.baseUnit))
                .join(", ") +
              " / 1 " +
              item.baseUnit.toLowerCase()
            : "Resep belum diatur. Lengkapi melalui submenu Resep & HPP sebelum produksi."}
        </p>
      )}
      <div className="flex justify-end">
        <FormDialog
          title={item.kind === "SUB" ? "Edit Sub Produk" : "Edit Produk"}
          trigger={item.kind === "SUB" ? "Edit Sub Produk" : "Edit Produk"}
        >
          <InventoryCatalogForm
            initial={draft(item)}
            kind={item.kind}
            ingredients={ingredients}
            units={savedUnits}
          />
        </FormDialog>
      </div>
    </section>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {menuSettings ? "Setting Menu" : "Inventori"} /{" "}
          <strong className="text-slate-800">{title}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          {tab === "stock" && (
            <>
              <InventorySyncButton />
              <FormDialog title="Tambah Barang Gudang" trigger="+ Tambah Barang Gudang">
                <InventoryCatalogForm
                  kind={stage || "RAW"}
                  warehouse
                  ingredients={ingredients}
                  units={savedUnits}
                />
              </FormDialog>
              <FormDialog title="Catat Koreksi Stok" trigger="Catat Koreksi">
                <InventoryAdjustmentForm batches={batchOptions} today={today} />
              </FormDialog>
            </>
          )}
          {tab === "susut" && mode === "prep" && (
            <FormDialog title="Catat Susut Prep" trigger="Catat Susut">
              <InventoryAdjustmentForm
                batches={batchOptions.filter((b) => b.quantity > 0)}
                today={today}
                initialKind="PREP"
              />
            </FormDialog>
          )}
          {tab === "susut" && mode === "harian" && (
            <FormDialog
              key={String(query.saved || "initial")}
              title="Catat Susut Harian"
              trigger="+ Catat Susut Harian"
              wide
            >
              <InventoryCountForm
                batches={batchOptions.filter((b) => b.quantity > 0)}
                today={today}
                kind="DAILY"
              />
            </FormDialog>
          )}
          {tab === "opname" && (
            <FormDialog title="Hitung Stok Fisik (Opname)" trigger="Mulai Hitung Stok" wide>
              <InventoryCountForm batches={batchOptions} today={today} kind="OPNAME" />
            </FormDialog>
          )}
          {tab === "produk" && (
            <FormDialog title="Tambah Produk Baru" trigger="+ Tambah Produk">
              <InventoryCatalogForm kind="PRODUCT" ingredients={ingredients} units={savedUnits} />
            </FormDialog>
          )}
          {tab === "subproduk" && (
            <FormDialog title="Tambah Sub Produk" trigger="+ Tambah Sub Produk">
              <InventoryCatalogForm kind="SUB" ingredients={ingredients} units={savedUnits} />
            </FormDialog>
          )}
        </div>
      </div>
      <nav
        aria-label={menuSettings ? "Submenu Setting Menu" : "Submenu Stok & Inventori"}
        className="min-w-0 border-b border-[#dbe7df]"
      >
        <div className="flex gap-1 overflow-x-auto pb-px">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={href(t.key, { status: "", q: "" })}
              prefetch={false}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${tab === t.key ? "border-[#44785a] bg-[#e4f0e7] text-[#244c3a]" : "border-transparent text-slate-500 hover:bg-[#edf4ef] hover:text-[#244c3a]"}`}
            >
              <UiIcon name={t.icon} size={17} />
              {t.name}
            </Link>
          ))}
        </div>
      </nav>
      {query.saved && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {menuSettings ? "Data menu berhasil disimpan." : "Data inventori berhasil disimpan."}
        </p>
      )}
      {tab === "stock" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="ITEM GUDANG AKTIF"
              value={activeRaw.length + " item"}
              note={`dari ${raw.length} total barang gudang`}
              icon="boxes"
            />
            <Metric
              label="TOTAL SUSUT"
              value={quantities(rawLoss)}
              note={`${allRawBatches.reduce((s, b) => s + b.movements.filter((m) => ["PREP", "LOSS", "DAILY"].includes(m.operation.kind)).length, 0)} koreksi`}
              icon="arrow"
              tone="text-amber-700 bg-amber-50"
            />
            <Metric
              label="MODAL HILANG"
              value={currency(lostValue)}
              note="akibat kerusakan atau susut harian bahan"
              icon="alert"
              tone="text-red-600 bg-red-50"
            />
            <Metric
              label="NILAI STOK"
              value={currency(stockValue)}
              note={
                legacyStocks.length
                  ? "termasuk stok lama yang belum dipisahkan"
                  : "termasuk stok bahan di Sampah yang tersisa"
              }
              icon="wallet"
              tone="text-purple-700 bg-purple-50"
            />
          </div>
          {legacyStocks.length > 0 && (
            <section className="panel overflow-hidden border-amber-200">
              <div className="border-b border-amber-100 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-800">
                  Stok lama masih terkait menu jual
                </h3>
                <p className="mt-1 text-xs text-amber-700">
                  Stok dan nilainya tetap tersimpan dan termasuk total gudang. Pisahkan sebagai
                  bahan jadi agar bisa dikelola dan dikirim tanpa mencampurkan menu jual.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr>
                      {["Menu lama", "Stok tersisa", "Nilai stok", "Tindakan"].map((label) => (
                        <th key={label} className="p-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {legacyStocks.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-semibold">{item.name}</td>
                        <td className="p-3">
                          {quantities(
                            item.batches.map((b) => ({
                              quantity: Number(b.remainingQuantity),
                              unit: b.baseUnit,
                            })),
                          )}
                        </td>
                        <td className="p-3">
                          {currency(
                            item.batches.reduce((sum, b) => sum + Number(b.remainingValue), 0),
                          )}
                        </td>
                        <td className="p-3">
                          <FormDialog
                            title="Pisahkan Stok Gudang"
                            trigger="Pisahkan sebagai Bahan Jadi"
                          >
                            <LegacyWarehouseForm
                              id={item.id}
                              version={item.updatedAt.toISOString()}
                              name={item.name}
                              today={today}
                            />
                          </FormDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <div
            className="panel flex flex-wrap items-center gap-3 p-3"
            aria-label="Pencarian dan filter stok gudang"
          >
            <form
              aria-label="Pencarian stok gudang"
              className="flex min-w-[200px] flex-[1_1_240px] items-center rounded-lg border border-[#d6e3db] bg-white focus-within:border-[#5c9b58] focus-within:ring-2 focus-within:ring-emerald-100"
            >
              <input type="hidden" name="tab" value="stock" />
              <input type="hidden" name="stage" value={stage} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                aria-label="Cari stok gudang"
                className="shrink-0 rounded-l-lg py-2.5 pl-3 pr-2 text-[#6b8c78] focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <UiIcon name="search" size={17} />
              </button>
              <input
                type="search"
                name="q"
                aria-label="Cari stok gudang"
                maxLength={150}
                defaultValue={q}
                placeholder="Cari nama barang..."
                className="min-w-0 flex-1 rounded-r-lg bg-transparent py-2.5 pr-3 text-xs text-slate-700 outline-none"
              />
            </form>
            <nav aria-label="Jenis stok gudang" className="flex flex-wrap items-center gap-1.5">
              {[
                ["", "Semua Jenis"],
                ...warehouseKinds.map((kind) => [kind, warehouseKindNames[kind]]),
              ].map(([key, label]) => (
                <Link
                  key={key}
                  href={href("stock", { stage: key })}
                  prefetch={false}
                  aria-current={stage === key ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2.5 text-[11px] transition-colors ${stage === key ? "bg-[#5c9b58] font-semibold text-white" : "bg-[#edf3ef] text-[#335c48] hover:bg-[#e0ece3]"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <nav
              aria-label="Filter stok"
              className="flex flex-wrap items-center gap-2 lg:border-l lg:border-[#dfe8e2] lg:pl-3"
            >
              {[
                ["", "Semua"],
                ["available", "Tersedia"],
                ["empty", "Barang Habis"],
                ["inactive", "Sampah"],
              ].map(([key, label]) => (
                <Link
                  key={key}
                  href={href("stock", { status: key })}
                  prefetch={false}
                  className={`inventory-filter ${status === key ? "inventory-filter-active" : ""}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {status === "inactive" && (
            <p className="text-sm text-slate-500">
              Bahan yang dihapus disimpan di sini. Buka detail bahan untuk Kembalikan atau Hapus
              Permanen. Stok dan riwayat tetap tersimpan.
            </p>
          )}
          <div className="space-y-3">
            {stockItems.map((item) => {
              const remaining = quantities(
                  item.batches.map((b) => ({
                    quantity: Number(b.remainingQuantity),
                    unit: b.baseUnit,
                  })),
                ),
                available = isAvailable(item),
                referenceQty = item.batches
                  .filter((b) => b.baseUnit === item.baseUnit)
                  .reduce((sum, b) => sum + Number(b.remainingQuantity), 0),
                low = Number(item.minimumStock) > 0 && referenceQty <= Number(item.minimumStock),
                loss = item.batches.flatMap((b) =>
                  b.movements
                    .filter((m) => ["PREP", "LOSS", "DAILY"].includes(m.operation.kind))
                    .map((m) => ({
                      quantity: Math.max(0, Number(m.quantityBefore) - Number(m.quantityAfter)),
                      unit: b.baseUnit,
                    })),
                );
              return (
                <details key={item.id} className="panel overflow-hidden">
                  <summary className="inventory-stock-summary">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {avatar(item)}
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.batches.length} batch - {loss.length} koreksi susut
                        </p>
                      </div>
                    </div>
                    <div className="inventory-stock-facts">
                      <div className="hidden sm:block">
                        <p className="text-xs text-slate-400">Kategori</p>
                        <p className="mt-1 text-xs">
                          {warehouseKindNames[item.kind]} - {item.category}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Susut</p>
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          {quantities(loss, item.batches[0]?.baseUnit || item.baseUnit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600">Sisa</p>
                        <p className="mt-1 max-w-48 text-sm font-bold">{remaining}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${!item.active ? "bg-slate-100 text-slate-500" : !available ? "bg-red-50 text-red-700" : low ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {!item.active
                          ? "Sampah"
                          : !available
                            ? "Habis"
                            : low
                              ? "Stok rendah"
                              : "Aman"}
                      </span>
                      <span className="inventory-detail-chevron">
                        <UiIcon name="chevron" size={17} />
                      </span>
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px] text-left text-xs">
                        <thead>
                          <tr>
                            {[
                              "Batch",
                              "Tgl Masuk",
                              "Asal / Supplier",
                              "Jumlah Awal",
                              "Perubahan Qty",
                              "Sisa",
                              "HPP / Satuan",
                              "Nilai Sisa",
                            ].map((label) => (
                              <th key={label} className="p-3">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {item.batches.map((b, index) => (
                            <tr key={b.id}>
                              <td className="p-3">Batch #{index + 1}</td>
                              <td className="whitespace-nowrap p-3">{displayDate(b.receivedAt)}</td>
                              <td className="p-3">
                                {b.returnReceipt
                                  ? "Retur outlet · " + b.returnReceipt.line.stockReturn.outlet.name
                                  : b.productionId
                                    ? "Produksi internal"
                                    : b.sourceLine?.receipt.supplierName || "Tanpa supplier"}
                              </td>
                              <td className="whitespace-nowrap p-3">
                                {quantityLabel(Number(b.initialQuantity), b.baseUnit)}
                              </td>
                              <td className="whitespace-nowrap p-3">
                                {quantityLabel(
                                  inventoryRound(
                                    Number(b.remainingQuantity) - Number(b.initialQuantity),
                                  ),
                                  b.baseUnit,
                                )}
                              </td>
                              <td className="whitespace-nowrap p-3 font-semibold">
                                {quantityLabel(Number(b.remainingQuantity), b.baseUnit)}
                              </td>
                              <td className="whitespace-nowrap p-3">
                                {Number(b.remainingQuantity) > 0
                                  ? unitPrice(
                                      inventoryRound(
                                        Number(b.remainingValue) / Number(b.remainingQuantity),
                                        4,
                                      ),
                                    ) +
                                    " / " +
                                    b.baseUnit.toLowerCase()
                                  : "-"}
                              </td>
                              <td className="whitespace-nowrap p-3">
                                {currency(Number(b.remainingValue))}
                              </td>
                            </tr>
                          ))}
                          {!item.batches.length && (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-slate-400">
                                Belum ada penerimaan untuk bahan ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Alert minimum: {quantityLabel(Number(item.minimumStock), item.baseUnit)}.
                        Jumlah berbeda satuan ditampilkan terpisah.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <FormDialog title="Edit Barang Gudang" trigger="Edit Barang">
                          <InventoryCatalogForm
                            initial={draft(item)}
                            kind={item.kind}
                            warehouse
                            ingredients={ingredients}
                            units={savedUnits}
                          />
                        </FormDialog>
                        <FormDialog
                          title={item.active ? "Hapus Bahan" : "Kembalikan Bahan"}
                          trigger={item.active ? "Hapus" : "Kembalikan"}
                          danger={item.active}
                        >
                          <InventoryItemLifecycleForm
                            item={{
                              id: item.id,
                              name: item.name,
                              version: item.updatedAt.toISOString(),
                            }}
                            operation={item.active ? "ARCHIVE" : "RESTORE"}
                            today={today}
                          />
                        </FormDialog>
                        {!item.active && (
                          <FormDialog title="Hapus Permanen" trigger="Hapus Permanen" danger>
                            <InventoryItemLifecycleForm
                              item={{
                                id: item.id,
                                name: item.name,
                                version: item.updatedAt.toISOString(),
                              }}
                              operation="DELETE"
                              today={today}
                              blocked={permanentDeletionReason(item._count)}
                              ownRecipes={item._count.recipe}
                            />
                          </FormDialog>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
            {!stockItems.length && (
              <div className="panel p-10 text-center text-sm text-slate-400">
                Tidak ada bahan yang sesuai filter.
              </div>
            )}
          </div>
        </>
      )}
      {(tab === "susut" || tab === "opname") && (
        <form className="panel flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="tab" value={tab} />
          {tab === "susut" && <input type="hidden" name="mode" value={mode} />}
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
      )}
      {tab === "susut" && (
        <>
          <nav aria-label="Jenis susut" className="flex gap-2">
            <Link
              href={href("susut", { mode: "prep" })}
              prefetch={false}
              className={`inventory-filter ${mode === "prep" ? "inventory-filter-active" : ""}`}
            >
              Susut Prep
            </Link>
            <Link
              href={href("susut", { mode: "harian" })}
              prefetch={false}
              className={`inventory-filter ${mode === "harian" ? "inventory-filter-active" : ""}`}
            >
              Susut Harian
            </Link>
          </nav>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={mode === "prep" ? "SUSUT PREP" : "SUSUT HARIAN"}
              value={quantities(
                operations
                  .filter((o) =>
                    mode === "prep" ? o.kind === "PREP" : ["LOSS", "DAILY"].includes(o.kind),
                  )
                  .flatMap((o) =>
                    o.movements.map((m) => ({
                      quantity: Math.max(0, Number(m.quantityBefore) - Number(m.quantityAfter)),
                      unit: m.batch.baseUnit,
                    })),
                  ),
              )}
              note="pada periode riwayat yang dipilih"
              icon="arrow"
              tone="text-amber-700 bg-amber-50"
            />
            <Metric
              label="MODAL HILANG"
              value={currency(
                operations
                  .filter((o) =>
                    mode === "prep" ? o.kind === "PREP" : ["LOSS", "DAILY"].includes(o.kind),
                  )
                  .reduce(
                    (s, o) =>
                      s +
                      o.movements.reduce(
                        (sum, m) => sum + Math.max(0, Number(m.valueBefore) - Number(m.valueAfter)),
                        0,
                      ),
                    0,
                  ),
              )}
              note={
                mode === "prep"
                  ? "modal batch dipertahankan saat prep"
                  : "nilai barang rusak / terbuang"
              }
              icon="wallet"
              tone="text-red-700 bg-red-50"
            />
            <Metric
              label="KOREKSI TERCATAT"
              value={
                operations.filter((o) =>
                  mode === "prep" ? o.kind === "PREP" : ["LOSS", "DAILY"].includes(o.kind),
                ).length
              }
              note="transaksi pada periode ini"
              icon="receipt"
            />
          </div>
          <section className="panel overflow-hidden">
            <h3 className="border-b border-slate-100 p-4 text-sm font-bold">
              RIWAYAT {mode === "prep" ? "SUSUT PREP" : "SUSUT HARIAN"}
            </h3>
            <div className="overflow-x-auto">
              <SortableTable className="w-full min-w-[1100px] text-left text-xs">
                <thead>
                  <tr>
                    {[
                      "Tanggal / Petugas",
                      "Barang / Batch",
                      "Sebelum",
                      "Sesudah",
                      "Susut",
                      "% Susut",
                      "HPP Lama",
                      "HPP Baru",
                      "Alasan",
                    ].map((label) => (
                      <th key={label} className="p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operations
                    .filter((o) =>
                      mode === "prep" ? o.kind === "PREP" : ["LOSS", "DAILY"].includes(o.kind),
                    )
                    .flatMap((o) =>
                      o.movements.map((m) => (
                        <tr key={m.id}>
                          <td className="p-3">
                            {displayDate(o.date)}
                            <p className="mt-1 text-slate-400">{o.createdBy.name}</p>
                          </td>
                          <td className="p-3">
                            {m.batch.item.name}
                            <p className="mt-1 text-slate-400">
                              Masuk {displayDate(m.batch.receivedAt)}
                            </p>
                          </td>
                          <td className="p-3">
                            {quantityLabel(Number(m.quantityBefore), m.batch.baseUnit)}
                          </td>
                          <td className="p-3">
                            {quantityLabel(Number(m.quantityAfter), m.batch.baseUnit)}
                          </td>
                          <td className="p-3">
                            {quantityLabel(
                              Number(m.quantityBefore) - Number(m.quantityAfter),
                              m.batch.baseUnit,
                            )}
                          </td>
                          <td className="p-3">
                            {Number(m.quantityBefore) > 0
                              ? (
                                  ((Number(m.quantityBefore) - Number(m.quantityAfter)) /
                                    Number(m.quantityBefore)) *
                                  100
                                ).toLocaleString("id-ID", { maximumFractionDigits: 2 })
                              : 0}
                            %
                          </td>
                          <td className="p-3">
                            {Number(m.quantityBefore) > 0
                              ? unitPrice(
                                  inventoryRound(
                                    Number(m.valueBefore) / Number(m.quantityBefore),
                                    4,
                                  ),
                                )
                              : "-"}
                          </td>
                          <td className="p-3">
                            {Number(m.quantityAfter) > 0
                              ? unitPrice(
                                  inventoryRound(Number(m.valueAfter) / Number(m.quantityAfter), 4),
                                )
                              : "-"}
                          </td>
                          <td className="max-w-64 whitespace-pre-wrap p-3">{o.notes}</td>
                        </tr>
                      )),
                    )}
                  {!operations.some((o) =>
                    mode === "prep" ? o.kind === "PREP" : ["LOSS", "DAILY"].includes(o.kind),
                  ) && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Belum ada riwayat susut pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableTable>
            </div>
          </section>
        </>
      )}
      {tab === "opname" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="TERAKHIR HITUNG"
              value={lastOpname ? displayDate(lastOpname.date) : "-"}
              note={lastOpname ? "opname terakhir yang tersimpan" : "belum pernah opname"}
              icon="calendar"
            />
            <Metric
              label="SELISIH DITEMUKAN"
              value={
                (lastOpname?.movements.filter(
                  (m) => Number(m.quantityBefore) !== Number(m.quantityAfter),
                ).length || 0) + " batch"
              }
              note="pada opname terakhir"
              icon="alert"
              tone="text-amber-700 bg-amber-50"
            />
            <Metric
              label="NILAI KOREKSI TERAKHIR"
              value={
                lastOpname
                  ? currency(
                      lastOpname.movements.reduce(
                        (sum, m) => sum + Number(m.valueAfter) - Number(m.valueBefore),
                        0,
                      ),
                    )
                  : "-"
              }
              note="selisih nilai stok fisik dan sistem"
              icon="receipt"
            />
          </div>
          <section className="panel overflow-hidden">
            <h3 className="border-b border-slate-100 p-4 text-sm font-bold">
              RIWAYAT OPNAME & KOREKSI JUMLAH
            </h3>
            <div className="overflow-x-auto">
              <SortableTable className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Tanggal",
                      "Petugas",
                      "Batch Diperiksa",
                      "Batch Selisih",
                      "Nilai Selisih",
                      "Status / Detail",
                    ].map((label) => (
                      <th key={label} className="whitespace-nowrap p-4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operations
                    .filter((o) => ["OPNAME", "ADJUST"].includes(o.kind))
                    .map((o) => (
                      <tr key={o.id}>
                        <td className="whitespace-nowrap p-4">{displayDate(o.date)}</td>
                        <td className="p-4">{o.createdBy.name}</td>
                        <td className="p-4">{o.movements.length}</td>
                        <td className="p-4">
                          {
                            o.movements.filter(
                              (m) => Number(m.quantityBefore) !== Number(m.quantityAfter),
                            ).length
                          }
                        </td>
                        <td className="whitespace-nowrap p-4">
                          {currency(
                            o.movements.reduce(
                              (sum, m) => sum + Number(m.valueAfter) - Number(m.valueBefore),
                              0,
                            ),
                          )}
                        </td>
                        <td className="min-w-64 p-4">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold text-emerald-700">
                              {o.kind === "OPNAME"
                                ? "Selesai - lihat detail"
                                : "Koreksi jumlah - lihat detail"}
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-xs">{o.notes}</p>
                            <ul className="mt-2 space-y-1 text-xs">
                              {o.movements.map((m) => (
                                <li key={m.id}>
                                  {m.batch.item.name}:{" "}
                                  {quantityLabel(Number(m.quantityBefore), m.batch.baseUnit)}{" "}
                                  menjadi {quantityLabel(Number(m.quantityAfter), m.batch.baseUnit)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                      </tr>
                    ))}
                  {!operations.some((o) => ["OPNAME", "ADJUST"].includes(o.kind)) && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Belum ada riwayat hitung stok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableTable>
            </div>
          </section>
        </>
      )}
      {(tab === "produk" || tab === "subproduk") && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              label={tab === "produk" ? "TOTAL PRODUK" : "SUB-PRODUK AKTIF"}
              value={
                tab === "produk"
                  ? products.length
                  : subItems.filter((i) => i.active).length + " item"
              }
              note={
                tab === "produk"
                  ? "produk corndog yang terdaftar"
                  : subItems.length + " total sub-produk"
              }
              icon="tag"
            />
            <Metric
              label={tab === "produk" ? "PRODUK AKTIF" : "STOK NYATA"}
              value={
                tab === "produk"
                  ? products.filter((i) => i.active).length
                  : subItems.filter(isAvailable).length + " item"
              }
              note={
                tab === "produk"
                  ? products.filter((i) => !i.active).length + " dinonaktifkan"
                  : "sub-produk dengan stok tersedia"
              }
              icon="check"
            />
          </div>
          {tab === "produk" ? (
            <>
              <div className="panel flex flex-wrap items-center gap-3 p-3">
                <form
                  role="search"
                  aria-label="Pencarian produk"
                  className="flex min-w-[200px] flex-[1_1_280px] items-center rounded-lg border border-[#d6e3db] bg-white focus-within:border-[#5c9b58] focus-within:ring-2 focus-within:ring-emerald-100"
                >
                  <input type="hidden" name="tab" value={tab} />
                  <input type="hidden" name="status" value={status} />
                  <input type="hidden" name="group" value={productGroup.key} />
                  <button
                    type="submit"
                    aria-label="Cari produk"
                    className="shrink-0 rounded-l-lg py-2.5 pl-3 pr-2 text-[#6b8c78] focus-visible:outline-2 focus-visible:outline-emerald-600"
                  >
                    <UiIcon name="search" size={17} />
                  </button>
                  <input
                    type="search"
                    name="q"
                    aria-label="Cari produk"
                    maxLength={150}
                    defaultValue={q}
                    placeholder="Cari menu..."
                    className="min-w-0 flex-1 rounded-r-lg bg-transparent py-2.5 pr-3 text-xs text-slate-700 outline-none"
                  />
                </form>
                <nav
                  aria-label="Filter jenis produk"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {productGroups.map((group) => (
                    <Link
                      key={group.key}
                      href={href(tab, { group: group.key })}
                      prefetch={false}
                      aria-current={productGroup.key === group.key ? "page" : undefined}
                      className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2.5 text-[11px] transition-colors ${productGroup.key === group.key ? "bg-[#5c9b58] font-semibold text-white" : "bg-[#edf3ef] text-[#335c48] hover:bg-[#e0ece3]"}`}
                    >
                      {group.key ? group.name : "Semua"}
                    </Link>
                  ))}
                </nav>
                <nav
                  aria-label="Filter produk"
                  className="flex flex-wrap items-center gap-2 lg:border-l lg:border-[#dfe8e2] lg:pl-3"
                >
                  <span className="mr-1 whitespace-nowrap text-xs text-slate-400">
                    Status produk
                  </span>
                  {[
                    ["", "Semua"],
                    ["active", "Aktif"],
                    ["inactive", "Nonaktif"],
                  ].map(([key, label]) => (
                    <Link
                      key={key}
                      href={href(tab, { status: key })}
                      prefetch={false}
                      className={`inventory-filter ${status === key ? "inventory-filter-active" : ""}`}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <form className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="tab" value={tab} />
                <input type="hidden" name="status" value={status} />
                <label className="field">
                  Cari sub-produk
                  <input name="q" maxLength={150} defaultValue={q} placeholder="Cari nama..." />
                </label>
                <button className="button-secondary">Cari</button>
              </form>
              <nav aria-label="Filter produk" className="flex flex-wrap gap-2">
                {[
                  ["", "Semua"],
                  ["available", "Stok Nyata"],
                  ["empty", "Belum Diproduksi"],
                ].map(([key, label]) => (
                  <Link
                    key={key}
                    href={href(tab, { status: key })}
                    prefetch={false}
                    className={`inventory-filter ${status === key ? "inventory-filter-active" : ""}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {catalogItems.map(catalogCard)}
          </div>
          {!catalogItems.length && (
            <section className="panel p-10 text-center text-sm text-slate-400">
              Tidak ada produk yang sesuai filter atau pencarian.
            </section>
          )}
        </>
      )}
      {tab === "resep" && (
        <RecipeManagement
          q={q}
          kind="PRODUCT"
          items={items.map(
            (item): RecipeCostItem => ({
              id: item.id,
              name: item.name,
              kind: item.kind,
              baseUnit: item.baseUnit,
              active: item.active,
              version: item.updatedAt.toISOString(),
              sellingPrice: item.sellingPrice,
              productionYield: Number(item.productionYield),
              recipe: item.recipe.map((r) => ({
                ingredientId: r.ingredientId,
                quantity: Number(r.quantity),
                baseUnit: r.baseUnit,
              })),
              batches: item.batches.map((b) => ({
                baseUnit: b.baseUnit,
                remainingQuantity: Number(b.remainingQuantity),
                remainingValue: Number(b.remainingValue),
                initialQuantity: Number(b.initialQuantity),
                initialValue: Number(b.initialValue),
              })),
            }),
          )}
        />
      )}
      <p className="text-xs text-slate-400">
        Stok berasal dari penerimaan, koreksi, hitung fisik, dan produksi yang tercatat. Qty berbeda
        satuan ditampilkan terpisah. Penjualan POS belum mengurangi stok bahan otomatis.
      </p>
    </div>
  );
}
