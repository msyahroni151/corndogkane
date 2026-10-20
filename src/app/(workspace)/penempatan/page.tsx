import { SortableTable } from "@/components/sortable-table";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { FormDialog } from "@/components/form-dialog";
import { PlacementForm } from "@/components/placement-form";
import {
  displayDate,
  employeeGroup,
  isBackupEmployee,
  todayWib,
  roleLabels,
  roleColors,
  type OperationalRole,
} from "@/lib/placements";
export default async function Placements({
  searchParams,
}: {
  searchParams: Promise<{ riwayat?: string; tersimpan?: string }>;
}) {
  await requireAccess("jadwal");
  const params = await searchParams;
  const history = params.riwayat === "1",
    today = todayWib(),
    db = getPrisma();
  const [employees, areas, outlets, records] = await Promise.all([
    db.employee.findMany({
      where: { active: true },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        department: true,
        position: true,
        active: true,
      },
      orderBy: { fullName: "asc" },
    }),
    db.area.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.outlet.findMany({
      where: { active: true, area: { active: true } },
      orderBy: { name: "asc" },
    }),
    db.placement.findMany({
      where: history
        ? {}
        : { endDate: { gte: new Date(today + "T00:00:00Z") }, employee: { active: true } },
      include: { employee: { select: { department: true, position: true, active: true } } },
      orderBy: [{ startDate: "desc" }, { employeeName: "asc" }],
      take: 200,
    }),
  ]);
  const eligible = employees.flatMap((employee) => {
    const group = employeeGroup(employee);
    if (!group) return [];
    const role: OperationalRole =
      group === "warehouse"
        ? employee.position.toUpperCase().includes("LEADER")
          ? "LEADER_SHIFT"
          : "CREW_GUDANG"
        : isBackupEmployee(employee)
          ? "BACKUP"
          : "REGULER";
    return [{ id: employee.id, name: employee.employeeCode || employee.fullName, group, role }];
  });
  const displayed = history
    ? records
    : records.filter((record) => employeeGroup(record.employee) !== null);
  const sections = [
    { title: "Penempatan outlet & backup", warehouse: false },
    { title: "Penempatan gudang", warehouse: true },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <Link href="/master-area" className="button-secondary">
          Master Area
        </Link>
        <Link href="/master-outlet" className="button-secondary">
          Master Outlet
        </Link>
      </div>
      {params.tersimpan === "1" && (
        <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          Penempatan berhasil disimpan.
        </p>
      )}
      <div className="mt-6">
        <FormDialog title="Tambah penempatan periode" trigger="+ Tambah penempatan" wide>
          <PlacementForm
            employees={eligible}
            areas={areas.map((area) => ({ id: area.id, name: area.name }))}
            outlets={outlets.map((outlet) => ({
              id: outlet.id,
              name: outlet.name,
              areaId: outlet.areaId,
            }))}
            today={today}
          />
        </FormDialog>
      </div>
      <div className="mb-5 mt-8 flex flex-wrap gap-3">
        <Link className={history ? "button-secondary" : "button-primary"} href="/penempatan">
          Berjalan & mendatang
        </Link>
        <Link
          className={history ? "button-primary" : "button-secondary"}
          href="/penempatan?riwayat=1"
        >
          Riwayat seluruh periode
        </Link>
      </div>
      {sections.map((section) => {
        const rows = displayed.filter(
          (record) =>
            (record.role === "LEADER_SHIFT" || record.role === "CREW_GUDANG") === section.warehouse,
        );
        return (
          <section key={section.title} className="panel mb-6 overflow-hidden">
            <h2 className="border-b border-slate-200 p-5 font-bold">{section.title}</h2>
            {rows.length ? (
              <div className="overflow-x-auto">
                <SortableTable className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        "Karyawan",
                        "Periode",
                        section.warehouse ? "Jabatan gudang" : "Role operasional",
                        section.warehouse ? "Lokasi kerja" : "Outlet default",
                        "Area asal",
                        "Catatan",
                      ].map((label) => (
                        <th key={label} className="px-5 py-4">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((record) => (
                      <tr key={record.id}>
                        <td className="px-5 py-4">
                          <p className="font-semibold">{record.employeeName}</p>
                          <p className="mt-1 text-xs text-slate-500">{record.employeeId}</p>
                          {!record.employee.active && (
                            <span className="text-xs text-slate-500">Karyawan tidak aktif</span>
                          )}
                        </td>
                        <td
                          className="whitespace-nowrap px-5 py-4"
                          data-sort-value={record.startDate.getTime()}
                        >
                          {displayDate(record.startDate)}
                          <br />
                          <span className="text-xs text-slate-500">
                            s.d. {displayDate(record.endDate)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ backgroundColor: roleColors[record.role] }}
                          >
                            {roleLabels[record.role]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {section.warehouse
                            ? record.location
                            : record.outletName || "Mengikuti jadwal harian"}
                        </td>
                        <td className="px-5 py-4">
                          {record.areaName ? (
                            <span
                              className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
                              style={{ backgroundColor: record.areaColor || "#deeddd" }}
                            >
                              {record.areaName}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-sm whitespace-pre-wrap px-5 py-4 text-slate-500">
                          {record.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </SortableTable>
              </div>
            ) : (
              <p className="p-6 text-sm text-slate-500">
                Belum ada penempatan {section.warehouse ? "gudang" : "outlet/backup"}{" "}
                {history ? "yang tersimpan" : "berjalan atau mendatang"}.
              </p>
            )}
          </section>
        );
      })}
      <p className="text-xs leading-6 text-slate-500">
        {history
          ? "Riwayat tetap ditampilkan meskipun karyawan sudah tidak aktif."
          : "Karyawan resign/tidak aktif tidak ditampilkan pada penempatan berjalan maupun pilihan penempatan baru."}{" "}
        Maksimal 200 catatan ditampilkan. Jadwal harian belum dibuat pada tahap ini.
      </p>
    </>
  );
}
