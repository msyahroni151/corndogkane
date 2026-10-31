import SearchForm from "next/form";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { todayWib, parseCivilDate, displayDate } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { FormDialog } from "@/components/form-dialog";
import { JournalForm } from "@/components/journal-forms";
import { LocalInput } from "@/components/local-input";
import { SortableTable } from "@/components/sortable-table";
import type { Prisma } from "@/generated/prisma/client";
export default async function OpenTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const user = await requireAccess("open-transaction"),
    query = await searchParams,
    db = getPrisma(),
    today = todayWib();
  const from = query.from || today.slice(0, 8) + "01",
    to = query.to || today,
    q = String(query.q || "")
      .trim()
      .slice(0, 200);
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
  const where: Prisma.JournalTransactionWhereInput = {
    date: { gte: start, lte: end },
    ...(q
      ? {
          OR: [
            { notes: { contains: q, mode: "insensitive" } },
            { sourceCode: { contains: q, mode: "insensitive" } },
            { sourceName: { contains: q, mode: "insensitive" } },
            { targetCode: { contains: q, mode: "insensitive" } },
            { targetName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [accounts, rows, count] = await Promise.all([
    db.financialAccount.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    valid
      ? db.journalTransaction.findMany({
          where,
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 500,
        })
      : [],
    valid ? db.journalTransaction.count({ where }) : 0,
  ]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        {hasPermission(user, "master-akun") && (
          <Link href="/finance/laporan-akuntansi?tab=coa" className="button-secondary">
            Master Akun
          </Link>
        )}
        <FormDialog
          title="Catat Transfer Antar Akun"
          subtitle="Pindahkan dana antar akun dengan pencatatan debit dan kredit."
          trigger="+ Catat Transfer"
        >
          <JournalForm accounts={accounts} today={today} />
        </FormDialog>
      </div>
      <SearchForm
        action=""
        prefetch={false}
        scroll={false}
        className="panel flex flex-wrap items-end gap-3 p-5"
      >
        <label className="field min-w-[220px] flex-1">
          Cari transaksi
          <input name="q" defaultValue={q} placeholder="Cari keterangan, akun…" maxLength={200} />
        </label>
        <label className="field">
          Dari
          <LocalInput name="from" type="date" defaultValue={from} required />
        </label>
        <label className="field">
          Sampai
          <LocalInput name="to" type="date" defaultValue={to} required />
        </label>
        <button className="button-secondary">Terapkan</button>
      </SearchForm>
      {!valid && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Pilih rentang tanggal yang valid, maksimal satu tahun.
        </p>
      )}
      {!accounts.length && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Master Akun masih kosong. Daftar akun akan muncul setelah Anda menambahkannya.
        </p>
      )}
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="font-semibold">Riwayat Transaksi</h2>
          <span className="text-xs text-slate-500">Total {count} transaksi</span>
        </div>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Tanggal", "Keterangan", "Akun Debit", "Akun Kredit", "Nominal"].map((h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const debit = row.sourceSide === "DEBIT";
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="p-4 whitespace-nowrap" data-sort-value={row.date.getTime()}>
                      {displayDate(row.date)}
                    </td>
                    <td className="max-w-[320px] p-4 break-words">{row.notes}</td>
                    <td className="p-4">
                      {debit ? row.sourceCode : row.targetCode} ·{" "}
                      {debit ? row.sourceName : row.targetName}
                    </td>
                    <td className="p-4">
                      {debit ? row.targetCode : row.sourceCode} ·{" "}
                      {debit ? row.targetName : row.sourceName}
                    </td>
                    <td className="p-4 font-semibold whitespace-nowrap">{rupiah(row.amount)}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="p-14 text-center text-slate-500">
                    Tidak ada transaksi ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
        {count > 500 && (
          <p className="p-4 text-xs text-slate-500">
            Menampilkan 500 transaksi terbaru. Persempit tanggal atau pencarian untuk melihat
            transaksi lainnya.
          </p>
        )}
      </section>
    </div>
  );
}
