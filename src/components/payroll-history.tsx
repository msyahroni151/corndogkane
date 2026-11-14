"use client";

import { useState, type ReactNode } from "react";
import { SortableTable } from "@/components/sortable-table";
import { payrollStatuses } from "@/lib/payroll";

type PayrollStatus = keyof typeof payrollStatuses;
const filters = ["ALL", "DRAFT", "PAID", "CANCELLED"] as const;

export function PayrollHistory({
  records,
  header,
}: {
  records: { id: string; name: string; fullName: string; status: PayrollStatus; row: ReactNode }[];
  header: ReactNode;
}) {
  const [status, setStatus] = useState<(typeof filters)[number]>("ALL");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("id-ID");
  const matches = records.filter(({ id, name, fullName }) =>
    [id, name, fullName].some((value) => value.toLocaleLowerCase("id-ID").includes(query)),
  );
  const counts = { ALL: matches.length, DRAFT: 0, PAID: 0, CANCELLED: 0 };
  for (const record of matches) counts[record.status]++;
  const visible = status === "ALL" ? matches : matches.filter((record) => record.status === status);

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 pb-2">
        <h2 className="font-semibold">Riwayat payroll · {records.length} terbaru</h2>
        <div className="field w-full sm:w-auto">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Cari nama karyawan atau ID payroll"
            placeholder="Cari nama atau ID payroll..."
          />
        </div>
      </div>
      <div
        role="group"
        aria-label="Filter status payroll"
        className="flex flex-wrap gap-x-2 border-b border-slate-200 px-5"
      >
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={status === filter}
            onClick={() => setStatus(filter)}
            className={`inline-flex items-center gap-2 border-b-2 px-2 py-3 text-xs whitespace-nowrap ${
              status === filter
                ? "border-emerald-700 font-semibold text-emerald-900"
                : "border-transparent text-slate-600 hover:text-emerald-800"
            }`}
          >
            {filter === "ALL" ? "Semua" : payrollStatuses[filter]}
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">
              {counts[filter]}
            </span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <SortableTable className="w-full min-w-[1000px] text-left text-sm">
          {header}
          <tbody>{visible.map((record) => record.row)}</tbody>
        </SortableTable>
      </div>
      {!visible.length && (
        <p role="status" className="p-6 text-sm text-slate-500">
          {records.length
            ? "Tidak ada payroll yang sesuai dengan pencarian dan filter."
            : "Belum ada payroll. Klik Buat payroll untuk menghitung periode."}
        </p>
      )}
    </section>
  );
}
