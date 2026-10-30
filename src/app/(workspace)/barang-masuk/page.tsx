import Link from "next/link";

import { requireAccess } from "@/lib/auth";

import { getPrisma } from "@/lib/db";

import { displayDate, parseCivilDate, todayWib } from "@/lib/placements";

import { quantityLabel } from "@/lib/goods-receipts";

import { rupiah } from "@/lib/money";

import { FormDialog } from "@/components/form-dialog";

import { GoodsReceiptForm } from "@/components/goods-receipt-form";

import { LocalInput } from "@/components/local-input";

import { SortableTable } from "@/components/sortable-table";

import { UiIcon, type IconName } from "@/components/ui-icon";

import type { Prisma } from "@/generated/prisma/client";

import "@/components/goods-receipts.css";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;

    to?: string;

    method?: string;

    q?: string;

    saved?: string;
  }>;
}) {
  await requireAccess("barang-masuk");

  const query = await searchParams,
    today = todayWib(),
    from = typeof query.from === "string" ? query.from : today,
    to = typeof query.to === "string" ? query.to : today,
    q = typeof query.q === "string" ? query.q.trim().slice(0, 150) : "",
    method = ["TUNAI", "TRANSFER", "HUTANG", "COD"].includes(query.method || "")
      ? query.method!
      : "";

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
    base: Prisma.GoodsReceiptWhereInput = {
      date: { gte: start, lte: end },

      ...(q
        ? {
            OR: [
              { supplierName: { contains: q, mode: "insensitive" } },

              { lines: { some: { itemName: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    where: Prisma.GoodsReceiptWhereInput = {
      ...base,

      ...(method === "HUTANG"
        ? { paid: false }
        : method
          ? { paymentMethod: method, paid: true }
          : {}),
    };

  const [suppliers, items, rows, groups, quantities, sourceSuppliers] = await Promise.all([
    db.partner.findMany({
      where: { kind: "SUPPLIER" },

      select: { id: true, name: true, defaultPaymentMethod: true },

      orderBy: { name: "asc" },
    }),

    db.inventoryItem.findMany({
      where: { active: true, kind: { in: ["RAW", "SUB", "FINISHED"] } },
      select: { name: true, packagingUnit: true, baseUnit: true },

      orderBy: { name: "asc" },
    }),

    valid
      ? db.goodsReceipt.findMany({
          where,

          include: { lines: true },

          orderBy: [{ date: "desc" }, { createdAt: "desc" }],

          take: 500,
        })
      : [],

    valid
      ? db.goodsReceipt.groupBy({
          by: ["paymentMethod", "paid"],

          where: base,

          _sum: { total: true },

          _count: { _all: true },
        })
      : [],

    valid
      ? db.goodsReceiptLine.groupBy({
          by: ["baseUnit"],

          where: { receipt: base },

          _sum: { quantity: true },
        })
      : [],

    valid
      ? db.goodsReceipt.groupBy({
          by: ["supplierId"],

          where: { ...base, supplierId: { not: null } },
        })
      : [],
  ]);

  const count = groups.reduce((sum, g) => sum + g._count._all, 0),
    value = groups.reduce((sum, g) => sum + (g._sum.total || 0), 0),
    unpaid = groups.filter((g) => !g.paid),
    unpaidValue = unpaid.reduce((sum, g) => sum + (g._sum.total || 0), 0),
    unpaidCount = unpaid.reduce((sum, g) => sum + g._count._all, 0);

  const tabCount = (key: string) =>
      !key
        ? count
        : key === "HUTANG"
          ? unpaidCount
          : groups

              .filter((g) => g.paymentMethod === key && g.paid)

              .reduce((sum, g) => sum + g._count._all, 0),
    href = (key: string) =>
      "/barang-masuk?" +
      new URLSearchParams({ from, to, ...(q ? { q } : {}), ...(key ? { method: key } : {}) });

  const metrics: { label: string; value: string; note: string; icon: IconName; tone: string }[] = [
    {
      label: "TOTAL MASUK",

      value:
        quantities

          .map((g) => quantityLabel(Number(g._sum.quantity || 0), g.baseUnit))

          .join(" · ") || "0 pcs",

      note: `dari ${count} transaksi`,

      icon: "package-in",

      tone: "text-emerald-700 bg-emerald-50",
    },

    {
      label: "TOTAL NILAI BELI",

      value: rupiah(value),

      note: "termasuk biaya porter",

      icon: "wallet",

      tone: "text-amber-700 bg-amber-50",
    },

    {
      label: "BELUM DIBAYAR",

      value: rupiah(unpaidValue),

      note: `${unpaidCount} transaksi`,

      icon: "alert",

      tone: "text-red-600 bg-red-50",
    },

    {
      label: "SUPPLIER",

      value: `${sourceSuppliers.length} supplier`,

      note: "yang memasok",

      icon: "people",

      tone: "text-purple-600 bg-purple-50",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-3">
          <label className="field">
            Dari tanggal
            <LocalInput type="date" name="from" defaultValue={from} required />
          </label>

          <label className="field">
            Sampai tanggal
            <LocalInput type="date" name="to" defaultValue={to} required />
          </label>

          <label className="field">
            Pencarian
            <input
              name="q"
              defaultValue={q}
              maxLength={150}
              placeholder="Barang atau supplier..."
            />
          </label>

          <input type="hidden" name="method" value={method} />

          <button className="button-secondary">Terapkan</button>
        </form>

        <FormDialog
          title="Catat Barang Masuk"
          subtitle="Isi data penerimaan barang dari supplier"
          trigger="+ Catat Beli"
        >
          <GoodsReceiptForm today={today} suppliers={suppliers} items={items} />
        </FormDialog>
      </div>

      {!valid && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Pilih rentang tanggal yang valid, maksimal 1 tahun.
        </p>
      )}

      {query.saved && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
          Barang masuk berhasil disimpan.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <section key={metric.label} className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{metric.label}</p>
              <span className={`inline-flex shrink-0 rounded-lg p-2 ${metric.tone}`}>
                <UiIcon name={metric.icon} size={18} />
              </span>
            </div>
            <p className="mt-3 break-words text-lg font-bold">{metric.value}</p>

            <p className="mt-1 text-xs text-slate-400">{metric.note}</p>
          </section>
        ))}
      </div>

      <nav aria-label="Filter pembayaran barang masuk" className="flex flex-wrap gap-2">
        {[
          ["", "Semua"],

          ["TUNAI", "Tunai"],

          ["TRANSFER", "Transfer"],

          ["HUTANG", "Hutang"],

          ["COD", "COD"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={href(key)}
            prefetch={false}
            aria-current={method === key ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 text-sm ${method === key ? "border-[#4ca259] bg-[#4ca259] font-semibold text-white" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {label} <span className="ml-1 text-xs">{tabCount(key)}</span>
          </Link>
        ))}
      </nav>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <SortableTable className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="whitespace-nowrap px-5 py-3">Tanggal</th>

                <th className="px-5 py-3">Supplier / Barang</th>

                <th className="whitespace-nowrap px-5 py-3">Metode</th>

                <th className="whitespace-nowrap px-5 py-3">Total Tagihan</th>

                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td
                    className="whitespace-nowrap px-5 py-4"
                    data-sort-value={row.date.toISOString()}
                  >
                    {displayDate(row.date)}
                  </td>

                  <td className="min-w-[280px] px-5 py-4">
                    <p className="font-semibold">{row.supplierName || "Tanpa supplier"}</p>

                    <p className="mt-1 text-xs text-slate-500">
                      {row.lines.map((line) => line.itemName).join(", ")}
                    </p>

                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer font-semibold text-emerald-700">
                        Detail {row.lines.length} barang
                      </summary>

                      <ul className="mt-2 space-y-2">
                        {row.lines.map((line) => (
                          <li key={line.id}>
                            {line.itemName} ·{" "}
                            {quantityLabel(Number(line.packCount), line.packagingUnit)} ·{" "}
                            {quantityLabel(Number(line.quantityPerPack), line.inputUnit)} ={" "}
                            {quantityLabel(Number(line.quantity), line.baseUnit)} ·{" "}
                            {rupiah(line.amount)}
                          </li>
                        ))}
                      </ul>

                      {row.porterFee > 0 && (
                        <p className="mt-2">Biaya porter: {rupiah(row.porterFee)}</p>
                      )}

                      {row.notes && (
                        <p className="mt-2 whitespace-pre-wrap">Catatan: {row.notes}</p>
                      )}
                    </details>
                  </td>

                  <td className="px-5 py-4">{row.paymentMethod}</td>

                  <td
                    className="whitespace-nowrap px-5 py-4 font-semibold"
                    data-sort-value={row.total}
                  >
                    {rupiah(row.total)}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${row.paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {row.paid ? "Lunas" : "Belum dibayar"}
                    </span>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-400">
                    Belum ada barang masuk pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>

        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          {rows.length} transaksi ditampilkan · Maksimal 500 transaksi terbaru. Jumlah barang
          dipisahkan menurut satuannya.
        </p>
      </section>
    </div>
  );
}
