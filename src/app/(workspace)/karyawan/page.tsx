import { positionBadgeClass } from "@/lib/position-badge";
import { SortableTable } from "@/components/sortable-table";
import { displayDate } from "@/lib/placements";
import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { EmployeeForm } from "@/components/employee-form";
import { FormDialog } from "@/components/form-dialog";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tersimpan?: string; tambah?: string }>;
}) {
  await requireAccess("karyawan");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const where = q
    ? {
        OR: ["id", "fullName", "employeeCode", "department"].map((key) => ({
          [key]: { contains: q, mode: "insensitive" as const },
        })),
      }
    : {};
  const [rows, count] = await Promise.all([
    getPrisma().employee.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: 200,
      select: {
        id: true,
        fullName: true,
        phone: true,
        joinedAt: true,
        position: true,
        activityStatus: true,
      },
    }),
    getPrisma().employee.count({ where }),
  ]);
  return (
    <>
      <section className="panel mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <p className="text-sm font-semibold">
            {count} karyawan{count > 200 ? " · menampilkan 200 pertama" : ""}
          </p>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <form className="flex min-w-0 max-w-full items-center gap-2">
              <input
                name="q"
                aria-label="Cari karyawan"
                placeholder="Cari nama, ID, departemen…"
                defaultValue={q}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button className="button-secondary">Cari</button>
            </form>
            <FormDialog
              key={params.tambah || "closed"}
              title="Tambah Karyawan Baru"
              subtitle="Daftarkan karyawan baru ke sistem"
              compact
              trigger="+ Tambah karyawan"
              initiallyOpen={params.tambah === "1"}
              cancelRoute={params.tambah === "1" ? "/karyawan" : undefined}
            >
              <EmployeeForm />
            </FormDialog>
            {q && (
              <Link href="/karyawan" className="button-secondary">
                Reset
              </Link>
            )}
          </div>
        </div>
        {rows.length ? (
          <div className="relative overflow-x-auto">
            <SortableTable className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {["Nama Karyawan", "Jabatan", "Kontak", "Status", "Aksi"].map((name) => (
                    <th key={name} scope="col" className="px-5 py-4 font-semibold">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-emerald-50/30"
                  >
                    <td className="px-5 py-5" data-sort-value={row.fullName}>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700"
                        >
                          {row.fullName
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {row.fullName.toUpperCase()}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">{row.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${positionBadgeClass(row.position)}`}
                      >
                        {row.position || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <div className="space-y-2 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600/65">
                            <UiIcon name="phone" size={14} />
                          </span>
                          {row.phone ? (
                            <a
                              className="text-slate-600 hover:underline"
                              href={"tel:" + row.phone.replace(/[^+0-9]/g, "")}
                            >
                              {row.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="text-emerald-600/65">
                            <UiIcon name="calendar" size={14} />
                          </span>
                          <span className="sr-only">Tanggal masuk: </span>
                          {row.joinedAt ? (
                            <time dateTime={row.joinedAt.toISOString().slice(0, 10)}>
                              {displayDate(row.joinedAt)}
                            </time>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-5">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-medium ${row.activityStatus === "AKTIF" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                      >
                        {row.activityStatus}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <Link
                        aria-label={"Edit " + row.fullName}
                        className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#3b6051] shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                        href={"/karyawan/" + encodeURIComponent(row.id)}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <h2 className="text-xl font-bold">
              {q ? "Tidak ada hasil pencarian" : "Belum ada data karyawan"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              {q
                ? "Coba kata kunci lain."
                : "Klik Tambah karyawan untuk mengisi biodata. Impor spreadsheet akan dilakukan pada tahap terpisah."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
export default function Employees(props: {
  searchParams: Promise<{ q?: string; tersimpan?: string; tambah?: string }>;
}) {
  return <Content {...props} />;
}
