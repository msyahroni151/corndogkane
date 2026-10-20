import { LocalInput } from "@/components/local-input";
import { AttendanceDateGate } from "@/components/attendance-date-gate";
import { SortableTable } from "@/components/sortable-table";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib, displayDate, parseCivilDate } from "@/lib/placements";
import { timeLabel, isWarehouse } from "@/lib/schedules";
import { attendanceLabels, attendanceSummary } from "@/lib/attendance";
import { attendanceColumns } from "@/lib/attendance-columns";
import { FormDialog } from "@/components/form-dialog";
import { AttendanceForm } from "@/components/attendance-form";
import { AttendanceExport } from "@/components/attendance-export";
import { UiIcon, type IconName } from "@/components/ui-icon";
import type { Prisma } from "@/generated/prisma/client";
type Filters = {
  month?: string;
  from?: string;
  to?: string;
  area?: string;
  group?: string;
  employee?: string;
  tersimpan?: string;
};
export default async function AttendancePage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAccess("absensi");
  const query = await searchParams,
    db = getPrisma();
  const today = todayWib();
  const month = query.month || query.from?.slice(0, 7) || todayWib().slice(0, 7);
  let valid = true,
    start = new Date(0),
    end = new Date(0),
    from = "",
    to = "";
  try {
    if (!/^\d{4}-\d{2}$/.test(month)) throw Error();
    const first = parseCivilDate(month + "-01");
    const last = new Date(first);
    last.setUTCMonth(last.getUTCMonth() + 1);
    last.setUTCDate(0);
    from = query.from || first.toISOString().slice(0, 10);
    to = query.to || last.toISOString().slice(0, 10);
    start = parseCivilDate(from);
    end = parseCivilDate(to);
    if (end < start || end.getTime() - start.getTime() > 365 * 86400000) throw Error();
  } catch {
    valid = false;
  }
  const where: Prisma.ScheduleWhereInput = {
    date: { gte: start, lte: end },
    ...(query.area ? { areaName: query.area } : {}),
    ...(query.employee ? { employeeId: query.employee } : {}),
    ...(query.group === "warehouse"
      ? { role: { in: ["CREW_GUDANG", "LEADER_SHIFT"] } }
      : query.group === "outlet"
        ? { role: { in: ["REGULER", "BACKUP"] } }
        : {}),
  };
  const [rows, count, areas, employees, summaryRows] = await Promise.all([
    valid
      ? db.schedule.findMany({
          where,
          include: { attendance: true },
          orderBy: [{ date: "asc" }, { areaName: "asc" }, { employeeName: "asc" }],
          take: 500,
        })
      : [],
    valid ? db.schedule.count({ where }) : 0,
    db.schedule.findMany({
      where: { areaName: { not: null } },
      select: { areaName: true },
      distinct: ["areaName"],
      orderBy: { areaName: "asc" },
    }),
    db.employee.findMany({
      select: { id: true, employeeCode: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    valid
      ? db.schedule.findMany({
          where,
          select: {
            employeeId: true,
            status: true,
            role: true,
            shift: true,
            startMinutes: true,
            endMinutes: true,
            attendance: {
              select: {
                status: true,
                checkInMinutes: true,
                checkOutMinutes: true,
                checkInNextDay: true,
                checkOutNextDay: true,
              },
            },
          },
        })
      : [],
  ]);
  const present = summaryRows.filter((r) => attendanceSummary(r, r.attendance).paidUnits > 0);
  const actualEnd = (r: (typeof summaryRows)[number]) =>
    r.attendance?.checkOutMinutes == null
      ? null
      : r.attendance.checkOutMinutes + (r.attendance.checkOutNextDay ? 1440 : 0);
  const plannedEnd = (r: (typeof summaryRows)[number]) =>
    r.endMinutes == null
      ? null
      : r.endMinutes + (r.startMinutes != null && r.endMinutes <= r.startMinutes ? 1440 : 0);
  const stats: { label: string; value: number; icon: IconName; tone: string }[] = [
    {
      label: "Total Absen",
      value: present.length,
      icon: "clock",
      tone: "bg-blue-50 text-blue-600",
    },
    {
      label: "Karyawan",
      value: new Set(present.map((r) => r.employeeId)).size,
      icon: "people",
      tone: "bg-cyan-50 text-cyan-600",
    },
    {
      label: "Tepat Waktu",
      value: present.filter(
        (r) => r.startMinutes !== null && attendanceSummary(r, r.attendance).lateMinutes === 0,
      ).length,
      icon: "check",
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Terlambat",
      value: present.filter((r) => attendanceSummary(r, r.attendance).lateMinutes > 0).length,
      icon: "alert",
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Lewat Jam Pulang",
      value: present.filter(
        (r) => actualEnd(r) !== null && plannedEnd(r) !== null && actualEnd(r)! > plannedEnd(r)!,
      ).length,
      icon: "bolt",
      tone: "bg-violet-50 text-violet-600",
    },
    {
      label: "Belum Pulang",
      value: present.filter((r) => r.attendance?.checkOutMinutes === null).length,
      icon: "exit",
      tone: "bg-red-50 text-red-600",
    },
  ];
  const caption = valid
    ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        start,
      )
    : "Periode tidak valid";
  const filter = new URLSearchParams({
    from,
    to,
    month,
    ...(query.area ? { area: query.area } : {}),
    ...(query.employee ? { employee: query.employee } : {}),
    ...(query.group ? { group: query.group } : {}),
    tersimpan: "1",
  });
  const records = rows.map((row) => {
    const a = row.attendance,
      summary = attendanceSummary(row, a);
    const duration =
      a?.checkInMinutes != null && a.checkOutMinutes != null
        ? a.checkOutMinutes +
          (a.checkOutNextDay ? 1440 : 0) -
          a.checkInMinutes -
          (a.checkInNextDay ? 1440 : 0)
        : null;
    const attendanceValidation =
      row.status !== "KERJA"
        ? row.status
        : summary.paidUnits > 0
          ? summary.lateMinutes > 0
            ? "HADIR TERLAMBAT"
            : "HADIR"
          : summary.validation;
    const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" })
      .format(row.date)
      .toUpperCase();
    const presence = a && a.status !== "HADIR" ? attendanceLabels[a.status] : attendanceValidation;
    const validation = summary.validation;
    const data = [
      `${displayDate(row.date)} · ${weekday}`,
      row.employeeName,
      row.areaName || row.location || "—",
      row.status,
      row.outletName || "—",
      timeLabel(row.startMinutes) || "—",
      (timeLabel(row.endMinutes) || "—") +
        (row.startMinutes !== null && row.endMinutes !== null && row.endMinutes <= row.startMinutes
          ? " (+1 hari)"
          : ""),
      a?.checkInMinutes != null
        ? timeLabel(a.checkInMinutes) + (a.checkInNextDay ? " (+1 hari)" : "")
        : "—",
      a?.checkOutMinutes != null
        ? timeLabel(a.checkOutMinutes) + (a.checkOutNextDay ? " (+1 hari)" : "")
        : "—",
      String(summary.lateMinutes),
      "Rp " + summary.lateFine.toLocaleString("id-ID"),
      duration === null
        ? "—"
        : `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
      presence === validation ? presence : `${presence} · Validasi: ${validation}`,
    ];
    return { row, a, summary, data, weekday, presence, validation };
  });
  return (
    <div className="space-y-5">
      {query.tersimpan && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Absensi berhasil disimpan.
        </p>
      )}
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <UiIcon name="calendar" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Riwayat Kehadiran</h2>
            <p className="mt-1 text-xs text-slate-500">
              {caption}
              {valid && (query.from || query.to)
                ? ` · ${displayDate(start)} – ${displayDate(end)}`
                : ""}
            </p>
          </div>
        </div>
        <form className="flex flex-wrap items-end gap-3 text-xs">
          <label className="flex flex-col gap-1.5 text-slate-500">
            Tanggal Mulai
            <LocalInput
              type="date"
              name="from"
              defaultValue={from}
              required
              className="w-[155px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-slate-500">
            Tanggal Selesai
            <LocalInput
              type="date"
              name="to"
              defaultValue={to}
              required
              className="w-[155px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-slate-500">
            Karyawan
            <select
              className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
              name="area"
              defaultValue={query.area || ""}
            >
              <option value="">Semua area</option>
              {areas.map((a) => (
                <option key={a.areaName} value={a.areaName!}>
                  {a.areaName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-slate-500">
            Kelompok
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
              name="group"
              defaultValue={query.group || ""}
            >
              <option value="">Semua kelompok</option>
              <option value="outlet">Outlet & backup</option>
              <option value="warehouse">Gudang</option>
            </select>
          </label>
          <button className="button-primary !px-4 !py-2.5 !text-xs">Terapkan</button>
        </form>
        <AttendanceExport
          headers={attendanceColumns}
          rows={records.map((r) => r.data)}
          filename={`rekap-absensi-${valid ? from + "-" + to : "periode"}.csv`}
        />
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="panel flex items-center gap-3 p-4">
            <span className={`rounded-xl p-2.5 ${s.tone}`}>
              <UiIcon name={s.icon} size={18} />
            </span>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      <section className="panel overflow-hidden">
        {!valid ? (
          <p role="alert" className="p-6 text-sm text-red-700">
            Periksa bulan atau rentang tanggal. Rentang maksimal satu tahun.
          </p>
        ) : (
          <div>
            <SortableTable pinnedControls className="w-full text-left text-xs">
              <thead>
                <tr>
                  {[...attendanceColumns, "Aksi"].map((label) => (
                    <th key={label} className="whitespace-nowrap px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(({ row, a, summary, data, weekday, presence, validation }) => (
                  <tr key={row.id}>
                    {data.map((value, i) => (
                      <td key={attendanceColumns[i]} className="whitespace-nowrap px-4 py-4">
                        {i === 0 ? (
                          <>
                            <p className="font-medium">{displayDate(row.date)}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{weekday}</p>
                          </>
                        ) : i === 1 ? (
                          <span className="font-semibold">{value}</span>
                        ) : i === 2 ? (
                          <span
                            className="rounded-full px-2 py-1"
                            style={{ backgroundColor: row.areaColor || "#eef4ee" }}
                          >
                            {value}
                          </span>
                        ) : i === 12 ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${presence === "HADIR" || presence === "LIBUR" ? "bg-emerald-50 text-emerald-700" : summary.paidUnits === 0 && a ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
                            >
                              {presence}
                            </span>
                            {validation !== presence && (
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] ${validation === "LENGKAP" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                              >
                                Validasi: {validation}
                              </span>
                            )}
                          </div>
                        ) : i === 5 ? (
                          <>
                            <span>{value}</span>
                            {row.shift && (
                              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                {row.shift === "FULL" ? "[S1-S2]" : `[${row.shift}]`}
                              </span>
                            )}
                          </>
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                    <td className="attendance-actions px-4 py-4">
                      {row.status === "KERJA" ? (
                        <AttendanceDateGate
                          date={row.date.toISOString().slice(0, 10)}
                          today={today}
                        >
                          <FormDialog
                            title={`Absensi · ${displayDate(row.date)}`}
                            trigger={a ? "Edit" : "Isi absensi"}
                          >
                            <AttendanceForm
                              warehouse={isWarehouse(row.role)}
                              successRoute={"/absensi?" + filter.toString()}
                              record={{
                                scheduleId: row.id,
                                name: row.employeeName,
                                date: displayDate(row.date),
                                status: a?.status || "HADIR",
                                checkIn: timeLabel(a?.checkInMinutes ?? null),
                                checkOut: timeLabel(a?.checkOutMinutes ?? null),
                                checkInNextDay: a?.checkInNextDay || false,
                                checkOutNextDay:
                                  a?.checkOutMinutes != null
                                    ? a.checkOutNextDay
                                    : row.startMinutes !== null &&
                                      row.endMinutes !== null &&
                                      row.endMinutes <= row.startMinutes,
                                notes: a?.notes || "",
                                version: a?.updatedAt.toISOString() || "",
                              }}
                            />
                          </FormDialog>
                        </AttendanceDateGate>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!records.length && (
                  <tr>
                    <td
                      colSpan={attendanceColumns.length + 1}
                      className="px-6 py-14 text-center text-sm text-slate-400"
                    >
                      Tidak ada data absensi untuk periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableTable>
          </div>
        )}
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          {count} baris jadwal
          {count > 500
            ? " · tabel dan ekspor menampilkan 500 pertama; ringkasan menghitung semua hasil filter"
            : ""}{" "}
          · Geser tabel horizontal untuk melihat semua kolom.
        </div>
      </section>
    </div>
  );
}
