"use client";

import { useState } from "react";
import { SortableTable } from "@/components/sortable-table";
import { UiIcon } from "@/components/ui-icon";
import { rupiah } from "@/lib/money";

type BalanceRow = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  loan: number;
  bonus: number;
  fine: number;
  settlement: number;
  settlementPending: number;
};

export function BalanceSummary({
  rows,
  initialSearch,
}: {
  rows: BalanceRow[];
  initialSearch: string;
}) {
  const [input, setInput] = useState(initialSearch);
  const search = input.trim().toLocaleLowerCase("id-ID");
  const balances = rows.filter((row) =>
    row.fullName.toLocaleLowerCase("id-ID").includes(search) ||
    row.employeeCode?.toLocaleLowerCase("id-ID").includes(search),
  );
  const totals = balances.reduce(
    (sum, row) => ({
      loan: sum.loan + row.loan,
      bonus: sum.bonus + row.bonus,
      fine: sum.fine + row.fine,
      settlement: sum.settlement + row.settlement,
      settlementPending: sum.settlementPending + row.settlementPending,
    }),
    { loan: 0, bonus: 0, fine: 0, settlement: 0, settlementPending: 0 },
  );
  const cards = [
    { label: "Total Kasbon", amount: totals.loan, note: "Sisa kasbon", icon: "wallet" },
    { label: "Total Bonus", amount: totals.bonus, note: "Sisa bonus disetujui", icon: "gift" },
    { label: "Total Denda", amount: totals.fine, note: "Denda belum dipotong", icon: "alert" },
    {
      label: "Total Selisih Setor",
      amount: totals.settlement + totals.settlementPending,
      note: `Disetujui: ${rupiah(totals.settlement)} · Menunggu: ${rupiah(totals.settlementPending)}`,
      icon: "receipt",
    },
  ] as const;
  return (
    <div className="space-y-6">
      <section aria-label="Ringkasan saldo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs text-slate-600">{card.label}</h2>
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <UiIcon name={card.icon} size={17} />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold">{rupiah(card.amount)}</p>
            <p className="mt-2 text-xs text-slate-500">
              {card.note} · {search ? "hasil pencarian" : "karyawan aktif"}
            </p>
          </article>
        ))}
      </section>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <h2 className="font-semibold">Saldo untuk periode berikutnya</h2>
          <div className="field">
            <input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={150}
              aria-label="Cari nama atau kode karyawan"
              placeholder="Cari nama atau kode..."
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <SortableTable className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Karyawan",
                  "Sisa kasbon",
                  "Sisa bonus disetujui",
                  "Denda belum dipotong",
                  "Sisa selisih setoran",
                ].map((h) => (
                  <th className="p-4" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-4 font-medium">{row.employeeCode || row.fullName}</td>
                  <td className="p-4">{rupiah(row.loan)}</td>
                  <td className="p-4">{rupiah(row.bonus)}</td>
                  <td className="p-4">{rupiah(row.fine)}</td>
                  <td className="p-4" data-sort-value={row.settlement + row.settlementPending}>
                    {rupiah(row.settlement)}
                    {row.settlementPending > 0 && (
                      <p className="mt-1 text-xs text-amber-800">
                        {rupiah(row.settlementPending)} menunggu persetujuan
                      </p>
                    )}
                  </td>
                </tr>
              ))}
              {!balances.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    {search
                      ? "Tidak ada karyawan yang cocok dengan pencarian."
                      : "Belum ada data karyawan untuk rekap saldo."}
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
      </section>
    </div>
  );
}
