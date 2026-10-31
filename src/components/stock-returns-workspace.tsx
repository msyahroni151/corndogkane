import SearchForm from "next/form";
import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { returnActionNames, returnStatusNames } from "@/lib/stock-returns";
import { quantityLabel } from "@/lib/goods-receipts";
import { rupiah } from "@/lib/money";
import { FormDialog } from "@/components/form-dialog";
import {
  CreateReturnForm,
  ReturnActionForm,
  ReceiveReturnForm,
  type ReturnOptions,
} from "@/components/stock-return-forms";
const stamp = (date: Date) =>
  date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " WIB";
export async function StockReturnsWorkspace({
  outletId,
  status,
}: {
  outletId: string;
  status: string;
}) {
  const db = getPrisma(),
    scope = outletId ? { outletId } : {},
    include = {
      outlet: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: {
        include: {
          item: { select: { name: true } },
          receipts: { include: { batch: { select: { id: true } } } },
        },
      },
      actions: {
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
    };
  const [outlets, stocks, open, closed] = await Promise.all([
    db.outlet.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.outletStock.findMany({
      where: { quantity: { gt: 0 }, item: { kind: { in: ["RAW", "SUB", "FINISHED"] } } },
      include: { item: { select: { name: true, active: true, baseUnit: true } } },
    }),
    db.stockReturn.findMany({
      where: { ...scope, status: { in: ["REQUESTED", "APPROVED", "SENT", "PARTIAL"] } },
      include,
      orderBy: { createdAt: "desc" },
    }),
    db.stockReturn.findMany({
      where: { ...scope, status: { in: ["RECEIVED", "CANCELLED", "REJECTED"] } },
      include,
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);
  if (outletId && !outlets.some((o) => o.id === outletId))
    return (
      <p className="panel p-6 text-sm text-red-700" role="alert">
        Outlet tidak ditemukan.{" "}
        <Link href="/control-stok?tab=returns">Kembali ke seluruh retur</Link>
      </p>
    );
  const options: ReturnOptions = {
    outlets,
    stocks: stocks
      .filter((s) => s.unit === s.item.baseUnit)
      .map((s) => ({
        outletId: s.outletId,
        itemId: s.itemId,
        name: s.item.name,
        unit: s.unit,
        quantity: Number(s.quantity),
        active: s.item.active,
      })),
  };
  const all = [...open, ...closed].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    visible = all.filter((r) => !returnStatusNames[status] || r.status === status),
    pending = all.filter((r) => ["SENT", "PARTIAL"].includes(r.status));
  const unknown = pending
    .flatMap((r) => r.lines)
    .filter((l) => l.receivedQuantity.lessThan(l.quantity) && l.value === null).length;
  const transit = pending
    .flatMap((r) => r.lines)
    .reduce((sum, l) => sum + (l.value === null ? 0 : Number(l.value.minus(l.receivedValue))), 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Retur Barang</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pengembalian barang layak pakai dari outlet ke Gudang Pusat.
          </p>
        </div>
        <FormDialog title="Ajukan Retur Barang" trigger="+ Ajukan Retur" wide>
          <CreateReturnForm options={options} outletId={outletId} />
        </FormDialog>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "MENUNGGU PERSETUJUAN",
            String(open.filter((r) => r.status === "REQUESTED").length),
            "pengajuan belum mengubah stok",
          ],
          [
            "SIAP DIKIRIM",
            String(open.filter((r) => r.status === "APPROVED").length),
            "stok diperiksa ulang saat pengiriman",
          ],
          [
            "DALAM PERJALANAN",
            String(pending.length),
            rupiah(transit) +
              (unknown ? " · " + unknown + " nilai belum tercatat" : " · nilai tersisa"),
          ],
          [
            "DITERIMA GUDANG",
            String(closed.filter((r) => r.status === "RECEIVED").length),
            "dari 300 riwayat selesai terbaru",
          ],
        ].map(([label, value, note]) => (
          <section className="panel p-4" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <strong className="mt-3 block text-xl">{value}</strong>
            <p className="mt-1 text-xs text-slate-400">{note}</p>
          </section>
        ))}
      </div>
      <section className="panel p-4">
        <SearchForm
          action=""
          prefetch={false}
          scroll={false}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="tab" value="returns" />
          <label className="field min-w-48 flex-1">
            Outlet
            <select name="outlet" defaultValue={outletId}>
              <option value="">Semua outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field min-w-48 flex-1">
            Status retur
            <select name="status" defaultValue={returnStatusNames[status] ? status : ""}>
              <option value="">Semua status</option>
              {Object.entries(returnStatusNames).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button className="button-primary">Terapkan</button>
        </SearchForm>
      </section>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-700">
        Alur: Diajukan → Disetujui → Dikirim → Diterima Gudang. Stok outlet berkurang saat dikirim;
        stok gudang bertambah hanya sesuai jumlah yang dikonfirmasi diterima. Selisih penerimaan
        tetap terbuka, tidak dihapus otomatis.
      </p>
      <div className="space-y-4">
        {visible.map((r) => (
          <article key={r.id} className="panel p-5" aria-label={"Retur " + r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{r.outlet.name} → Gudang Pusat</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {r.id} · {stamp(r.createdAt)}
                </p>
                <p className="mt-2 text-xs">
                  Petugas: {r.requesterName} · Dicatat: {r.createdBy.name}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{r.notes}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                {returnStatusNames[r.status]}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {[
                      "Barang",
                      "Jumlah retur",
                      "Diterima gudang",
                      "Belum diterima",
                      "Nilai terkirim",
                    ].map((label) => (
                      <th className="p-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l) => (
                    <tr className="border-b border-slate-100" key={l.id}>
                      <td className="p-3 font-semibold">{l.item.name}</td>
                      <td className="p-3">{quantityLabel(Number(l.quantity), l.unit)}</td>
                      <td className="p-3">{quantityLabel(Number(l.receivedQuantity), l.unit)}</td>
                      <td className="p-3">
                        {["SENT", "PARTIAL", "RECEIVED"].includes(r.status)
                          ? quantityLabel(Number(l.quantity.minus(l.receivedQuantity)), l.unit)
                          : "Belum dikirim"}
                      </td>
                      <td className="p-3">
                        {!["SENT", "PARTIAL", "RECEIVED"].includes(r.status)
                          ? "Ditentukan saat dikirim"
                          : l.value === null
                            ? "Nilai asal belum tercatat"
                            : rupiah(Number(l.value))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.status === "REQUESTED" && (
                <>
                  <FormDialog title="Setujui Retur" trigger="Setujui">
                    <ReturnActionForm
                      id={r.id}
                      version={r.version}
                      kind="APPROVE"
                      label="Setujui Retur"
                    >
                      <p className="text-sm">
                        Setujui pengembalian dari {r.outlet.name}? Stok belum berubah hingga barang
                        dikirim.
                      </p>
                    </ReturnActionForm>
                  </FormDialog>
                  <FormDialog title="Tolak Retur" trigger="Tolak">
                    <ReturnActionForm
                      id={r.id}
                      version={r.version}
                      kind="REJECT"
                      label="Tolak Retur"
                    >
                      <p className="text-sm">Pengajuan ditutup tanpa mengubah stok.</p>
                    </ReturnActionForm>
                  </FormDialog>
                </>
              )}
              {r.status === "APPROVED" && (
                <FormDialog title="Kirim Retur ke Gudang" trigger="Kirim Retur">
                  <ReturnActionForm
                    id={r.id}
                    version={r.version}
                    kind="SEND"
                    label="Konfirmasi Pengiriman"
                  >
                    <p className="text-sm">
                      Pastikan barang sudah diserahkan untuk dikirim. Konfirmasi ini mengurangi stok
                      outlet dan mencatat barang dalam perjalanan ke Gudang Pusat.
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {r.lines.map((l) => (
                        <li key={l.id}>
                          {l.item.name}: {quantityLabel(Number(l.quantity), l.unit)}
                        </li>
                      ))}
                    </ul>
                  </ReturnActionForm>
                </FormDialog>
              )}
              {["REQUESTED", "APPROVED"].includes(r.status) && (
                <FormDialog title="Batalkan Retur" trigger="Batalkan">
                  <ReturnActionForm
                    id={r.id}
                    version={r.version}
                    kind="CANCEL"
                    label="Batalkan Retur"
                  >
                    <p className="text-sm">
                      Hanya retur yang belum dikirim dapat dibatalkan. Stok tetap.
                    </p>
                  </ReturnActionForm>
                </FormDialog>
              )}
              {["SENT", "PARTIAL"].includes(r.status) && (
                <FormDialog title="Terima Retur di Gudang" trigger="Terima di Gudang" wide>
                  <ReceiveReturnForm
                    id={r.id}
                    version={r.version}
                    items={r.lines.map((l) => ({
                      id: l.id,
                      name: l.item.name,
                      unit: l.unit,
                      quantity: Number(l.quantity),
                      receivedQuantity: Number(l.receivedQuantity),
                      value: l.value === null ? null : Number(l.value),
                    }))}
                  />
                </FormDialog>
              )}
            </div>
            <details className="mt-4 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-[#3b6051]">
                Riwayat tindakan & batch penerimaan
              </summary>
              <ol className="mt-3 space-y-3">
                {r.actions.map((a) => (
                  <li className="text-xs" key={a.id}>
                    <strong>
                      {returnActionNames[a.kind]} · {a.actor.name}
                    </strong>
                    <p className="mt-1 text-slate-400">{stamp(a.createdAt)}</p>
                    {a.notes && <p className="mt-1 whitespace-pre-wrap">{a.notes}</p>}
                    {r.lines.flatMap((l) =>
                      l.receipts
                        .filter((b) => b.actionId === a.id)
                        .map((b) => (
                          <p className="mt-1 text-slate-500" key={b.id}>
                            {l.item.name} · {quantityLabel(Number(b.quantity), l.unit)} ·{" "}
                            {rupiah(Number(b.value))} · Batch {b.batch.id} ·{" "}
                            {b.valueSource === "MANUAL"
                              ? "Nilai perolehan diisi penerima"
                              : "Nilai dibawa dari outlet"}
                          </p>
                        )),
                    )}
                  </li>
                ))}
              </ol>
            </details>
          </article>
        ))}
        {!visible.length && (
          <section className="panel p-10 text-center text-sm text-slate-400">
            Belum ada retur barang pada filter ini.
          </section>
        )}
      </div>
      <p className="text-xs leading-6 text-slate-400">
        Menampilkan seluruh retur terbuka dan 300 riwayat selesai terbaru. Retur adalah perpindahan
        persediaan, bukan pembelian atau penjualan baru. Nilai stok yang belum diketahui tidak
        dianggap nol; penerima mengisi nilai perolehan berdasarkan bukti saat menerima barang.
      </p>
    </div>
  );
}
