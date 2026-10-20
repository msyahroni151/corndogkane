import { SortableTable } from "@/components/sortable-table";
import { APP_TIME_ZONE } from "@/lib/local-date";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib, employeeGroup } from "@/lib/placements";
import { UiIcon, type IconName } from "@/components/ui-icon";
async function Content() {
  await requireAccess("dashboard");
  const db = getPrisma();
  const today = new Date(todayWib() + "T00:00:00Z");
  const [total, active, departments, outlets, areas, placements, recent, employees] =
    await Promise.all([
      db.employee.count(),
      db.employee.count({ where: { active: true } }),
      db.employee.groupBy({ by: ["department"], _count: true, orderBy: { department: "asc" } }),
      db.outlet.count({ where: { active: true, area: { active: true } } }),
      db.area.count({ where: { active: true } }),
      db.placement.findMany({
        where: { startDate: { lte: today }, endDate: { gte: today }, employee: { active: true } },
        select: { employeeId: true },
      }),
      db.employee.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          department: true,
          activityStatus: true,
        },
      }),
      db.employee.findMany({
        where: { active: true },
        select: { id: true, department: true, position: true, active: true },
      }),
    ]);
  const eligible = employees.filter((e) => employeeGroup(e) !== null);
  const assigned = new Set(placements.map((p) => p.employeeId));
  const covered = eligible.filter((e) => assigned.has(e.id)).length;
  const coverage = eligible.length ? Math.round((covered / eligible.length) * 100) : 0;
  const activePercent = total ? Math.round((active / total) * 100) : 0;
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
  const maxDepartment = Math.max(1, ...departments.map((d) => d._count));
  const cards: { label: string; value: number; detail: string; icon: IconName }[] = [
    { label: "Total karyawan", value: total, detail: "Seluruh biodata terdaftar", icon: "people" },
    {
      label: "Karyawan aktif",
      value: active,
      detail: `${total - active} karyawan tidak aktif`,
      icon: "check",
    },
    {
      label: "Outlet aktif",
      value: outlets,
      detail: `Tersebar di ${areas} area aktif`,
      icon: "location",
    },
    {
      label: "Penempatan hari ini",
      value: covered,
      detail: `Dari ${eligible.length} karyawan lapangan & gudang`,
      icon: "placement",
    },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-[#e4ebe6] bg-white px-3.5 py-2.5 text-xs text-slate-500">
          <UiIcon name="calendar" size={16} />
          {dateLabel}
        </div>
      </div>
      <div className="dashboard-columns">
        <div className="min-w-0">
          <section aria-label="Ringkasan HRIS" className="metric-grid">
            {cards.map((card, i) => (
              <article key={card.label} className={`panel metric-card metric-card-${i} p-5`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">{card.label}</p>
                  <span className={`metric-icon metric-icon-${i}`}>
                    <UiIcon name={card.icon} size={19} />
                  </span>
                </div>
                <p className="mt-3 text-[34px] font-bold leading-none tracking-tight">
                  {card.value}
                </p>
                <p className="mt-4 text-[11px] text-slate-400">{card.detail}</p>
              </article>
            ))}
          </section>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <section className="panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold">Komposisi departemen</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Jumlah karyawan di setiap departemen
                  </p>
                </div>
                <span className="badge">{departments.length} departemen</span>
              </div>
              {departments.length ? (
                <div className="mt-7 space-y-5">
                  {departments.map((department, i) => (
                    <div key={department.department}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-600">{department.department}</span>
                        <span className="font-bold">{department._count}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-[#f0f4f1]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(department._count / maxDepartment) * 100}%`,
                            backgroundColor: ["#3b7557", "#71a583", "#a2c4a3", "#c2d7b5"][i % 4],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-chart">
                  <UiIcon name="people" size={32} />
                  <p>Komposisi tim akan terlihat setelah biodata ditambahkan.</p>
                  <Link href="/karyawan/baru" className="button-secondary">
                    Tambah karyawan
                  </Link>
                </div>
              )}
            </section>
            <section className="panel p-6">
              <h2 className="text-sm font-bold">Status karyawan</h2>
              <p className="mt-1 text-xs text-slate-400">Proporsi karyawan aktif dalam tim</p>
              <div className="my-7 flex justify-center">
                <div
                  role="img"
                  aria-label={`${active} aktif dari ${total} karyawan, ${activePercent} persen`}
                  className="flex h-40 w-40 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(#3b7557 ${activePercent}%, #edf2ed 0)` }}
                >
                  <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-3xl font-bold">{activePercent}%</span>
                    <span className="mt-1 text-[11px] text-slate-400">Karyawan aktif</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3b7557]" />
                  Aktif <strong className="float-right text-[#233d32]">{active}</strong>
                </div>
                <div className="text-xs text-slate-500">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-200" />
                  Tidak aktif{" "}
                  <strong className="float-right text-[#233d32]">{total - active}</strong>
                </div>
              </div>
            </section>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-sm font-bold">Karyawan terbaru</h2>
                  <p className="mt-1 text-xs text-slate-400">Biodata yang terakhir ditambahkan</p>
                </div>
                <Link
                  href="/karyawan"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#3b7557]"
                >
                  Lihat semua <UiIcon name="arrow" size={15} />
                </Link>
              </div>
              {recent.length ? (
                <div className="overflow-x-auto">
                  <SortableTable className="w-full text-left text-xs">
                    <thead>
                      <tr>
                        {["Karyawan", "Departemen", "Status"].map((t) => (
                          <th key={t} className="px-5 py-3">
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((e) => (
                        <tr key={e.id}>
                          <td className="px-5 py-4" data-sort-value={e.employeeCode || e.fullName}>
                            <Link
                              href={`/karyawan/${encodeURIComponent(e.id)}`}
                              className="flex items-center gap-3"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef4ef] text-[10px] font-semibold text-[#3b7557]">
                                {e.fullName.slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <p className="font-semibold">{e.employeeCode || e.fullName}</p>
                                <p className="mt-1 text-[10px] text-slate-400">{e.id}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-slate-500">{e.department}</td>
                          <td className="px-5 py-4">
                            <span
                              className={e.activityStatus === "AKTIF" ? "badge" : "text-slate-400"}
                            >
                              {e.activityStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </SortableTable>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-400">
                  Belum ada biodata karyawan. Mulai dengan menambahkan tim Anda.
                </div>
              )}
            </section>
            <div className="space-y-5">
              <section className="panel p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Kesiapan penempatan</h2>
                  <UiIcon name="placement" size={18} />
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <p className="text-3xl font-bold">{coverage}%</p>
                  <p className="text-xs text-slate-400">
                    {covered} / {eligible.length} karyawan
                  </p>
                </div>
                <div className="mt-4 h-2 rounded-full bg-[#edf2ed]">
                  <div
                    className="h-full rounded-full bg-[#71a583]"
                    style={{ width: `${coverage}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Karyawan lapangan dan gudang yang memiliki penempatan berlaku hari ini.
                </p>
                <Link
                  href="/penempatan"
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#3b7557]"
                >
                  Kelola penempatan <UiIcon name="arrow" size={15} />
                </Link>
              </section>
              <section className="rounded-2xl bg-[#eaf2e9] p-5">
                <p className="text-xs font-bold text-[#335c48]">Langkah selanjutnya</p>
                <p className="mt-2 text-xs leading-5 text-[#5d7967]">
                  Lengkapi biodata, atur area & outlet, lalu buat penempatan sesuai periode.
                </p>
                <Link
                  href="/master-area"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#335c48]"
                >
                  Buka master data <UiIcon name="arrow" size={15} />
                </Link>
              </section>
            </div>
          </div>
        </div>
        <aside className="dashboard-rail">
          <section className="panel p-5">
            <h2 className="text-sm font-bold">Akses cepat</h2>
            <p className="mt-1 text-xs text-slate-400">Mulai administrasi harian</p>
            <div className="quick-grid">
              {[
                { href: "/karyawan/baru", label: "Tambah karyawan", icon: "people" },
                { href: "/penempatan", label: "Atur penempatan", icon: "placement" },
                { href: "/master-area", label: "Master Area", icon: "location" },
                { href: "/master-outlet", label: "Master Outlet", icon: "building" },
                { href: "/karyawan", label: "Data karyawan", icon: "dashboard" },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="quick-action">
                  <span>
                    <UiIcon name={action.icon as IconName} />
                  </span>
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="text-sm font-bold">Daftar tim terbaru</h2>
            <p className="mt-1 text-xs text-slate-400">Karyawan yang baru didaftarkan</p>
            <div className="mt-4 divide-y divide-slate-100">
              {recent.length ? (
                recent.slice(0, 4).map((employee) => (
                  <Link
                    key={employee.id}
                    href={`/karyawan/${encodeURIComponent(employee.id)}`}
                    className="flex items-start gap-3 py-3"
                  >
                    <span className="rail-avatar">
                      <UiIcon name="people" size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">
                        {employee.employeeCode || employee.fullName}
                      </p>
                      <p className="mt-1 break-words text-[10px] text-slate-400">
                        {employee.department}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="py-4 text-xs leading-5 text-slate-400">
                  Belum ada karyawan terdaftar.
                </p>
              )}
            </div>
          </section>
          <section className="rail-tip">
            <UiIcon name="calendar" size={22} />
            <h2 className="mt-3 text-sm font-bold">Penempatan sesuai periode</h2>
            <p className="mt-2 text-xs leading-5">
              Simpan periode baru ketika lokasi kerja berubah. Riwayat sebelumnya tetap tersimpan.
            </p>
            <Link
              href="/penempatan"
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold"
            >
              Lihat penempatan <UiIcon name="arrow" size={15} />
            </Link>
          </section>
        </aside>
      </div>
      <p className="mt-6 text-[11px] leading-5 text-slate-400">
        Ringkasan berasal dari database website. Data spreadsheet belum diimpor; modul absensi dan
        payroll masih dalam pengembangan.
      </p>
    </>
  );
}
export default function Dashboard() {
  return <Content />;
}
