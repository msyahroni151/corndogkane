"use client";
import { useState } from "react";
import { SortableTable } from "@/components/sortable-table";
import { PosPreviewBanner } from "@/components/pos-preview-banner";
import { UiIcon } from "@/components/ui-icon";
export function PosReturnsPreview() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  return (
    <div className="space-y-4">
      <PosPreviewBanner />
      <section className="panel overflow-hidden">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearched(true);
          }}
          className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 p-5"
        >
          <div>
            <h2 className="text-sm font-semibold">Retur pembeli</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cari struk untuk meninjau transaksi yang akan diretur.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Nomor transaksi"
              placeholder="Cari nomor transaksi…"
              value={query}
              maxLength={100}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearched(false);
              }}
              className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button className="button-secondary">Cari</button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[650px] text-left">
            <thead>
              <tr>
                {["Nomor transaksi", "Tanggal", "Pelanggan", "Total", "Status", "Aksi"].map(
                  (title) => (
                    <th key={title} className="p-4">
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="p-14 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <UiIcon name="return" size={27} />
                  </span>
                  <p className="mt-4 font-medium">
                    {searched && query
                      ? `Transaksi “${query}” belum tersedia.`
                      : "Belum ada transaksi retur."}
                  </p>
                  <p className="mt-2 text-slate-500">
                    Data penjualan belum dihubungkan pada tahap pratinjau ini.
                  </p>
                </td>
              </tr>
            </tbody>
          </SortableTable>
        </div>
      </section>
    </div>
  );
}
