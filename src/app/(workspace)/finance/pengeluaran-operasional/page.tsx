import SearchForm from "next/form";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate, displayDate } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { isExpenseAccount, isPaymentAccount, type PaymentMethod } from "@/lib/operational-expenses";
import { FormDialog } from "@/components/form-dialog";
import { LocalInput } from "@/components/local-input";
import {
  OperationalExpenseForm,
  OperationalExpensePaymentForm,
} from "@/components/operational-expense-form";
import { SortableTable } from "@/components/sortable-table";
import { UiIcon } from "@/components/ui-icon";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import "@/components/operational-expenses.css";
export default async function OperationalExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; status?: string }>;
}) {
  await requireAccess("finance-expenses");
  const query = await searchParams,
    today = todayWib(),
    from = query.from || today.slice(0, 8) + "01",
    to = query.to || today,
    q = String(query.q || "")
      .trim()
      .slice(0, 200),
    status = ["PAID", "UNPAID"].includes(query.status || "") ? query.status! : "";
  let start = new Date(0),
    end = new Date(0),
    valid = true;
  try {
    start = parseCivilDate(from);
    end = parseCivilDate(to);
    if (end < start || end.getTime() - start.getTime() > 365 * 86400000) throw Error();
  } catch {
    valid = false;
  }
  const db = getPrisma(),
    where: Prisma.OperationalExpenseWhereInput = {
      date: { gte: start, lte: end },
      ...(q
        ? {
            OR: [
              { purpose: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
              { expenseName: { contains: q, mode: "insensitive" } },
              { expenseCode: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  const [accounts, rows, groups, purposes] = await Promise.all([
    db.financialAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    valid
      ? db.operationalExpense.findMany({
          where: { ...where, ...(status ? { status } : {}) },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 500,
        })
      : [],
    valid
      ? db.operationalExpense.groupBy({
          by: ["status"],
          where,
          _sum: { amount: true },
          _count: { _all: true },
        })
      : [],
    db.operationalExpense.findMany({
      select: { purpose: true },
      distinct: ["purpose"],
      orderBy: { purpose: "asc" },
      take: 100,
    }),
  ]);
  const count = groups.reduce((s, g) => s + g._count._all, 0),
    total = groups.reduce((s, g) => s + (g._sum.amount || 0), 0),
    unpaid = groups.find((g) => g.status === "UNPAID"),
    paid = groups.find((g) => g.status === "PAID");
  const paymentAccounts = accounts.filter(
      (a) => isPaymentAccount(a, "CASH") || isPaymentAccount(a, "BANK"),
    ),
    expenseAccounts = accounts.filter(isExpenseAccount);
  const tabHref = (value: string) =>
    "/finance/pengeluaran-operasional?" +
    new URLSearchParams({ from, to, ...(q ? { q } : {}), ...(value ? { status: value } : {}) });
  const metrics = [
    {
      title: "TOTAL PENGELUARAN",
      value: total,
      note: `${count} transaksi`,
      icon: "coins" as const,
    },
    {
      title: "OPERASIONAL",
      value: total,
      note: "Seluruh pengeluaran pada menu ini",
      icon: "receipt" as const,
    },
    {
      title: "BELUM DIBAYAR",
      value: unpaid?._sum.amount || 0,
      note: `${unpaid?._count._all || 0} tagihan`,
      icon: "alert" as const,
    },
    {
      title: "SUDAH DIBAYAR",
      value: paid?._sum.amount || 0,
      note: "Lunas",
      icon: "wallet" as const,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <FormDialog
          title="Catat Pengeluaran Operasional"
          subtitle="Sabun cuci, perlengkapan, listrik, sewa, dll"
          trigger="+ Catat Pengeluaran"
        >
          <OperationalExpenseForm
            today={today}
            accounts={expenseAccounts}
            paymentAccounts={paymentAccounts}
            purposes={purposes.map((p) => p.purpose)}
          />
        </FormDialog>
      </div>
      <section className="expense-summary" aria-label="Ringkasan pengeluaran operasional">
        {metrics.map((m) => (
          <article key={m.title}>
            <div className="expense-summary-top">
              <h2>{m.title}</h2>
              <UiIcon name={m.icon} size={17} />
            </div>
            <strong>{rupiah(m.value)}</strong>
            <p>{m.note}</p>
          </article>
        ))}
      </section>
      <section className="panel">
        <SearchForm action="" prefetch={false} scroll={false} className="expense-filter">
          <nav className="expense-tabs" aria-label="Status pengeluaran">
            {[
              ["", `Semua (${count})`],
              ["UNPAID", `Belum Bayar (${unpaid?._count._all || 0})`],
              ["PAID", `Lunas (${paid?._count._all || 0})`],
            ].map(([value, label]) => (
              <Link
                href={tabHref(value)}
                key={value}
                aria-current={status === value ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <input type="hidden" name="status" value={status} />
          <label className="field expense-search">
            <span className="sr-only">Cari pengeluaran</span>
            <input name="q" defaultValue={q} maxLength={200} placeholder="Cari pengeluaran…" />
          </label>
          <label className="field">
            Dari tanggal
            <LocalInput type="date" name="from" required defaultValue={from} />
          </label>
          <span className="mb-3 text-slate-400" aria-hidden="true">
            →
          </span>
          <label className="field">
            Sampai tanggal
            <LocalInput type="date" name="to" required defaultValue={to} />
          </label>
          <button className="button-secondary">Terapkan</button>
        </SearchForm>
      </section>
      {!valid && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Pilih rentang tanggal valid maksimal satu tahun.
        </p>
      )}
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <SortableTable className="expense-table">
            <thead>
              <tr>
                {["TANGGAL", "KETERANGAN", "KATEGORI", "NOMINAL", "STATUS", "AKSI"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap" data-sort-value={row.date.getTime()}>
                    {displayDate(row.date)}
                  </td>
                  <td className="max-w-[360px]">
                    <p className="expense-purpose">{row.purpose}</p>
                    {row.notes && <p className="mt-1 text-[10px] text-slate-400">{row.notes}</p>}
                  </td>
                  <td>
                    <span
                      className="expense-category"
                      title={`${row.expenseCode} · ${row.expenseName}`}
                    >
                      {row.category || row.expenseName}
                    </span>
                  </td>
                  <td className="expense-amount">{rupiah(row.amount)}</td>
                  <td>
                    <span className="expense-status" data-status={row.status}>
                      {row.status === "PAID" ? "✓ Lunas" : "Belum Bayar"}
                    </span>
                  </td>
                  <td>
                    {row.status === "PAID" ? (
                      <div className="text-[10px] text-slate-400">
                        <p>{row.paidAt ? displayDate(row.paidAt) : "—"}</p>
                        <p className="mt-1" title={row.paymentCode || ""}>
                          {row.paymentName}
                        </p>
                      </div>
                    ) : (
                      <FormDialog title="Catat Pembayaran Pengeluaran" trigger="Catat Pembayaran">
                        <OperationalExpensePaymentForm
                          today={today}
                          accounts={paymentAccounts}
                          record={{
                            id: row.id,
                            version: row.updatedAt.toISOString(),
                            date: row.date.toISOString().slice(0, 10),
                            purpose: row.purpose,
                            amountLabel: rupiah(row.amount),
                            method: row.paymentMethod as PaymentMethod,
                          }}
                        />
                      </FormDialog>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="!p-12 text-center text-slate-500">
                    Belum ada pengeluaran untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
      </section>
      {rows.length === 500 && (
        <p className="text-xs text-slate-500">
          Menampilkan maksimal 500 catatan terbaru. Persempit tanggal atau pencarian untuk melihat
          catatan lainnya.
        </p>
      )}
      <p className="text-xs leading-5 text-slate-500">
        Tagihan belum bayar disimpan di daftar ini. Jurnal beban dan kas/bank dicatat saat
        pengeluaran dilunasi.
      </p>
    </div>
  );
}
