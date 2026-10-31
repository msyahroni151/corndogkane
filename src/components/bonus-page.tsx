import SearchForm from "next/form";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { bonusBalances } from "@/lib/bonus-balance";
import { todayWib } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { BonusView } from "@/components/bonus-view";
import { MoneyPage } from "@/components/money-page";
import { FormDialog } from "@/components/form-dialog";
import { BonusWithdrawalForm } from "@/components/bonus-withdrawal-form";
import { SortableTable } from "@/components/sortable-table";
import { SyncOutletBonuses } from "@/components/sync-outlet-bonuses";
export type BonusQuery = { employee?: string; status?: string; tersimpan?: string; view?: string };
export async function BonusPage({ searchParams }: { searchParams: Promise<BonusQuery> }) {
  await requireAccess("bonus");
  const query = await searchParams,
    db = getPrisma(),
    today = todayWib();
  const [employees, entries, unsynced] = await Promise.all([
    db.employee.findMany({
      select: { id: true, fullName: true, employeeCode: true, active: true },
      orderBy: { fullName: "asc" },
    }),
    db.moneyEntry.findMany({
      where: { kind: { in: ["BONUS_EARNED", "BONUS_WITHDRAWAL"] } },
      select: {
        employeeId: true,
        employeeName: true,
        kind: true,
        status: true,
        amount: true,
        date: true,
      },
    }),
    db.outletOperation.count({
      where: { bonusAmount: null, hasManual: true, salesPending: false },
    }),
  ]);
  const balances = bonusBalances(employees, entries, today).filter(
    (e) => !query.employee || e.id === query.employee,
  );
  const totals = balances.reduce(
    (s, e) => ({ earned: s.earned + e.earned, taken: s.taken + e.taken, left: s.left + e.left }),
    { earned: 0, taken: 0, left: 0 },
  );
  const balance = (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Bonus Diperoleh", value: totals.earned },
          { label: "Sudah Diambil", value: totals.taken },
          { label: "Sisa Bonus", value: totals.left },
        ].map((c) => (
          <section className="panel p-5" key={c.label}>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-3 text-xl font-bold">{rupiah(c.value)}</p>
            <p className="mt-2 text-[10px] text-slate-400">
              Sesuai filter karyawan · sampai hari ini
            </p>
          </section>
        ))}
      </div>
      {unsynced > 0 && (
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-2xl text-xs leading-5 text-amber-700">
            {unsynced} rekap lama belum masuk saldo bonus. Sinkronkan agar bonus yang memenuhi
            syarat masuk ke saldo crew. Rinciannya tersedia di Riwayat.
          </p>
          <SyncOutletBonuses />
        </div>
      )}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
          <h3 className="text-sm font-bold">Saldo Bonus per Karyawan</h3>
          <SearchForm
            action=""
            prefetch={false}
            scroll={false}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="view" value="saldo" />
            <label className="field">
              Karyawan
              <select name="employee" defaultValue={query.employee || ""}>
                <option value="">Semua karyawan</option>
                {employees.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.employeeCode || e.fullName}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-secondary">Terapkan</button>
          </SearchForm>
        </div>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[650px] text-left text-sm">
            <thead>
              <tr>
                {["Nama Karyawan", "Bonus Diperoleh", "Sudah Diambil", "Sisa Bonus", "Aksi"].map(
                  (t) => (
                    <th key={t} className="p-4">
                      {t}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {balances.map((e) => (
                <tr key={e.id}>
                  <td className="p-4 font-semibold">
                    {e.fullName}
                    {e.employeeCode && e.employeeCode !== e.fullName ? ` - ${e.employeeCode}` : ""}
                    {!e.active && (
                      <p className="mt-1 text-xs font-normal text-slate-400">Tidak aktif</p>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap">{rupiah(e.earned)}</td>
                  <td className="p-4 whitespace-nowrap">{rupiah(e.taken)}</td>
                  <td className="p-4 whitespace-nowrap font-semibold">{rupiah(e.left)}</td>
                  <td className="p-4">
                    {e.left > 0 ? (
                      <FormDialog title="Pencairan Dana Bonus" trigger="Pencairan Dana">
                        <BonusWithdrawalForm
                          employeeId={e.id}
                          name={e.fullName + (e.employeeCode ? ` - ${e.employeeCode}` : "")}
                          balance={e.left}
                          today={today}
                        />
                      </FormDialog>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
          {!balances.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              Belum ada catatan saldo bonus untuk karyawan pada filter ini.
            </p>
          )}
        </div>
      </section>
      <p className="text-xs leading-6 text-slate-500">
        Bonus otomatis dari rekap langsung menambah saldo crew. Pencairan dana dan bonus yang
        dibayar melalui payroll masuk ke Sudah Diambil. Rekap lama perlu disinkronkan; penyesuaian
        manual yang belum disetujui belum memengaruhi saldo.
      </p>
    </div>
  );
  const initialView = query.view === "history" ? "history" : "saldo";
  return (
    <BonusView
      key={initialView}
      initialView={initialView}
      balance={balance}
      history={<MoneyPage mode="bonus" searchParams={Promise.resolve(query)} historyOnly />}
    />
  );
}
