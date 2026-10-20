import { OutletCashFlow } from "@/components/outlet-cash-flow";
import { UiIcon, type IconName } from "@/components/ui-icon";
import { DetailedOutletStatements } from "@/components/detailed-outlet-statements";
import { RefreshFinancialReport } from "@/components/refresh-financial-report";
import { OutletPeriodComparison } from "@/components/outlet-period-comparison";
import { dateToDisplay } from "@/lib/local-date";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAccess } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { CoaTable } from "@/components/coa-table";
import { coaSourceUrl } from "@/lib/coa";
import { rupiah } from "@/lib/money";
import { todayWib, parseCivilDate } from "@/lib/placements";
import { LocalInput } from "@/components/local-input";
import { SortableTable } from "@/components/sortable-table";
import { OutletReportExport } from "@/components/outlet-report-export";
import { summarizeOutletReport, type OutletReportEntry } from "@/lib/outlet-financial-report";
import { operationalCash } from "@/lib/outlet-operations";
import "@/components/outlet-financial-report.css";
const tabs = [
  ["summary", "Ringkasan Finance"],
  ["statements", "Laba Rugi & Neraca"],
  ["cash", "Arus Kas"],
  ["journal", "Buku & Jurnal"],
  ["coa", "Daftar Akun (COA)"],
  ["variable", "Variable Account"],
  ["insights", "Analisa & Insights"],
];
function Line({
  label,
  value = null,
  total = false,
}: {
  label: string;
  value?: number | null;
  total?: boolean;
}) {
  return (
    <div className="report-line" data-total={total}>
      <span>{label}</span>
      <strong>{value === null ? "—" : rupiah(value)}</strong>
    </div>
  );
}
function Statement({
  title,
  blue,
  children,
}: {
  title: string;
  blue?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={"report-statement" + (blue ? " blue" : "")} aria-label={title}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAccess("master-akun"),
    query = await searchParams,
    db = getPrisma();
  const param = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const tab = tabs.some(([key]) => key === param("tab")) ? param("tab") : "summary";
  const today = todayWib(),
    from = param("from") || today.slice(0, 8) + "01",
    to = param("to") || today;
  let error = "",
    start = new Date(0),
    end = new Date(0);
  try {
    start = parseCivilDate(from);
    end = parseCivilDate(to);
    if (end < start || end.getTime() - start.getTime() > 365 * 86400000) throw Error();
  } catch {
    error = "Pilih rentang tanggal yang valid, maksimal 366 hari.";
  }
  const outlets = await db.outlet.findMany({
    where: { OR: [{ active: true }, { operations: { some: {} } }] },
    select: { id: true, name: true, active: true, closed: true, area: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const outletId =
      param("outlet") || outlets.find((o) => o.active && !o.closed)?.id || outlets[0]?.id || "",
    outlet = outlets.find((o) => o.id === outletId);
  if (outletId && !outlet) error = "Outlet tidak ditemukan. Pilih outlet yang terdaftar.";
  const href = (changes: Record<string, string>) =>
    "/finance/laporan-akuntansi?" +
    new URLSearchParams({
      tab,
      outlet: outletId,
      from,
      to,
      ...(param("prevFrom") ? { prevFrom: param("prevFrom") } : {}),
      ...(param("prevTo") ? { prevTo: param("prevTo") } : {}),
      ...changes,
    }).toString();
  const accounts = await db.financialAccount.findMany({ orderBy: { code: "asc" } });
  const records =
    tab !== "coa" && !error && outlet
      ? await db.outletOperation.findMany({
          where: { outletId: outlet.id, date: { gte: start, lte: end } },
          select: {
            date: true,
            totalGross: true,
            qris: true,
            gofood: true,
            grabfood: true,
            shopeefood: true,
            expenseAmount: true,
            bonusAmount: true,
            cashReceived: true,
            crewName: true,
            trainingCrewName: true,
            expenseNotes: true,
            crew: { select: { employeeCode: true } },
          },
          orderBy: { date: "asc" },
        })
      : [];
  const entries: OutletReportEntry[] = records.map(({ crew, ...r }) => ({
    ...r,
    date: r.date.toISOString().slice(0, 10),
    crewName: crew.employeeCode || r.crewName,
  }));
  const s = summarizeOutletReport(entries),
    known = s.records > 0;
  const amount = (n: number | null) => (known && n !== null ? rupiah(n) : "—");
  const day = new Date(today + "T00:00:00Z"),
    week = new Date(day);
  week.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const previousEndDefault = new Date(start.getTime() - 86400000),
    previousStartDefault = new Date(
      previousEndDefault.getTime() - Math.max(0, end.getTime() - start.getTime()),
    );
  const previousFrom = param("prevFrom") || previousStartDefault.toISOString().slice(0, 10),
    previousTo = param("prevTo") || previousEndDefault.toISOString().slice(0, 10);
  let previousError = "",
    previousStart = new Date(0),
    previousEnd = new Date(0);
  if (tab === "insights") {
    try {
      previousStart = parseCivilDate(previousFrom);
      previousEnd = parseCivilDate(previousTo);
      if (
        previousEnd < previousStart ||
        previousEnd.getTime() - previousStart.getTime() > 365 * 86400000
      )
        throw Error();
    } catch {
      previousError = "Pilih periode pembanding yang valid, maksimal 366 hari.";
    }
  }
  const previousRecords =
    tab === "insights" && !previousError && !error && outlet
      ? await db.outletOperation.findMany({
          where: { outletId: outlet.id, date: { gte: previousStart, lte: previousEnd } },
          select: {
            date: true,
            totalGross: true,
            qris: true,
            gofood: true,
            grabfood: true,
            shopeefood: true,
            expenseAmount: true,
            bonusAmount: true,
            cashReceived: true,
            crewName: true,
            trainingCrewName: true,
            expenseNotes: true,
          },
        })
      : [];
  const previous = summarizeOutletReport(
    previousRecords.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })),
  );
  const presets = [
    ["Hari Ini", today],
    ["Minggu Ini", week.toISOString().slice(0, 10)],
    ["Bulan Ini", today.slice(0, 8) + "01"],
    ["Tahun Ini", today.slice(0, 4) + "-01-01"],
  ];
  const cards = [
    ["Pendapatan / Revenue", amount(s.gross), "Omzet dari rekap operasional", "green"],
    ["Laba Kotor", "—", "HPP belum terhubung", "blue"],
    ["Laba Bersih", "—", "Gaji dan biaya belum lengkap", "green"],
    ["Total Aset", "—", "Saldo neraca belum tersedia", "violet"],
    [
      "Status Laporan",
      known ? "Sementara" : "Belum ada rekap",
      known ? `${s.records} rekap · ${s.receipts} setoran terisi` : "Periksa outlet dan periode",
      "amber",
    ],
  ];
  return (
    <div className="outlet-finance">
      <div className="report-top-actions">
        <p>Pusat laporan keuangan per outlet · berdasarkan Master COA</p>
        <RefreshFinancialReport />
      </div>
      <nav aria-label="Laporan dan Akuntansi" className="report-tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} href={href({ tab: key })} aria-current={tab === key ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "coa" ? (
        <>
          <p className="text-xs text-slate-500">
            Daftar akun bersama untuk seluruh outlet. Pilihan outlet tidak mengubah master COA.
          </p>
          <CoaTable
            accounts={accounts.map((a) => ({
              ...a,
              version: a.updatedAt.toISOString(),
              createdAt: undefined,
              updatedAt: undefined,
            }))}
          />
          <p className="text-xs text-slate-500">
            Sumber COA:{" "}
            <a className="underline" href={coaSourceUrl} target="_blank" rel="noreferrer">
              MASTER_COA · Backup Data Central
            </a>
            . Saldo awal dan transaksi historis belum diimpor.
          </p>
        </>
      ) : (
        <>
          <div className="report-scope">
            <strong>Laporan per outlet</strong>
            <small>Laporan perusahaan akan disiapkan pada tahap berikutnya.</small>
          </div>
          <form
            className="report-filters"
            action="/finance/laporan-akuntansi"
            key={`${tab}:${outletId}:${from}:${to}`}
          >
            <input type="hidden" name="tab" value={tab} />
            <label>
              Outlet
              <select name="outlet" defaultValue={outletId} required>
                {!outlets.length && <option value="">Belum ada outlet</option>}
                {outletId && !outlet && <option value={outletId}>Outlet tidak ditemukan</option>}
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {!o.active || o.closed ? " · Arsip / tutup" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dari tanggal
              <LocalInput
                aria-label="Dari tanggal"
                type="date"
                name="from"
                defaultValue={from}
                required
              />
            </label>
            <label>
              Sampai tanggal
              <LocalInput
                aria-label="Sampai tanggal"
                type="date"
                name="to"
                defaultValue={to}
                required
              />
            </label>
            <button className="button-primary" type="submit" disabled={!outlets.length}>
              Terapkan
            </button>
            {!error && outlet && (
              <OutletReportExport
                outlet={outlet.name}
                from={from}
                to={to}
                entries={entries}
                accounts={accounts}
              />
            )}
          </form>
          <div className="report-presets" aria-label="Periode cepat">
            {presets.map(([label, date]) => (
              <Link
                key={label}
                href={href({ from: date, to: today })}
                aria-current={from === date && to === today ? "date" : undefined}
              >
                {label}
              </Link>
            ))}
          </div>
          {error ? (
            <p role="alert" className="report-notice">
              {error}
            </p>
          ) : !outlet ? (
            <p className="panel p-6">Tambahkan outlet terlebih dahulu untuk melihat laporan.</p>
          ) : (
            <>
              <div className="report-heading">
                <div>
                  <h2>Laporan Keuangan · {outlet.name}</h2>
                  <p>
                    {outlet.area.name} · {dateToDisplay(from)} – {dateToDisplay(to)} · WIB
                  </p>
                </div>
              </div>
              <p className="report-notice">
                Laporan sementara dari rekap operasional outlet. HPP, gaji, penyusutan, biaya pusat,
                dan saldo awal belum terhubung. Laba dan neraca ditampilkan “—” sampai datanya
                lengkap. Pengeluaran pada menu Finance belum memiliki penanda outlet sehingga belum
                dimasukkan.
              </p>
              {!known && (
                <p role="status" className="panel p-5 text-sm text-slate-500">
                  Belum ada rekap untuk outlet dan periode ini. Angka yang belum tersedia
                  ditampilkan “—”.
                </p>
              )}
              <div className="report-cards" aria-label="Ringkasan keuangan outlet">
                {cards.map(([label, value, note, tone]) => (
                  <section className="report-card" data-tone={tone} key={label} aria-label={label}>
                    <h3>
                      {label}
                      <span className="report-card-icon">
                        <UiIcon
                          name={
                            (["arrow", "dashboard", "coins", "wallet", "check"] as IconName[])[
                              cards.findIndex((c) => c[0] === label)
                            ]
                          }
                          size={17}
                        />
                      </span>
                    </h3>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </section>
                ))}
              </div>
              {(tab === "summary" || tab === "statements") && (
                <>
                  <DetailedOutletStatements
                    accounts={accounts}
                    summary={s}
                    stacked={tab === "statements"}
                  />
                  {tab === "summary" && known && (
                    <Statement title="TREN OMZET OUTLET">
                      <div className="p-4">
                        <div className="report-trend" role="list" aria-label="Omzet harian">
                          {entries.map((e) => (
                            <Link
                              role="listitem"
                              key={e.date}
                              href={href({ from: e.date, to: e.date })}
                              aria-label={`${dateToDisplay(e.date)}: ${rupiah(e.totalGross)}`}
                              title={`${dateToDisplay(e.date)} · ${rupiah(e.totalGross)}`}
                            >
                              <i
                                style={{
                                  height: `${Math.max(2, (e.totalGross / Math.max(1, ...entries.map((r) => r.totalGross))) * 100)}%`,
                                }}
                              />
                              <span>
                                {e.date.slice(8)}/{e.date.slice(5, 7)}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                      <p className="report-footnote">
                        Klik batang untuk melihat satu tanggal. Hanya tanggal yang memiliki rekap
                        ditampilkan.
                      </p>
                    </Statement>
                  )}
                </>
              )}
              {tab === "cash" && (
                <>
                  <OutletCashFlow summary={s} />
                  <div className="report-columns">
                    <Statement title="PENJUALAN & PEMBAYARAN">
                      <Line label="Omzet" value={known ? s.gross : null} total />
                      <Line label="QRIS" value={known ? s.qris : null} />
                      <Line label="GoFood" value={known ? s.gofood : null} />
                      <Line label="GrabFood" value={known ? s.grabfood : null} />
                      <Line label="ShopeeFood" value={known ? s.shopeefood : null} />
                      <Line label="Pengeluaran tunai rekap" value={known ? s.expense : null} />
                      <Line label="Cash seharusnya" value={known ? s.cash : null} total />
                      <p className="report-footnote">
                        Cash = omzet − QRIS − online food − pengeluaran. QRIS dan online food
                        menunjukkan pembayaran penjualan; pencairannya ke rekening belum
                        diverifikasi.
                      </p>
                    </Statement>
                    <Statement title="PENERIMAAN SETORAN" blue>
                      <Line
                        label={`Setoran yang sudah diisi (${s.receipts}/${s.records} rekap)`}
                        value={s.receipts ? s.received : null}
                      />
                      <Line
                        label="Cash dari rekap yang belum diterima"
                        value={known ? s.pendingCash : null}
                      />
                      <Line label="Total real (seluruh rekap lengkap)" value={s.real} total />
                      <Line label="Selisih real − cash" value={s.difference} />
                      <Line
                        label="Total kekurangan setoran terisi"
                        value={s.receipts ? s.shortage : null}
                      />
                      <Line
                        label="Total kelebihan setoran terisi"
                        value={s.receipts ? s.excess : null}
                      />
                      <p className="report-footnote">
                        Ini rekonsiliasi setoran, belum menjadi laporan arus kas lengkap. Transfer
                        bank, saldo awal, investasi, dan pendanaan belum memiliki alokasi outlet.
                      </p>
                    </Statement>
                  </div>
                </>
              )}
              {tab === "journal" && (
                <Statement title="BUKU & JURNAL OUTLET">
                  <h4>BUKU BESAR</h4>
                  <form className="report-filters m-4" action="/finance/laporan-akuntansi">
                    <input type="hidden" name="tab" value="journal" />
                    <input type="hidden" name="outlet" value={outlet.id} />
                    <input type="hidden" name="from" value={from} />
                    <input type="hidden" name="to" value={to} />
                    <label>
                      Pilih nomor akun
                      <select name="account" defaultValue={param("account")}>
                        <option value="">Pilih nomor akun…</option>
                        {accounts.map((a) => (
                          <option value={a.code} key={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="button-secondary" type="submit">
                      Lihat buku besar
                    </button>
                  </form>
                  {param("account") && (
                    <p className="report-footnote">
                      {accounts.find((a) => a.code === param("account"))?.name ||
                        "Akun tidak ditemukan"}{" "}
                      · Mutasi dan saldo akun per outlet belum tersedia; jurnal belum memiliki
                      alokasi outlet.
                    </p>
                  )}
                  <div className="report-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Keterangan</th>
                          <th>Debit</th>
                          <th>Kredit</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={5}>
                            Belum ada mutasi jurnal yang dapat diatribusikan ke outlet ini.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <h4>JURNAL TRANSAKSI</h4>

                  <p className="report-footnote">
                    Tabel di bawah adalah riwayat sumber operasional, belum jurnal debit/kredit.
                    Jurnal Finance saat ini belum memiliki alokasi outlet dan tidak dicampur ke
                    laporan ini.
                  </p>
                  {hasPermission(user, "finance-ledger") && (
                    <div className="px-4 pb-4">
                      <Link
                        className="button-secondary"
                        href={"/finance/finance-ledger?" + new URLSearchParams({ from, to })}
                      >
                        Buka buku besar umum
                      </Link>
                    </div>
                  )}
                </Statement>
              )}
              {tab === "variable" && (
                <Statement title="VARIABLE ACCOUNT · REFERENSI PEMETAAN">
                  <p className="report-footnote">
                    Referensi peran akun berdasarkan COA Anda. Pemetaan ini menjelaskan sumber
                    laporan; jurnal otomatis dan pengaturan akun tujuan belum diaktifkan.
                  </p>
                  <div className="report-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Variable / Peran</th>
                          <th>Akun COA</th>
                          <th>Sumber</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            "PENJUALAN_MAKANAN",
                            "4101",
                            "Omzet rekap outlet",
                            "Ditampilkan sebagai rekap sumber",
                          ],
                          [
                            "BEBAN_BONUS",
                            "6104",
                            "Bonus diperoleh crew",
                            "Ditampilkan sebagai rekap sumber",
                          ],
                          [
                            "KAS_OUTLET",
                            "1101",
                            "Saldo kas outlet",
                            "Menunggu saldo awal & jurnal",
                          ],
                          [
                            "QRIS_CLEARING",
                            "1205",
                            "Pencairan QRIS",
                            "Belum terhubung ke jurnal outlet",
                          ],
                          [
                            "ONLINE_FOOD_CLEARING",
                            "1206",
                            "Pencairan online food",
                            "Belum terhubung ke jurnal outlet",
                          ],
                          [
                            "HPP_MAKANAN",
                            "5101",
                            "Pemakaian bahan & persediaan",
                            "Belum terhubung",
                          ],
                          [
                            "BEBAN_GAJI_CREW",
                            "6101",
                            "Payroll crew per outlet",
                            "Belum dialokasikan",
                          ],
                        ].map(([variable, code, source, status]) => (
                          <tr key={variable}>
                            <td>
                              <code>{variable}</code>
                            </td>
                            <td>
                              {accounts.find((a) => a.code === code)
                                ? code + " — " + accounts.find((a) => a.code === code)!.name
                                : "Akun belum tersedia"}
                            </td>
                            <td>{source}</td>
                            <td>{status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="report-footnote">
                    Pengeluaran rekap masih berupa total harian dan belum dirinci ke akun beban.
                    Biaya pusat belum dialokasikan ke outlet. Daftar akun dikelola pada tab Daftar
                    Akun (COA).
                  </p>
                </Statement>
              )}
              {tab === "insights" && (
                <>
                  <OutletPeriodComparison
                    outlet={outlet.id}
                    from={from}
                    to={to}
                    previousFrom={previousFrom}
                    previousTo={previousTo}
                    current={s}
                    previous={previous}
                    error={previousError}
                  />
                  <div className="report-columns">
                    <Statement title="ANALISA OUTLET">
                      <Line
                        label="Rata-rata omzet per tanggal dengan rekap"
                        value={known ? Math.round(s.gross / s.records) : null}
                      />
                      <Line
                        label="Omzet tertinggi satu tanggal"
                        value={known ? Math.max(...entries.map((e) => e.totalGross)) : null}
                      />
                      <Line
                        label="Omzet terendah satu tanggal"
                        value={known ? Math.min(...entries.map((e) => e.totalGross)) : null}
                      />
                      <p className="report-footnote">
                        Hari tanpa rekap tidak dianggap sebagai penjualan nol. Analisa margin
                        menunggu data HPP.
                      </p>
                    </Statement>
                    <Statement title="PERLU DITINJAU" blue>
                      <Line
                        label="Kekurangan dari setoran yang terisi"
                        value={s.receipts ? s.shortage : null}
                      />
                      <Line
                        label="Kelebihan dari setoran yang terisi"
                        value={s.receipts ? s.excess : null}
                      />
                      <div className="report-line">
                        <span>Setoran belum diisi</span>
                        <strong>{s.records - s.receipts} rekap</strong>
                      </div>
                      <p className="report-footnote">
                        Kekurangan dan kelebihan ditampilkan terpisah agar selisih yang saling
                        menutup tetap terlihat.
                      </p>
                    </Statement>
                  </div>
                </>
              )}
              {!["variable", "statements"].includes(tab) && (
                <Statement title="RINCIAN REKAP OUTLET">
                  <div className="report-table">
                    <SortableTable>
                      <caption className="sr-only">Rincian rekap {outlet.name}</caption>
                      <thead>
                        <tr>
                          {[
                            "Tanggal",
                            "Crew / Training",
                            "Omzet",
                            "Pengeluaran",
                            "Bonus",
                            "Cash",
                            "Real",
                            "Selisih",
                          ].map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={e.date}>
                            <td data-sort-value={e.date}>{dateToDisplay(e.date)}</td>
                            <td>
                              {e.crewName}
                              {e.trainingCrewName && (
                                <small className="block text-slate-500">
                                  Training: {e.trainingCrewName}
                                </small>
                              )}
                            </td>
                            {[
                              e.totalGross,
                              e.expenseAmount ?? 0,
                              e.bonusAmount,
                              operationalCash(e),
                              e.cashReceived,
                              e.cashReceived === null ? null : e.cashReceived - operationalCash(e),
                            ].map((n, i) => (
                              <td className="money" data-sort-value={n ?? ""} key={i}>
                                {n === null ? "—" : rupiah(n)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {!known && (
                          <tr>
                            <td colSpan={8}>Belum ada rekap pada periode ini.</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th colSpan={2}>Total periode</th>
                          {[s.gross, s.expense, s.bonus, s.cash, s.real, s.difference].map(
                            (n, i) => (
                              <td className="money" key={i}>
                                {amount(n)}
                              </td>
                            ),
                          )}
                        </tr>
                      </tfoot>
                    </SortableTable>
                  </div>
                  <p className="report-footnote">
                    Total mencakup semua tanggal dalam filter, termasuk yang berada di halaman tabel
                    lain. Real dan selisih total ditampilkan setelah semua setoran terisi.
                  </p>
                </Statement>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
