import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { quantityLabel } from "@/lib/goods-receipts";
import { displayDate } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { FormDialog } from "@/components/form-dialog";
import { InventoryRemainderForm } from "@/components/inventory-forms";
import { SortableTable } from "@/components/sortable-table";
export async function ProductionRemainders({ today, q = "" }: { today: string; q?: string }) {
  const db = getPrisma();
  const [records, sources] = await Promise.all([
    db.productionRemainder.findMany({
      include: {
        sourceBatch: { include: { production: true } },
        stockBatch: { include: { item: true } },
        operation: { include: { createdBy: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.inventoryBatch.findMany({
      where: {
        remainingQuantity: { gt: 0 },
        production: { kind: "PRODUCTION" },
        remainderStock: { is: null },
        item: { active: true, kind: { in: ["SUB", "FINISHED"] } },
      },
      include: { item: true, production: true },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);
  const available = records.filter((r) => Number(r.stockBatch.remainingQuantity) > 0),
    grouped = new Map<string, number>();
  for (const row of available)
    grouped.set(
      row.stockBatch.baseUnit,
      (grouped.get(row.stockBatch.baseUnit) || 0) + Number(row.stockBatch.remainingQuantity),
    );
  const visible = records.filter(
    (r) =>
      !q ||
      (r.stockBatch.item.name + " " + r.location + " " + r.notes)
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Sisa hasil olahan yang masih dapat digunakan untuk produksi berikutnya.
        </p>
        <FormDialog title="Catat Sisa Produksi" trigger="+ Catat Sisa Produksi" wide>
          <InventoryRemainderForm
            today={today}
            batches={sources.map((b) => ({
              id: b.id,
              itemId: b.itemId,
              label: b.item.name + " - " + displayDate(b.receivedAt) + " - " + b.id.slice(-6),
              unit: b.baseUnit,
              quantity: Number(b.remainingQuantity),
              value: Number(b.remainingValue),
              version: b.version,
            }))}
          />
        </FormDialog>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["BATCH SISA TERSEDIA", String(available.length)],
          [
            "JUMLAH SISA TERSEDIA",
            [...grouped].map(([u, n]) => quantityLabel(n, u)).join(" / ") || "Belum ada sisa",
          ],
          [
            "NILAI SISA TERSEDIA",
            rupiah(
              Math.round(available.reduce((n, r) => n + Number(r.stockBatch.remainingValue), 0)),
            ),
          ],
        ].map(([label, value]) => (
          <section className="panel p-4" key={label}>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-3 break-words text-xl font-bold">{value}</p>
          </section>
        ))}
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Catat hasil produksi total terlebih dahulu, termasuk bagian yang akan disimpan sebagai sisa.
        Pencatatan sisa memisahkan stok dan nilai dari batch asal; tidak menambah stok atau biaya
        baru. Sisa tetap tercakup dalam nilai stok gudang. Bahan yang belum dipakai tetap di stok
        bahan asal; bahan rusak dicatat melalui Susut.
      </p>
      <form className="panel flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="tab" value="sisa" />
        <label className="field flex-1">
          Cari sisa produksi
          <input
            name="q"
            defaultValue={q}
            maxLength={150}
            placeholder="Nama bahan, lokasi, atau catatan..."
          />
        </label>
        <button className="button-secondary">Cari</button>
      </form>
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <SortableTable className="w-full min-w-[1050px] text-left text-sm">
            <thead>
              <tr>
                {[
                  "Tanggal / Petugas",
                  "Bahan / Produksi Asal",
                  "Sisa Awal",
                  "Tersedia",
                  "Nilai Tersedia",
                  "Lokasi / Catatan",
                  "Status",
                  "Aksi",
                ].map((h) => (
                  <th className="p-4" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="p-4">
                    {displayDate(r.date)}
                    <p className="mt-1 text-xs text-slate-500">{r.operation.createdBy.name}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold">{r.stockBatch.item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Produksi{" "}
                      {r.sourceBatch.production ? displayDate(r.sourceBatch.production.date) : "-"}{" "}
                      / {r.sourceBatchId.slice(-6)}
                    </p>
                  </td>
                  <td className="p-4">
                    {quantityLabel(Number(r.stockBatch.initialQuantity), r.stockBatch.baseUnit)}
                  </td>
                  <td className="p-4 font-semibold">
                    {quantityLabel(Number(r.stockBatch.remainingQuantity), r.stockBatch.baseUnit)}
                  </td>
                  <td className="p-4">{rupiah(Math.round(Number(r.stockBatch.remainingValue)))}</td>
                  <td className="p-4">
                    <p>{r.location || "Belum diisi"}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{r.notes}</p>
                  </td>
                  <td className="p-4">
                    <span
                      className={
                        "rounded-full px-2 py-1 text-xs " +
                        (Number(r.stockBatch.remainingQuantity) > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {Number(r.stockBatch.remainingQuantity) > 0 ? "Tersedia" : "Habis"}
                    </span>
                  </td>
                  <td className="p-4">
                    {Number(r.stockBatch.remainingQuantity) > 0 && r.stockBatch.item.active ? (
                      <Link
                        prefetch={false}
                        className="button-primary whitespace-nowrap"
                        href={
                          "/produksi-gudang?tab=catat&reuse=" + encodeURIComponent(r.stockBatchId)
                        }
                      >
                        Gunakan di Produksi
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    Belum ada sisa produksi yang sesuai.
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
