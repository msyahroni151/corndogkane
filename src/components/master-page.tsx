import { DeleteAreaForm } from "@/components/delete-area-form";
import { SortableTable } from "@/components/sortable-table";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { saveArea, saveOutlet } from "@/app/master-actions";
import { FormDialog } from "@/components/form-dialog";
import { OutletForm } from "@/components/outlet-form";
import { outletDays, readOutletHours } from "@/lib/outlet-settings";
import { rupiah } from "@/lib/money";
import { RecordForm } from "@/components/record-form";
import type { RecordField } from "@/lib/record-fields";

export type MasterQuery = {
  q?: string;
  editArea?: string;
  editOutlet?: string;
  tersimpan?: string;
};
export async function MasterPage({
  kind,
  searchParams,
}: {
  kind: "area" | "outlet";
  searchParams: Promise<MasterQuery>;
}) {
  await requireAccess(kind === "area" ? "master-area" : "master-outlet");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const base = kind === "area" ? "/master-area" : "/master-outlet";
  const db = getPrisma();
  const [areas, outlets] = await Promise.all([
    db.area.findMany({ orderBy: { name: "asc" } }),
    kind === "outlet"
      ? db.outlet.findMany({ include: { area: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  const term = q.toLocaleLowerCase("id-ID");
  const visibleAreas = areas.filter((area) =>
    [area.name, area.id].some((value) => value.toLocaleLowerCase("id-ID").includes(term)),
  );
  const visibleOutlets = outlets.filter((outlet) =>
    [outlet.name, outlet.nameCode || "", outlet.id, outlet.area.name].some((value) =>
      value.toLocaleLowerCase("id-ID").includes(term),
    ),
  );
  const editArea = kind === "area" ? areas.find((area) => area.id === query.editArea) : undefined;
  const editOutlet =
    kind === "outlet" ? outlets.find((outlet) => outlet.id === query.editOutlet) : undefined;
  const edit = editArea || editOutlet;
  const noun = kind === "area" ? "area" : "outlet";
  const statusOptions = [
    { value: "true", label: "AKTIF" },
    { value: "false", label: "TIDAK AKTIF" },
  ];
  const fields: RecordField[] = [
    ...(!edit
      ? []
      : [
          {
            key: "id",
            label: `ID ${noun}`,
            readOnly: !!edit,
            help: "ID dibuat otomatis dan tidak dapat diubah.",
          },
        ]),
    ...(kind === "area"
      ? [
          {
            key: "name",
            label: "Pilih area",
            required: true,
            suggestions: [
              ...new Set([
                "AREA 1",
                "AREA 2",
                "AREA 3",
                "AREA 4",
                ...areas.map((area) => area.name),
              ]),
            ],
            help: "Pilih Area 1–4 atau ketik nama area baru, lalu simpan.",
          },
        ]
      : [
          { key: "name", label: "Nama outlet", required: true },
          {
            key: "areaId",
            label: "Area outlet",
            required: true,
            options: [
              { value: "", label: "Pilih area…" },
              ...areas.map((area) => ({
                value: area.id,
                label: area.name + (area.active ? "" : " · tidak aktif"),
              })),
            ],
          },
        ]),
    {
      key: "active",
      label: "Status",
      defaultValue: "true",
      options: statusOptions,
      required: true,
    },
  ];
  const initial: Record<string, string> = editArea
    ? {
        id: editArea.id,
        name: editArea.name,
        active: String(editArea.active),
      }
    : editOutlet
      ? {
          id: editOutlet.id,
          name: editOutlet.name,
          areaId: editOutlet.areaId,
          active: String(editOutlet.active),
        }
      : {};
  const returnRoute = base + (q ? "?q=" + encodeURIComponent(q) : "");
  const successRoute = base + "?tersimpan=1" + (q ? "&q=" + encodeURIComponent(q) : "");
  const editHref = (id: string) =>
    base +
    "?" +
    new URLSearchParams({ [kind === "area" ? "editArea" : "editOutlet"]: id, ...(q ? { q } : {}) });
  const count = kind === "area" ? visibleAreas.length : visibleOutlets.length;
  return (
    <>
      {query.tersimpan && (
        <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          Master {noun} berhasil disimpan.
        </p>
      )}
      <section
        className="panel mt-7 overflow-hidden"
        aria-label={kind === "area" ? "Tabel Master Area" : "Tabel Master Outlet"}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <h2 className="font-bold">
            Master {noun} · {count}
          </h2>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <form action={base} className="flex min-w-0 max-w-full items-center gap-2">
              <input
                name="q"
                aria-label={`Cari ${noun}`}
                defaultValue={q}
                placeholder={
                  kind === "area" ? "Cari nama atau ID area…" : "Cari outlet, ID, atau area…"
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button className="button-secondary">Cari</button>
            </form>
            <FormDialog
              key={edit?.id || "new-" + kind}
              title={edit ? `Edit ${noun}` : `Tambah ${noun}`}
              trigger={`+ Tambah ${noun}`}
              wide={kind === "outlet"}
              initiallyOpen={!!edit}
              cancelRoute={edit ? returnRoute : undefined}
            >
              {kind === "area" ? (
                <RecordForm
                  key={edit?.id || "new-" + kind}
                  title={edit ? `Edit ${noun}` : kind === "area" ? "Area" : "Outlet"}
                  fields={fields}
                  saveAction={kind === "area" ? saveArea : saveOutlet}
                  existingId={edit?.id}
                  initial={initial}
                  successRoute={successRoute}
                  cancelRoute={returnRoute}
                />
              ) : (
                <OutletForm
                  areas={areas}
                  initial={
                    editOutlet
                      ? {
                          id: editOutlet.id,
                          name: editOutlet.name,
                          nameCode: editOutlet.nameCode,
                          areaId: editOutlet.areaId,
                          active: editOutlet.active,
                          closed: editOutlet.closed,
                          dailyRate: editOutlet.dailyRate,
                          hours: readOutletHours(editOutlet.operatingHours),
                          latitude: editOutlet.latitude,
                          longitude: editOutlet.longitude,
                          address: editOutlet.address,
                        }
                      : undefined
                  }
                  successRoute={successRoute}
                  cancelRoute={returnRoute}
                />
              )}
            </FormDialog>
            {q && (
              <Link href={base} className="button-secondary">
                Reset
              </Link>
            )}
          </div>
        </div>
        {count ? (
          <div className="relative overflow-x-auto">
            <SortableTable className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {(kind === "area"
                    ? ["Area", "ID", "Status", "Aksi"]
                    : ["Outlet", "Area", "Tarif harian", "Jam operasional", "Status", "Aksi"]
                  ).map((label) => (
                    <th scope="col" className="p-4" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kind === "area"
                  ? visibleAreas.map((area) => (
                      <tr key={area.id}>
                        <td className="p-4">
                          <span
                            className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ backgroundColor: area.color }}
                          >
                            {area.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap p-4">{area.id}</td>
                        <td className="p-4">{area.active ? "AKTIF" : "TIDAK AKTIF"}</td>
                        <td className="p-4">
                          <Link href={editHref(area.id)} className="font-semibold text-[#3b6051]">
                            Edit
                          </Link>
                          <FormDialog title="Hapus Area" trigger="Delete">
                            <DeleteAreaForm
                              id={area.id}
                              name={area.name}
                              version={area.updatedAt.toISOString()}
                            />
                          </FormDialog>
                        </td>
                      </tr>
                    ))
                  : visibleOutlets.map((outlet) => (
                      <tr key={outlet.id}>
                        <td className="p-4">
                          <p className="font-semibold">{outlet.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{outlet.id}</p>
                        </td>
                        <td className="p-4">
                          <span
                            className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ backgroundColor: outlet.area.color }}
                          >
                            {outlet.area.name}
                          </span>
                        </td>
                        <td
                          className="whitespace-nowrap p-4 font-semibold"
                          data-sort-value={outlet.dailyRate ?? ""}
                        >
                          {outlet.dailyRate === null ? "Belum diatur" : rupiah(outlet.dailyRate)}
                        </td>
                        <td
                          className="p-4"
                          data-sort-value={
                            readOutletHours(outlet.operatingHours)
                              ?.map((day) => (day.closed ? "24:00" : day.open))
                              .join("|") ?? ""
                          }
                        >
                          {readOutletHours(outlet.operatingHours) ? (
                            <details>
                              <summary className="cursor-pointer text-xs font-semibold text-[#3b6051]">
                                Lihat Senin–Minggu
                              </summary>
                              <dl className="mt-2 min-w-48 space-y-1 text-xs">
                                {readOutletHours(outlet.operatingHours)!.map((day, index) => (
                                  <div key={index} className="flex justify-between gap-3">
                                    <dt>{outletDays[index]}</dt>
                                    <dd>
                                      {day.closed
                                        ? "Tutup"
                                        : day.open +
                                          "–" +
                                          day.close +
                                          (day.close < day.open ? " (+1 hari)" : "")}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          ) : (
                            "Belum diatur"
                          )}
                        </td>
                        <td
                          className="p-4"
                          data-sort-value={
                            outlet.closed ? "TUTUP" : outlet.active ? "AKTIF" : "TIDAK AKTIF"
                          }
                        >
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${outlet.closed ? "border-slate-300 bg-slate-100 text-slate-700" : outlet.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
                          >
                            {outlet.closed ? "TUTUP" : outlet.active ? "AKTIF" : "TIDAK AKTIF"}
                          </span>
                        </td>
                        <td className="p-4">
                          <Link href={editHref(outlet.id)} className="font-semibold text-[#3b6051]">
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            {q ? (
              `Tidak ada ${noun} ditemukan. Coba kata kunci lain.`
            ) : kind === "area" ? (
              "Belum ada area. Klik Tambah area untuk membuat data baru."
            ) : (
              <>
                Belum ada outlet. Klik Tambah outlet untuk membuat data baru.
                {!areas.length && (
                  <p className="mt-3">
                    <Link href="/master-area" className="font-semibold text-[#3b6051]">
                      Buat area terlebih dahulu →
                    </Link>
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>
      <p className="mt-5 text-xs leading-6 text-slate-500">
        Master bisa diperbarui atau dinonaktifkan. Penempatan periode yang sudah tersimpan tetap
        menggunakan nama area/outlet saat disimpan.
      </p>
    </>
  );
}
