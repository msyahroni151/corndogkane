import { getPrisma } from "@/lib/db";
import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";
import { SortableTable } from "@/components/sortable-table";
import { SyncOutletBonuses } from "@/components/sync-outlet-bonuses";
import { rupiah } from "@/lib/money";
import { displayDate } from "@/lib/placements";
export async function OutletBonusSummary({ employee }: { employee?: string }) {
  const rows = await getPrisma().outletOperation.findMany({
    where: employee ? { crewId: employee } : {},
    include: { outlet: true, crew: { select: { employeeCode: true } } },
    orderBy: [{ date: "desc" }, { outletName: "asc" }],
    take: 10000,
  });
  const missing = rows.filter((r) => r.bonusAmount == null).length;
  return (
    <section className="panel mt-6 overflow-hidden">
      <div className="space-y-3 border-b border-slate-100 p-5">
        <h2 className="text-sm font-bold">Rincian Bonus Operasional</h2>
        <p className="text-xs leading-6 text-slate-500">
          Omzet harian mulai Rp600.000: bonus Rp5.000, bertambah Rp5.000 setiap kelipatan Rp100.000.
          Omzet ≥ Rp2.000.000: gaji harian + bonus = Rp200.000. Bonus terikat pada crew yang
          tercatat dan langsung masuk saldo bonus yang dapat dicairkan atau dibayar melalui payroll.
          Crew training tidak mendapat bonus terpisah.
        </p>
        {missing > 0 && (
          <>
            <p className="text-xs text-amber-700">
              {missing} rekap lama belum disinkronkan. Hitungan sementara menggunakan tarif outlet
              saat ini; sinkronisasi menyimpan tarif tersebut. Maksimal 100 rekap diproses per klik,
              mencakup seluruh crew. Bonus manual pada tanggal sama dan payroll yang sudah dibayar
              diperiksa agar tidak ganda.
            </p>
            <SyncOutletBonuses />
          </>
        )}
      </div>
      <div className="overflow-x-auto">
        <SortableTable className="w-full text-left text-xs">
          <thead>
            <tr>
              {["Tanggal", "Outlet", "Crew", "Omzet", "Tarif harian", "Bonus", "Pencatatan"].map(
                (t) => (
                  <th key={t} className="p-4">
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate =
                  r.bonusDailyRate ??
                  outletBonusRate(
                    r.outlet.name,
                    r.date.toISOString().slice(0, 10),
                    r.outlet.dailyRate,
                    r.totalGross,
                  ),
                bonus = r.bonusAmount ?? outletBonus(r.totalGross, rate);
              return (
                <tr key={r.id}>
                  <td className="p-4">{displayDate(r.date)}</td>
                  <td className="p-4">{r.outletName}</td>
                  <td className="p-4">{r.crew.employeeCode || r.crewName}</td>
                  <td className="p-4">{rupiah(r.totalGross)}</td>
                  <td className="p-4">{rate == null ? "—" : rupiah(rate)}</td>
                  <td className="p-4 font-semibold">
                    {bonus == null ? "Tarif belum diatur" : rupiah(bonus)}
                  </td>
                  <td className="p-4">
                    {r.bonusAmount == null
                      ? "Belum disinkronkan"
                      : bonus
                        ? "Lihat status di riwayat bonus"
                        : "Belum memenuhi bonus"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </SortableTable>
        {!rows.length && <p className="p-6 text-sm text-slate-500">Belum ada rekap operasional.</p>}
      </div>
    </section>
  );
}
