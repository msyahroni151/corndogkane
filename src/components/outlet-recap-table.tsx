"use client";
import { SortableTable } from "@/components/sortable-table";
import { recapColumns, recapMoneyKeys, recapValue, type OutletRecapRow } from "@/lib/outlet-recap";
import { dateToDisplay } from "@/lib/local-date";
import { rupiah } from "@/lib/money";
function display(row: OutletRecapRow, key: string) {
  const value = recapValue(row, key);
  if (value === null) return "—";
  if (key === "date") return dateToDisplay(String(value));
  return typeof value === "number" && recapMoneyKeys.has(key) ? rupiah(value) : value;
}
function csv(value: string) {
  return '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
}
export function downloadOutletRecap(rows: OutletRecapRow[], start: string, end: string) {
  const data = [
    [...recapColumns.map((column) => column.label)],
    ...rows.map((row) =>
      recapColumns.map((column) =>
        String(
          column.key === "date" ? dateToDisplay(row.date) : (recapValue(row, column.key) ?? "—"),
        ),
      ),
    ),
  ];
  const blob = new Blob(["\uFEFF" + data.map((row) => row.map(csv).join(";")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const href = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = href;
  link.download = `rekap-penjualan-outlet-${start}-${end}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function OutletRecapTable({
  rows,
  loading,
  error,
}: {
  rows: OutletRecapRow[];
  loading: boolean;
  error: string;
}) {
  const visibleColumns = recapColumns.filter(
    (column) => column.key !== "reference" && column.key !== "crewId",
  );
  const groups = [...new Set(visibleColumns.map((column) => column.group))];
  return (
    <section className="panel operation-recap" aria-label="Rekap Penjualan Outlet">
      <div className="operation-recap-title">
        <h2>Rekap Penjualan Outlet</h2>
        <span>{rows.length} rekap</span>
      </div>
      <p className="operation-recap-note">
        Angka penjualan memakai sumber final per outlet dan tanggal. Rekap total manual tidak
        dijumlahkan lagi dengan transaksi POS. Kolom jumlah isian/balutan/topping khusus rekap
        manual; rincian produk transaksi tersedia di riwayat POS.
      </p>
      {error && (
        <p role="alert" className="operation-error">
          {error}
        </p>
      )}
      <div className="operation-recap-scroll" aria-busy={loading}>
        <SortableTable className="operation-recap-table">
          <caption className="sr-only">
            Rekap jumlah produk dan pembayaran tiap outlet sesuai periode yang dipilih
          </caption>
          <thead>
            <tr>
              {groups.map((group) => (
                <th
                  key={group}
                  scope="colgroup"
                  colSpan={visibleColumns.filter((column) => column.group === group).length}
                  data-sortable={false}
                  className={`recap-group recap-group-${group.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {group}
                </th>
              ))}
            </tr>
            <tr>
              {visibleColumns.map((column) => (
                <th scope="col" key={column.key}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading &&
              !error &&
              rows.map((row) => (
                <tr key={row.id}>
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      data-sort-value={
                        column.key === "date"
                          ? Date.parse(row.date)
                          : (recapValue(row, column.key) ?? "")
                      }
                      className={
                        column.key === "expenseNotes"
                          ? "recap-notes"
                          : recapMoneyKeys.has(column.key)
                            ? "recap-money"
                            : ""
                      }
                    >
                      {display(row, column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            {(loading || error || !rows.length) && (
              <tr>
                <td colSpan={visibleColumns.length} className="recap-empty">
                  {loading
                    ? "Menyiapkan rekap…"
                    : error
                      ? "Rekap belum dapat ditampilkan."
                      : "Belum ada rekap operasional untuk filter ini."}
                </td>
              </tr>
            )}
          </tbody>
        </SortableTable>
      </div>
    </section>
  );
}
