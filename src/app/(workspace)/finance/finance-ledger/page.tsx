import SearchForm from "next/form";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate, displayDate } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { LocalInput } from "@/components/local-input";
import { SortableTable } from "@/components/sortable-table";
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; account?: string }>;
}) {
  await requireAccess("finance-ledger");
  const query = await searchParams,
    today = todayWib(),
    from = query.from || today.slice(0, 8) + "01",
    to = query.to || today;
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
    [accounts, transactions] = await Promise.all([
      db.financialAccount.findMany({ orderBy: { code: "asc" } }),
      valid
        ? db.journalTransaction.findMany({
            where: {
              date: { gte: start, lte: end },
              ...(query.account
                ? { OR: [{ sourceAccountId: query.account }, { targetAccountId: query.account }] }
                : {}),
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
            take: 1000,
          })
        : [],
    ]);
  const rows = transactions
    .flatMap((t) => [
      {
        id: t.id + "S",
        accountId: t.sourceAccountId,
        code: t.sourceCode,
        name: t.sourceName,
        date: t.date,
        notes: t.notes,
        debit: t.sourceSide === "DEBIT" ? t.amount : 0,
        credit: t.sourceSide === "CREDIT" ? t.amount : 0,
      },
      {
        id: t.id + "T",
        accountId: t.targetAccountId,
        code: t.targetCode,
        name: t.targetName,
        date: t.date,
        notes: t.notes,
        debit: t.sourceSide === "CREDIT" ? t.amount : 0,
        credit: t.sourceSide === "DEBIT" ? t.amount : 0,
      },
    ])
    .filter((r) => !query.account || r.accountId === query.account);
  return (
    <div className="space-y-5">
      <SearchForm
        action=""
        prefetch={false}
        scroll={false}
        className="panel flex flex-wrap items-end gap-3 p-5"
      >
        <label className="field">
          Tanggal Mulai
          <LocalInput type="date" name="from" defaultValue={from} required />
        </label>
        <label className="field">
          Tanggal Selesai
          <LocalInput type="date" name="to" defaultValue={to} required />
        </label>
        <label className="field flex-1">
          Akun
          <select name="account" defaultValue={query.account || ""}>
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button-secondary">Terapkan</button>
      </SearchForm>
      {!valid && (
        <p role="alert" className="text-sm text-red-700">
          Pilih rentang tanggal valid maksimal satu tahun.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["Mutasi Debit", rows.reduce((s, r) => s + r.debit, 0)],
          ["Mutasi Kredit", rows.reduce((s, r) => s + r.credit, 0)],
        ].map(([label, value]) => (
          <div className="panel p-5" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold">{rupiah(Number(value))}</p>
          </div>
        ))}
      </div>
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr>
                {["Tanggal", "Kode", "Nama Akun", "Keterangan", "Debit", "Kredit"].map((h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-4" data-sort-value={r.date.getTime()}>
                    {displayDate(r.date)}
                  </td>
                  <td className="p-4">{r.code}</td>
                  <td className="p-4">{r.name}</td>
                  <td className="p-4">{r.notes}</td>
                  <td className="p-4">{r.debit ? rupiah(r.debit) : "—"}</td>
                  <td className="p-4">{r.credit ? rupiah(r.credit) : "—"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    Belum ada mutasi jurnal untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
      </section>
      <p className="text-xs text-slate-500">
        Sumber: Jurnal Umum aplikasi. Mutasi periode belum termasuk saldo awal atau transaksi sumber
        lain yang belum dijurnal.
        {transactions.length === 1000
          ? " Menampilkan maksimal 1.000 transaksi; persempit filter untuk data lainnya."
          : ""}
      </p>
    </div>
  );
}
