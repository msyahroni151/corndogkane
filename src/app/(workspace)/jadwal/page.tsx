import { ShareWarehouseSchedule } from "@/components/share-warehouse-schedule";
import { ShareSchedule } from "@/components/share-schedule";
import { SortableTable } from "@/components/sortable-table";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  todayWib,
  displayDate,
  parseCivilDate,
  employeeGroup,
  isBackupEmployee,
  roleLabels,
} from "@/lib/placements";
import { timeLabel } from "@/lib/schedules";
import { FormDialog } from "@/components/form-dialog";
import { ScheduleForm } from "@/components/schedule-form";
import { UiIcon } from "@/components/ui-icon";
import type { Prisma } from "@/generated/prisma/client";
export default async function Schedules({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    employee?: string;
    area?: string;
    from?: string;
    to?: string;
    tersimpan?: string;
  }>;
}) {
  await requireAccess("jadwal");
  const query = await searchParams,
    db = getPrisma();
  const month = query.month || query.from?.slice(0, 7) || todayWib().slice(0, 7);
  let valid = true,
    fromDate = new Date(0),
    toDate = new Date(0),
    from = "",
    to = "";
  try {
    if (!/^\d{4}-\d{2}$/.test(month)) throw Error();
    const first = parseCivilDate(month + "-01"),
      last = new Date(first);
    last.setUTCMonth(last.getUTCMonth() + 1);
    last.setUTCDate(0);
    from = query.from || first.toISOString().slice(0, 10);
    to = query.to || last.toISOString().slice(0, 10);
    fromDate = parseCivilDate(from);
    toDate = parseCivilDate(to);
    if (toDate < fromDate || toDate.getTime() - fromDate.getTime() > 365 * 86400000) throw Error();
  } catch {
    valid = false;
  }
  const areaOutletIds = query.area
    ? (await db.outlet.findMany({ where: { areaId: query.area }, select: { id: true } })).map(
        (o) => o.id,
      )
    : [];
  const where: Prisma.ScheduleWhereInput = {
    date: { gte: fromDate, lte: toDate },
    ...(query.employee ? { employeeId: query.employee } : {}),
    ...(query.area
      ? {
          OR: [
            { outletId: { in: areaOutletIds } },
            { outletId: null, placement: { areaId: query.area } },
          ],
        }
      : {}),
  };
  const [crew, outlets, rows, groups, employees, areas] = await Promise.all([
    db.employee.findMany({ where: { active: true }, orderBy: { fullName: "asc" } }),
    db.outlet.findMany({
      where: { active: true, area: { active: true } },
      orderBy: { name: "asc" },
    }),
    valid
      ? db.schedule.findMany({
          where,
          orderBy: [{ date: "asc" }, { areaName: "asc" }, { employeeName: "asc" }],
          take: 500,
        })
      : [],
    valid
      ? db.schedule.groupBy({
          by: ["employeeId", "status", "shift"],
          where,
          _count: { _all: true },
        })
      : [],
    db.employee.findMany({
      select: { id: true, employeeCode: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const count = groups.reduce((sum, g) => sum + g._count._all, 0);
  const metrics = [
    { label: "Total Jadwal", value: count, tone: "text-[#233d32]" },
    {
      label: "Karyawan",
      value: new Set(groups.map((g) => g.employeeId)).size,
      tone: "text-[#233d32]",
    },
    {
      label: "Shift 1 & 2",
      value: groups
        .filter((g) => g.status === "KERJA" && (g.shift === "S1" || g.shift === "S2"))
        .reduce((sum, g) => sum + g._count._all, 0),
      tone: "text-blue-600",
    },
    {
      label: "Full Shift",
      value: groups
        .filter((g) => g.status === "KERJA" && g.shift === "FULL")
        .reduce((sum, g) => sum + g._count._all, 0),
      tone: "text-orange-700",
    },
  ];
  const caption = valid
    ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        fromDate,
      )
    : "Periode tidak valid";
  const successRoute =
    "/jadwal?" +
    new URLSearchParams({
      month,
      ...(query.from ? { from } : {}),
      ...(query.to ? { to } : {}),
      ...(query.employee ? { employee: query.employee } : {}),
      ...(query.area ? { area: query.area } : {}),
      tersimpan: "1",
    }).toString();
  const currentWeek = new Date(todayWib() + "T00:00:00Z");
  currentWeek.setUTCDate(currentWeek.getUTCDate() - ((currentWeek.getUTCDay() + 6) % 7));
  const weekStart = currentWeek.toISOString().slice(0, 10);
  const shareFrom =
    valid && query.from
      ? from
      : month === todayWib().slice(0, 7)
        ? weekStart
        : valid
          ? month + "-01"
          : weekStart;
  const shareEnd = new Date(shareFrom + "T00:00:00Z");
  shareEnd.setUTCDate(shareEnd.getUTCDate() + 6);
  const shareTo = valid && query.to ? to : shareEnd.toISOString().slice(0, 10);
  function createButton() {
    return (
      <FormDialog title="Buat jadwal periode" trigger="+ Buat Jadwal">
        <ScheduleForm
          successRoute={successRoute}
          employees={crew
            .filter((e) => employeeGroup(e))
            .map((e) => ({
              id: e.id,
              name: e.employeeCode?.trim() || e.fullName,
              group: employeeGroup(e)!,
              backup: isBackupEmployee(e),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "id-ID", { numeric: true }))}
          outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
        />
      </FormDialog>
    );
  }
  return (
    <div className="space-y-5">
      {query.tersimpan && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Jadwal berhasil disimpan.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <section key={m.label} className="panel px-5 py-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {m.label}
            </p>
            <p className={`mt-2 text-xl font-bold ${m.tone}`}>{m.value}</p>
          </section>
        ))}
      </div>
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-4">
        <form className="flex flex-wrap items-end gap-3 text-xs">
          <label className="flex flex-col gap-1.5 text-slate-500">
            Bulan
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
              type="month"
              name="month"
              defaultValue={month}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-slate-500">
            Karyawan
            <select
              className="max-w-[230px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
              name="employee"
              defaultValue={query.employee || ""}
            >
              <option value="">Semua karyawan</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode || e.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-slate-500">
            Area
            <select
              name="area"
              defaultValue={query.area || ""}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <option value="">Semua area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button-secondary !py-2.5">Terapkan</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <ShareSchedule from={shareFrom} to={shareTo} area={query.area} />
          <ShareWarehouseSchedule
            from={valid ? from : shareFrom}
            to={valid && toDate.getTime() - fromDate.getTime() <= 30 * 86400000 ? to : shareTo}
          />
          {createButton()}
        </div>
      </section>
      <section className="panel overflow-hidden">
        {!valid ? (
          <p role="alert" className="p-6 text-sm text-red-700">
            Periksa bulan atau rentang tanggal. Rentang maksimal satu tahun.
          </p>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <SortableTable className="w-full text-left text-xs">
              <thead>
                <tr>
                  {[
                    "Tanggal",
                    "Karyawan",
                    "Role",
                    "Area asal / lokasi",
                    "Status",
                    "Outlet kerja",
                    "Shift / jam",
                    "Catatan",
                    "Aksi",
                  ].map((label) => (
                    <th key={label} className="px-4 py-4">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td
                      className="whitespace-nowrap px-4 py-4"
                      data-sort-value={row.date.getTime()}
                    >
                      {displayDate(row.date)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">{row.employeeName}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{row.employeeId}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{roleLabels[row.role]}</td>
                    <td className="px-4 py-4">
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-1"
                        style={{ backgroundColor: row.areaColor || "#eef4ee" }}
                      >
                        {row.areaName || row.location || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2 py-1 font-semibold ${row.status === "LIBUR" ? "bg-rose-50 text-rose-700" : row.status === "STANBY" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {row.outletName ||
                        (row.status === "KERJA" && row.role === "BACKUP" ? (
                          <span className="text-amber-700">Belum diatur</span>
                        ) : (
                          "—"
                        ))}
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-4"
                      data-sort-value={row.startMinutes ?? ""}
                    >
                      {row.shift && (
                        <p
                          className={`mb-1 inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${row.shift === "FULL" ? "bg-orange-50 text-orange-700" : row.shift === "S2" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {row.shift === "FULL" ? "[S1-S2]" : `[${row.shift}]`}
                        </p>
                      )}
                      {row.startMinutes !== null && row.endMinutes !== null
                        ? `${timeLabel(row.startMinutes)} – ${timeLabel(row.endMinutes)}${row.endMinutes <= row.startMinutes ? " (+1 hari)" : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-4">{row.notes || "—"}</td>
                    <td className="px-4 py-4">
                      <FormDialog title={`Ubah jadwal · ${displayDate(row.date)}`} trigger="Edit">
                        <ScheduleForm
                          edit={{
                            id: row.id,
                            name: row.employeeName,
                            role: row.role,
                            status: row.status,
                            shift: row.shift || "S1",
                            outletId: row.outletId || "",
                            startTime: timeLabel(row.startMinutes),
                            endTime: timeLabel(row.endMinutes),
                            notes: row.notes || "",
                          }}
                          successRoute={successRoute}
                          outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
                        />
                      </FormDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <div className="flex min-h-[285px] flex-col items-center justify-center px-6 py-12 text-center">
            <span className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-600">
              <UiIcon name="calendar" size={26} />
            </span>
            <h2 className="text-sm font-semibold">Belum ada jadwal kerja</h2>
            <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
              {query.employee
                ? "Tidak ada jadwal untuk karyawan dan bulan yang dipilih."
                : "Buat jadwal untuk menugaskan karyawan sesuai penempatan dan periode kerja."}
            </p>
            <div className="mt-4">{createButton()}</div>
          </div>
        )}
        {valid && rows.length > 0 && (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            {caption}
            {query.from || query.to
              ? ` · ${displayDate(fromDate)} – ${displayDate(toDate)}`
              : ""} · {count} jadwal
            {count > 500
              ? " · tabel menampilkan 500 pertama; ringkasan menghitung semua hasil filter"
              : ""}
          </p>
        )}
      </section>
    </div>
  );
}
