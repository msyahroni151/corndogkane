import Link from "next/link";
import SearchForm from "next/form";
import { Suspense } from "react";
import { InventoryDistribution } from "@/components/inventory-distribution";
import { LocalInput } from "@/components/local-input";
import { UiIcon, type IconName } from "@/components/ui-icon";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { quantityLabel } from "@/lib/goods-receipts";
import {
  inventoryDashboardMaxDays,
  inventoryDashboardRange,
  inventoryTrend,
} from "@/lib/inventory-dashboard-period";
import { warehouseKinds, warehouseKindNames } from "@/lib/inventory";
import { inventoryMenu } from "@/lib/navigation";
import { rupiah } from "@/lib/money";
import { permissionForPath } from "@/lib/permissions";
import { displayDate, todayWib } from "@/lib/placements";

export const metadata = { title: "Dashboard Inventori & Pembelian" };
const count = (value: number) => value.toLocaleString("id-ID");

type Metric = { title: string; value: string; note: string; icon: IconName };

export default async function InventoryDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    distributionOutlet?: string;
    distributionUnit?: string;
  }>;
}) {
  const user = await requireAccess("dashboard-inventory");
  const query = await searchParams;
  const today = todayWib();
  const { start, end, days, error } = inventoryDashboardRange(query, today);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  const canViewDistribution = user.permissions.includes("control-stok");
  const distributionOutlet =
    canViewDistribution && typeof query.distributionOutlet === "string"
      ? query.distributionOutlet.slice(0, 100)
      : "";
  const distributionUnit =
    canViewDistribution && typeof query.distributionUnit === "string"
      ? query.distributionUnit.slice(0, 40)
      : "";
  const date = { gte: start, lte: end };
  const db = getPrisma();
  const warehouse = { active: true, kind: { in: [...warehouseKinds] } };
  const [purchases, recent, items, stock, productionCount] = await Promise.all([
    db.goodsReceipt.groupBy({
      by: ["date", "paid"],
      where: { date },
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.goodsReceipt.findMany({
      where: { date },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 6,
      select: { id: true, date: true, supplierName: true, total: true, paid: true },
    }),
    db.inventoryItem.findMany({
      where: warehouse,
      select: { id: true, kind: true, name: true, baseUnit: true, minimumStock: true },
    }),
    db.inventoryBatch.groupBy({
      by: ["itemId", "baseUnit"],
      where: { item: warehouse, remainingQuantity: { gt: 0 } },
      _sum: { remainingQuantity: true, remainingValue: true },
    }),
    user.permissions.includes("produksi-gudang")
      ? db.inventoryOperation.count({ where: { kind: "PRODUCTION", date } })
      : null,
  ]);

  const dailyTotals = new Map<number, number>();
  let purchaseValue = 0,
    receipts = 0,
    unpaid = 0,
    unpaidCount = 0;
  for (const row of purchases) {
    const time = row.date.getTime();
    const value = row._sum.total ?? 0;
    dailyTotals.set(time, (dailyTotals.get(time) ?? 0) + value);
    purchaseValue += value;
    receipts += row._count._all;
    if (!row.paid) {
      unpaid += value;
      unpaidCount += row._count._all;
    }
  }
  const trend = inventoryTrend(start, days, dailyTotals);
  const peak = Math.max(1, ...trend.map((point) => point.total));
  const trendPeriod = days > 31 ? "per 7 hari" : "per hari";
  const stocked = new Set(stock.map((row) => row.itemId));
  const currentStock = new Map(
    stock.map((row) => [`${row.itemId}:${row.baseUnit}`, Number(row._sum.remainingQuantity ?? 0)]),
  );
  const stockValue = stock.reduce((sum, row) => sum + Number(row._sum.remainingValue ?? 0), 0);
  const lowStock = items
    .flatMap((item) => {
      const minimum = Number(item.minimumStock);
      const quantity = currentStock.get(`${item.id}:${item.baseUnit}`) ?? 0;
      return minimum > 0 && quantity < minimum ? [{ ...item, minimum, quantity }] : [];
    })
    .sort(
      (a, b) => a.quantity / a.minimum - b.quantity / b.minimum || a.name.localeCompare(b.name),
    );
  const shortcuts = inventoryMenu.slice(1).filter((item) => {
    const permission = permissionForPath(item.href);
    return permission && user.permissions.includes(permission);
  });
  const metrics: Metric[] = [
    {
      title: "Nilai pembelian",
      value: rupiah(purchaseValue),
      note: "Periode terpilih, termasuk biaya porter",
      icon: "wallet",
    },
    {
      title: "Barang masuk",
      value: count(receipts),
      note: "Transaksi penerimaan dalam periode terpilih",
      icon: "package-in",
    },
    {
      title: "Belum dibayar",
      value: rupiah(unpaid),
      note: `${count(unpaidCount)} penerimaan belum ditandai lunas pada periode ini`,
      icon: "receipt",
    },
    {
      title: "Nilai stok gudang",
      value: rupiah(Math.round(stockValue)),
      note: "Nilai persediaan aktif saat ini",
      icon: "boxes",
    },
    {
      title: "Di bawah stok minimum",
      value: count(lowStock.length),
      note: "Barang aktif yang memiliki batas minimum",
      icon: "alert",
    },
  ];
  if (productionCount !== null)
    metrics.push({
      title: "Produksi gudang",
      value: count(productionCount),
      note: "Pencatatan hasil produksi dalam periode terpilih",
      icon: "box",
    });

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-end justify-between gap-3 p-4">
        <SearchForm
          key={`${from}:${to}`}
          action="/dashboard-inventory"
          prefetch={false}
          scroll={false}
          className="flex flex-wrap items-end gap-3"
        >
          {distributionOutlet && (
            <input type="hidden" name="distributionOutlet" value={distributionOutlet} />
          )}
          {distributionUnit && (
            <input type="hidden" name="distributionUnit" value={distributionUnit} />
          )}
          <label className="field w-40">
            Tanggal awal
            <LocalInput type="date" name="from" defaultValue={from} max={today} required />
          </label>
          <label className="field w-40">
            Tanggal akhir
            <LocalInput type="date" name="to" defaultValue={to} max={today} required />
          </label>
          <button type="submit" className="button-primary">
            Terapkan tanggal
          </button>
        </SearchForm>
        <nav aria-label="Periode dashboard" className="flex gap-2">
          {[7, 30].map((period) => (
            <Link
              key={period}
              href={`?${new URLSearchParams({
                period: String(period),
                ...(distributionOutlet ? { distributionOutlet } : {}),
                ...(distributionUnit ? { distributionUnit } : {}),
              })}`}
              prefetch={false}
              aria-current={to === today && days === period ? "page" : undefined}
              className={to === today && days === period ? "button-primary" : "button-secondary"}
            >
              {period} hari
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-xs text-slate-600">
        Periode tampil {displayDate(start)} – {displayDate(end)} WIB · Maksimal{" "}
        {inventoryDashboardMaxDays} hari
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ title, value, note, icon }) => (
          <section key={title} className="panel relative p-4 pr-14">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-2 break-words text-xl font-bold text-[#284c39]">{value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
            <span className="absolute top-4 right-4 rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <UiIcon name={icon} size={18} />
            </span>
          </section>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel min-w-0 p-5">
          <h2 className="text-base font-bold">Tren pembelian</h2>
          <p className="mt-1 text-xs text-slate-500">Nilai penerimaan barang {trendPeriod}.</p>
          {receipts ? (
            <div className="mt-4 overflow-x-auto">
              <div className={trend.length > 14 ? "min-w-[30rem]" : "min-w-[14rem]"}>
                <ol
                  className="flex h-40 items-end gap-1 border-b border-emerald-100"
                  aria-label={`Nilai pembelian ${trendPeriod}`}
                >
                  {trend.map(({ key, label, total }) => (
                    <li
                      key={key}
                      className="flex h-full min-w-0 flex-1 items-end"
                      title={`${label} · ${rupiah(total)}`}
                    >
                      <span className="sr-only">
                        {label} {rupiah(total)}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`w-full rounded-t-sm ${total ? "bg-[#6b9a71]" : "bg-slate-200"}`}
                        style={{ height: total ? `${Math.max(2, (total / peak) * 100)}%` : "2px" }}
                      />
                    </li>
                  ))}
                </ol>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>{displayDate(start)}</span>
                  <span>{displayDate(end)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Belum ada pembelian pada periode ini.
            </p>
          )}
        </section>
        <section className="panel p-5">
          <h2 className="text-base font-bold">Stok tersedia per jenis</h2>
          <p className="mt-1 text-xs text-slate-500">
            Jumlah barang aktif yang masih memiliki saldo.
          </p>
          <dl className="mt-3 divide-y divide-slate-100">
            {warehouseKinds.map((kind) => (
              <div key={kind} className="flex items-center justify-between gap-3 py-3 text-sm">
                <dt>{warehouseKindNames[kind]}</dt>
                <dd className="font-semibold">
                  {count(items.filter((item) => item.kind === kind && stocked.has(item.id)).length)}{" "}
                  barang
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      {canViewDistribution && (
        <Suspense
          fallback={
            <section className="panel min-h-48 p-5" aria-busy="true">
              <h2 className="text-base font-bold">Tren barang keluar per outlet</h2>
            </section>
          }
        >
          <InventoryDistribution
            start={start}
            end={end}
            days={days}
            requestedOutlet={distributionOutlet}
            requestedUnit={distributionUnit}
          />
        </Suspense>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-base font-bold">Penerimaan terbaru</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {recent.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-semibold">{row.supplierName || "Tanpa supplier"}</p>
                  <p className="text-xs text-slate-500">{displayDate(row.date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{rupiah(row.total)}</p>
                  <p className={`text-xs ${row.paid ? "text-emerald-700" : "text-amber-700"}`}>
                    {row.paid ? "Lunas" : "Belum dibayar"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {!recent.length && (
            <p className="py-5 text-sm text-slate-500">Belum ada penerimaan pada periode ini.</p>
          )}
        </section>
        <section className="panel p-5">
          <h2 className="text-base font-bold">Barang perlu dicek</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {lowStock.slice(0, 6).map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <p className="font-semibold">{item.name}</p>
                <p className="text-amber-800">
                  {quantityLabel(item.quantity, item.baseUnit)} / min.{" "}
                  {quantityLabel(item.minimum, item.baseUnit)}
                </p>
              </li>
            ))}
          </ul>
          {!lowStock.length && (
            <p className="py-5 text-sm text-slate-500">
              Tidak ada barang dengan saldo di bawah batas minimum.
            </p>
          )}
          {lowStock.length > 6 && (
            <p className="mt-3 text-xs text-slate-500">
              Menampilkan 6 dari {count(lowStock.length)} barang.
            </p>
          )}
        </section>
      </div>
      {!!shortcuts.length && (
        <nav aria-label="Akses cepat inventori dan pembelian" className="flex flex-wrap gap-2">
          {shortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="button-secondary gap-2"
              prefetch={false}
            >
              <UiIcon name={item.icon} size={15} />
              {item.name}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
