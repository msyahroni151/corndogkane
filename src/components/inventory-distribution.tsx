import SearchForm from "next/form";
import { getPrisma } from "@/lib/db";
import { quantityLabel } from "@/lib/goods-receipts";
import { inventoryTrend } from "@/lib/inventory-dashboard-period";
import { displayDate } from "@/lib/placements";

const count = (value: number) => value.toLocaleString("id-ID");

export async function InventoryDistribution({
  start,
  end,
  days,
  requestedOutlet,
  requestedUnit,
}: {
  start: Date;
  end: Date;
  days: number;
  requestedOutlet: string;
  requestedUnit: string;
}) {
  const db = getPrisma();
  const [orders, activeOutlets] = await Promise.all([
    db.outletStockOrder.findMany({
      relationLoadStrategy: "join",
      where: {
        status: { in: ["SENT", "RECEIVED"] },
        shipment: { kind: "TRANSFER_OUT", date: { gte: start, lte: end } },
      },
      select: {
        status: true,
        outlet: { select: { id: true, name: true } },
        shipment: { select: { date: true } },
        lines: { select: { quantity: true, unit: true } },
      },
    }),
    db.outlet.findMany({
      where: { active: true, closed: false },
      select: { id: true, name: true },
    }),
  ]);
  const outlets = new Map(activeOutlets.map((outlet) => [outlet.id, outlet.name]));
  for (const { outlet } of orders) outlets.set(outlet.id, outlet.name);
  const outletOptions = [...outlets].sort((a, b) => a[1].localeCompare(b[1], "id"));
  const selectedOutlet = outlets.has(requestedOutlet) ? requestedOutlet : "";
  const totals = new Map<number, number>();
  const quantitiesByDay = new Map<number, number>();
  const units = new Set<string>();
  const summaries = new Map<
    string,
    { name: string; shipments: number; quantities: Map<string, number> }
  >();
  let shipments = 0;
  let awaitingConfirmation = 0;
  for (const order of orders) {
    if (!order.shipment || (selectedOutlet && order.outlet.id !== selectedOutlet)) continue;
    const time = order.shipment.date.getTime();
    totals.set(time, (totals.get(time) ?? 0) + 1);
    shipments++;
    if (order.status === "SENT") awaitingConfirmation++;

    const summary = summaries.get(order.outlet.id) ?? {
      name: order.outlet.name,
      shipments: 0,
      quantities: new Map<string, number>(),
    };
    summary.shipments++;
    for (const line of order.lines) {
      units.add(line.unit);
      const quantity = Number(line.quantity);
      const previous = summary.quantities.get(line.unit) ?? 0;
      summary.quantities.set(line.unit, previous + quantity);
      if (line.unit === requestedUnit)
        quantitiesByDay.set(time, (quantitiesByDay.get(time) ?? 0) + quantity);
    }
    summaries.set(order.outlet.id, summary);
  }
  const unit = units.has(requestedUnit) ? requestedUnit : "";
  const trend = inventoryTrend(start, days, unit ? quantitiesByDay : totals);
  const peak = Math.max(...trend.map((point) => point.total)) || 1;
  const trendPeriod = days > 31 ? "per 7 hari" : "per hari";
  const chartLabel = unit
    ? `Jumlah barang ${trendPeriod} (${unit.toLowerCase()})`
    : `Transaksi barang keluar ${trendPeriod}`;
  const chartValue = (value: number) =>
    unit ? quantityLabel(value, unit) : `${count(value)} transaksi`;
  const byOutlet = [...summaries].sort(
    (a, b) => b[1].shipments - a[1].shipments || a[1].name.localeCompare(b[1].name, "id"),
  );

  return (
    <section className="panel min-w-0 p-5" aria-labelledby="inventory-distribution-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="inventory-distribution-title" className="text-base font-bold">
            Tren barang keluar per outlet
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Barang yang sudah tercatat keluar dari gudang, berdasarkan tanggal mutasi WIB.
          </p>
        </div>
        <SearchForm
          action="/dashboard-inventory"
          prefetch={false}
          scroll={false}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="from" value={start.toISOString().slice(0, 10)} />
          <input type="hidden" name="to" value={end.toISOString().slice(0, 10)} />
          <label className="field min-w-0">
            Outlet pemesan
            <select key={selectedOutlet} name="distributionOutlet" defaultValue={selectedOutlet}>
              <option value="">Semua outlet</option>
              {outletOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Ukuran grafik
            <select key={unit} name="distributionUnit" defaultValue={unit}>
              <option value="">Jumlah transaksi</option>
              {[...units].sort().map((option) => (
                <option key={option} value={option}>
                  Kuantitas ({option.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button-secondary">
            Terapkan
          </button>
        </SearchForm>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        <strong>{count(shipments)} transaksi barang keluar</strong> · {count(awaitingConfirmation)}{" "}
        belum dikonfirmasi · {count(shipments - awaitingConfirmation)} sudah dikonfirmasi
      </p>
      {shipments ? (
        <div className="mt-3 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600">{chartLabel}</p>
            <div className="mt-2 overflow-x-auto">
              <div className={trend.length > 14 ? "min-w-[26rem]" : "min-w-[14rem]"}>
                <ol
                  className="flex h-36 items-end gap-1 border-b border-emerald-100"
                  aria-label={chartLabel}
                >
                  {trend.map((point) => (
                    <li
                      key={point.key}
                      className="flex h-full min-w-0 flex-1 items-end"
                      title={`${point.label} · ${chartValue(point.total)}`}
                    >
                      <span className="sr-only">
                        {point.label} · {chartValue(point.total)}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`w-full rounded-t-sm ${point.total ? "bg-[#5f8a78]" : "bg-slate-200"}`}
                        style={{ height: point.total ? `${(point.total / peak) * 100}%` : "2px" }}
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
          </div>
          <div>
            <h3 className="text-sm font-semibold">Rincian per outlet</h3>
            <ul className="mt-1 max-h-48 divide-y divide-slate-100 overflow-auto">
              {byOutlet.map(([id, outlet]) => (
                <li key={id} className="py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{outlet.name}</span>
                    <span className="shrink-0">{count(outlet.shipments)} transaksi</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[...outlet.quantities]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([unit, quantity]) => quantityLabel(quantity, unit))
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">
          Belum ada barang keluar untuk {selectedOutlet ? outlets.get(selectedOutlet) : "outlet"}{" "}
          pada periode ini.
        </p>
      )}
    </section>
  );
}
