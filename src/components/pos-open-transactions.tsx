"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SortableTable } from "@/components/sortable-table";
import { previewProducts, type PosProduct } from "@/lib/pos-preview";
import { notifySuccess } from "@/components/notification-toasts";
import {
  readPreviewDrafts,
  writePreviewDrafts,
  draftEvent,
  cartTotal,
  type PreviewDraft,
} from "@/lib/pos-preview";
import { APP_TIME_ZONE } from "@/lib/local-date";
import { rupiah } from "@/lib/money";
export function PosOpenTransactions({
  userId,
  canResume,
  catalog = previewProducts,
}: {
  userId: string;
  canResume: boolean;
  catalog?: readonly PosProduct[];
}) {
  const [drafts, setDrafts] = useState<PreviewDraft[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setDrafts(readPreviewDrafts(userId, catalog));
    queueMicrotask(refresh);
    window.addEventListener(draftEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(draftEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId, catalog]);
  const visible = drafts.filter((draft) =>
    draft.id.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function remove(id: string) {
    try {
      writePreviewDrafts(
        userId,
        readPreviewDrafts(userId, catalog).filter((draft) => draft.id !== id),
      );
      notifySuccess("Draft pesanan dihapus.");
    } catch {
      setError("Penyimpanan browser tidak tersedia.");
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Draft disimpan di browser ini dan belum menjadi penjualan sampai pembayaran dikonfirmasi.
      </p>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-sm font-semibold">Pesanan tersimpan · {visible.length}</h2>
            <p className="mt-1 text-xs text-slate-500">Draft pesanan pada browser dan akun ini.</p>
          </div>
          <input
            aria-label="Cari draft"
            placeholder="Cari nomor draft…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[650px] text-left">
            <thead>
              <tr>
                {["Pesanan", "Waktu", "Jumlah item", "Total", "Aksi"].map((title) => (
                  <th key={title} className="p-4">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((draft) => (
                <tr key={draft.id}>
                  <td className="max-w-[240px] break-all p-4 font-medium">{draft.id}</td>
                  <td className="p-4" data-sort-value={Date.parse(draft.createdAt)}>
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                      timeZone: APP_TIME_ZONE,
                    }).format(new Date(draft.createdAt))}
                  </td>
                  <td className="p-4">
                    {draft.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </td>
                  <td className="p-4">{rupiah(cartTotal(draft.items, draft.method, catalog))}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {canResume && (
                        <Link href={`/pos?draft=${encodeURIComponent(draft.id)}`} prefetch={false}>
                          Lanjutkan
                        </Link>
                      )}
                      <button type="button" onClick={() => remove(draft.id)}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={5} className="p-14 text-center text-slate-500">
                    {query ? "Draft tidak ditemukan." : "Belum ada pesanan tersimpan."}
                    {canResume && !query && (
                      <p className="mt-3">
                        <Link href="/pos" className="text-emerald-700">
                          Buka POS Kasir untuk membuat pesanan →
                        </Link>
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
        {error && (
          <p role="alert" className="p-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
