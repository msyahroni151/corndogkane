import { OutletBonusSummary } from "@/components/outlet-bonus-summary";
import { SortableTable } from "@/components/sortable-table";
import { APP_TIME_ZONE } from "@/lib/local-date";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { displayDate, todayWib } from "@/lib/placements";
import { moneyLabels, moneyStatuses, rupiah } from "@/lib/money";
import { FormDialog } from "@/components/form-dialog";
import { MoneyForm } from "@/components/money-form";
import type { MoneyKind } from "@/generated/prisma/client";
export async function MoneyPage({
  mode,
  searchParams,
  historyOnly = false,
}: {
  mode: "kasbon" | "bonus";
  searchParams: Promise<{ employee?: string; status?: string; tersimpan?: string; view?: string }>;
  historyOnly?: boolean;
}) {
  await requireAccess(mode);
  const query = await searchParams,
    db = getPrisma();
  const kinds: MoneyKind[] =
    mode === "kasbon" ? ["LOAN", "REPAYMENT"] : ["BONUS_EARNED", "BONUS_WITHDRAWAL"];
  const [employees, entries] = await Promise.all([
    db.employee.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, employeeCode: true, active: true },
    }),
    db.moneyEntry.findMany({
      where: { kind: { in: kinds } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
    }),
  ]);
  const approved = entries.filter((e) => e.status === "APPROVED"),
    credit = approved
      .filter((e) => e.kind === "LOAN" || e.kind === "BONUS_EARNED")
      .reduce((sum, e) => sum + e.amount, 0),
    debit = approved
      .filter((e) => e.kind === "REPAYMENT" || e.kind === "BONUS_WITHDRAWAL")
      .reduce((sum, e) => sum + e.amount, 0);
  const balances = new Map<string, { name: string; credit: number; debit: number }>();
  for (const e of approved) {
    const b = balances.get(e.employeeId) || { name: e.employeeName, credit: 0, debit: 0 };
    if (e.kind === "LOAN" || e.kind === "BONUS_EARNED") b.credit += e.amount;
    else b.debit += e.amount;
    balances.set(e.employeeId, b);
  }
  const loanLeft = (id: string, amount: number) =>
    amount - approved.filter((e) => e.sourceId === id).reduce((sum, e) => sum + e.amount, 0);
  const rows = entries.filter(
    (e) =>
      (!query.employee || e.employeeId === query.employee) &&
      (!query.status || e.status === query.status),
  );
  const historyGroups =
    mode === "bonus"
      ? [
          {
            title: "Riwayat Pendapatan Bonus",
            rows: rows.filter((e) => e.kind === "BONUS_EARNED"),
          },
          {
            title: "Riwayat Pengambilan Bonus",
            rows: rows.filter((e) => e.kind === "BONUS_WITHDRAWAL"),
          },
        ]
      : [{ title: "Riwayat", rows }];
  const today = todayWib(),
    title = mode === "kasbon" ? "Kasbon" : "Bonus";
  const choices = employees.map((e) => ({
    id: e.id,
    name: (e.employeeCode || e.fullName) + (e.active ? "" : " · tidak aktif"),
  }));
  const loans = approved
    .filter((e) => e.kind === "LOAN" && loanLeft(e.id, e.amount) > 0)
    .map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      label: `${e.id} · sisa ${rupiah(loanLeft(e.id, e.amount))}`,
    }));
  return (
    <>
      {mode === "kasbon" && (
        <div className="flex flex-wrap items-center justify-end gap-4">
          <FormDialog title={`Tambah catatan ${title.toLowerCase()}`} trigger="+ Tambah catatan">
            <MoneyForm mode={mode} employees={choices} loans={loans} today={today} />
          </FormDialog>
        </div>
      )}
      {query.tersimpan && !historyOnly && (
        <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          Catatan berhasil disimpan.
        </p>
      )}
      {!historyOnly && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: mode === "kasbon" ? "Kasbon disetujui" : "Bonus diperoleh", amount: credit },
              { label: mode === "kasbon" ? "Sudah dibayar" : "Sudah diambil", amount: debit },
              { label: mode === "kasbon" ? "Sisa kasbon" : "Sisa bonus", amount: credit - debit },
            ].map((card) => (
              <section key={card.label} className="panel p-5">
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="mt-3 text-xl font-bold">{rupiah(card.amount)}</p>
                <p className="mt-2 text-[10px] text-slate-400">Seluruh catatan yang disetujui</p>
              </section>
            ))}
          </div>
          {balances.size > 0 && (
            <section className="panel mt-6 overflow-hidden">
              <h2 className="border-b border-slate-100 p-5 text-sm font-bold">
                Saldo per karyawan
              </h2>
              <div className="overflow-x-auto">
                <SortableTable className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      {[
                        "Karyawan",
                        mode === "kasbon" ? "Total kasbon" : "Bonus diperoleh",
                        mode === "kasbon" ? "Pembayaran" : "Pengambilan",
                        "Saldo",
                      ].map((t) => (
                        <th key={t} className="p-4">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...balances]
                      .filter(([id]) => !query.employee || id === query.employee)
                      .map(([id, b]) => (
                        <tr key={id}>
                          <td className="p-4 font-semibold">
                            {b.name}
                            <p className="mt-1 text-[10px] font-normal text-slate-400">{id}</p>
                          </td>
                          <td className="p-4">{rupiah(b.credit)}</td>
                          <td className="p-4">{rupiah(b.debit)}</td>
                          <td className="p-4 font-semibold">{rupiah(b.credit - b.debit)}</td>
                        </tr>
                      ))}
                  </tbody>
                </SortableTable>
              </div>
            </section>
          )}
        </>
      )}
      {historyGroups.map((group, index) => (
        <section key={group.title} className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold">
              {group.title} · {group.rows.length} catatan
            </h2>
            {index === 0 && (
              <form className="flex flex-wrap gap-3">
                {historyOnly && <input type="hidden" name="view" value="history" />}
                <select
                  name="employee"
                  defaultValue={query.employee || ""}
                  aria-label="Filter karyawan"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">Semua karyawan</option>
                  {choices.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <select
                  name="status"
                  defaultValue={query.status || ""}
                  aria-label="Filter status"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">Semua status</option>
                  {Object.entries(moneyStatuses).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <button className="button-secondary">Tampilkan</button>
              </form>
            )}
          </div>
          {group.rows.length ? (
            <div className="overflow-x-auto">
              <SortableTable aria-label={group.title} className="w-full text-left text-xs">
                <thead>
                  <tr>
                    {[
                      ...(mode === "kasbon" ? ["ID"] : []),
                      "Tanggal",
                      "Karyawan",
                      "Jenis",
                      "Nominal",
                      mode === "kasbon" ? "ID kasbon / sisa" : "Keterangan",
                      "Status",
                      "Dicatat / diproses oleh",
                      "Aksi",
                    ].map((t) => (
                      <th key={t} className="px-4 py-4">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((e) => (
                    <tr key={e.id}>
                      {mode === "kasbon" && <td className="whitespace-nowrap px-4 py-4">{e.id}</td>}
                      <td className="whitespace-nowrap px-4 py-4">{displayDate(e.date)}</td>
                      <td className="px-4 py-4">{e.employeeName}</td>
                      <td
                        className="whitespace-nowrap px-4 py-4"
                        data-sort-value={moneyLabels[e.kind]}
                      >
                        {moneyLabels[e.kind]}
                        <p className="mt-1 max-w-xs whitespace-pre-wrap text-[10px] text-slate-400">
                          {mode === "kasbon" ? e.notes : ""}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold">
                        {rupiah(e.amount)}
                      </td>
                      <td className="px-4 py-4">
                        {mode === "kasbon"
                          ? e.kind === "LOAN" && e.status === "APPROVED"
                            ? rupiah(loanLeft(e.id, e.amount))
                            : e.sourceId || "—"
                          : e.notes}
                      </td>
                      <td className="px-4 py-4" data-sort-value={moneyStatuses[e.status]}>
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${e.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : e.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {moneyStatuses[e.status]}
                        </span>
                        {e.decisionNotes && (
                          <p className="mt-2 text-[10px] text-slate-400">{e.decisionNotes}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-[10px] text-slate-500">
                        {e.createdBy.name}
                        {e.decidedBy && (
                          <p className="mt-1">
                            {e.decidedBy.name} ·{" "}
                            {e.decidedAt &&
                              new Intl.DateTimeFormat("id-ID", {
                                dateStyle: "medium",
                                timeZone: APP_TIME_ZONE,
                              }).format(e.decidedAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {e.status === "PENDING" ? (
                          <FormDialog title={`Persetujuan · ${e.id}`} trigger="Proses">
                            <MoneyForm
                              mode={mode}
                              today={today}
                              decisionId={e.id}
                              decisionAmount={e.amount}
                              decisionEmployeeId={e.employeeId}
                              decisionEmployeeName={e.employeeName}
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
            </div>
          ) : (
            <p className="p-10 text-center text-sm text-slate-500">
              Belum ada catatan pada filter ini.
            </p>
          )}
          {mode === "bonus" && index === 0 && (
            <details className="border-t border-slate-100 p-5">
              <summary className="cursor-pointer text-sm font-semibold text-emerald-700">
                Rincian Bonus Operasional
              </summary>
              <OutletBonusSummary employee={query.employee} />
            </details>
          )}
        </section>
      ))}
      <p className="mt-5 text-xs leading-6 text-slate-500">
        Hanya catatan disetujui yang memengaruhi saldo. Riwayat yang sudah diproses tidak dapat
        ditimpa.{" "}
        {mode === "kasbon"
          ? "Pembayaran dicatat per ID kasbon; persetujuan tidak memotong payroll secara otomatis."
          : "Bonus otomatis dari rekap langsung menjadi saldo. Pencairan dana dan pembayaran bonus melalui payroll mengurangi saldo satu kali. Catatan penyesuaian manual tetap memerlukan persetujuan."}{" "}
        Pembayaran melalui Payroll otomatis masuk ke riwayat setelah payroll dicatat dibayar. Slip
        cetak akan dikembangkan pada tahap berikutnya.
      </p>
    </>
  );
}
