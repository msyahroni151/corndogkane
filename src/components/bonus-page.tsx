import { bonusStartDate } from "@/lib/bonus-period";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { bonusBalances } from "@/lib/bonus-balance";
import { todayWib } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { MoneyPage } from "@/components/money-page";
import { FormDialog } from "@/components/form-dialog";
import { BonusWithdrawalForm } from "@/components/bonus-withdrawal-form";
import { SyncOutletBonuses } from "@/components/sync-outlet-bonuses";
export type BonusQuery = { employee?: string; status?: string; tersimpan?: string };
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
      where: {
        kind: { in: ["BONUS_EARNED", "BONUS_WITHDRAWAL"] },
        date: { gte: bonusStartDate() },
      },
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
      where: {
        bonusAmount: null,
        hasManual: true,
        salesPending: false,
        date: { gte: bonusStartDate() },
      },
    }),
  ]);
  const balances = bonusBalances(employees, entries, today);
  const eligible = balances
    .filter((employee) => employee.left > 0)
    .map(({ id, fullName, employeeCode, active, left }) => ({
      id, fullName, employeeCode, active, left,
    }));
  const totals = balances.reduce(
    (s, e) => ({ earned: s.earned + e.earned, taken: s.taken + e.taken, left: s.left + e.left }),
    { earned: 0, taken: 0, left: 0 },
  );
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Ringkasan Bonus</h2>
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
              Mulai 1 November 2026 · sampai hari ini
            </p>
          </section>
        ))}
      </div>
      {unsynced > 0 && (
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-2xl text-xs leading-5 text-amber-700">
            {unsynced} rekap lama belum masuk saldo bonus. Sinkronkan agar bonus yang memenuhi
            syarat masuk ke saldo crew.
          </p>
          <SyncOutletBonuses />
        </div>
      )}
      <div id="riwayat-bonus" className="scroll-mt-48">
        <MoneyPage
          mode="bonus"
          searchParams={Promise.resolve(query)}
          historyOnly
          withdrawalAction={
            eligible.length > 0 && (
              <FormDialog title="Pencairan Dana Bonus" trigger="Pencairan Dana">
                <BonusWithdrawalForm employees={eligible} today={today} />
              </FormDialog>
            )
          }
        />
      </div>
    </div>
  );
}
