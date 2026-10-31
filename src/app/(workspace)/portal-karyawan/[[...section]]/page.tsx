import SearchForm from "next/form";
import Link from "next/link";
import Image from "next/image";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { todayWib, displayDate } from "@/lib/placements";
import { rupiah, moneyStatuses } from "@/lib/money";
import { portalTabs, portalStatuses, leaveKinds, clock, portalWindow } from "@/lib/employee-portal";
import { attendanceLabels, attendanceSummary } from "@/lib/attendance";
import { UiIcon, type IconName } from "@/components/ui-icon";
import {
  PortalLoanForm,
  PortalLeaveForm,
  PortalCancel,
  PortalReview,
} from "@/components/portal-forms";
import { PortalCamera } from "@/components/portal-camera";
function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: IconName;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase text-slate-500">{label}</p>
        <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
          <UiIcon name={icon} />
        </span>
      </div>
      <p className="mt-4 break-words text-lg font-bold sm:text-xl">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}
function Table({
  heads,
  rows,
  empty,
}: {
  heads: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {heads.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-4 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="p-8 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs ${status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
    >
      {portalStatuses[status] || status}
    </span>
  );
}
function PhotoLink({ type, id, label }: { type: string; id: string; label: string }) {
  return (
    <a
      href={`/api/portal/photo/${type}/${encodeURIComponent(id)}`}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-emerald-700 underline"
    >
      {label}
    </a>
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ employee?: string; month?: string }>;
}) {
  const user = await requireUser(),
    section = (await params).section || [],
    tab = section[0] || "",
    query = await searchParams;
  if (section.length > 1 || (!portalTabs.some((t) => t.key === tab) && tab !== "persetujuan"))
    notFound();
  const canReview = hasPermission(user, "portal-review"),
    canPreview = hasPermission(user, "role");
  if (tab === "persetujuan" ? !canReview : !hasPermission(user, "portal-karyawan"))
    return <div className="panel p-6">Anda tidak memiliki akses ke bagian ini.</div>;
  const db = getPrisma(),
    today = todayWib();
  const employeeId = canPreview && query.employee ? query.employee : user.employeeId;
  const [choices, employee] = await Promise.all([
    canPreview
      ? db.employee.findMany({
          where: { active: true },
          select: { id: true, fullName: true, employeeCode: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
    employeeId
      ? db.employee.findUnique({
          where: { id: employeeId },
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: true,
            position: true,
            active: true,
          },
        })
      : Promise.resolve(null),
  ]);
  const preview = !!employee && employee.id !== user.employeeId;
  const selectedQuery = preview ? `?employee=${encodeURIComponent(employee.id)}` : "";
  const link = (key: string) => "/portal-karyawan" + (key ? "/" + key : "") + selectedQuery;
  const header = (
    <>
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Corndog Kane - Portal Karyawan
          </p>
          <h2 className="mt-2 text-xl font-bold">
            {employee ? employee.fullName : "Layanan Mandiri Karyawan"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {employee
              ? `${employee.employeeCode || employee.id} - ${employee.department} - ${employee.position}`
              : "Akses informasi pribadi dan pengajuan melalui akun karyawan Anda."}
          </p>
        </div>
        {employee?.active && !preview && tab !== "absensi" && (
          <Link href={link("absensi")} className="button-primary">
            Absen Sekarang
          </Link>
        )}
        {canPreview && (
          <SearchForm
            action=""
            prefetch={false}
            scroll={false}
            className="flex min-w-0 flex-wrap items-end gap-2"
          >
            <label className="field min-w-0">
              <span className="text-xs">Pratinjau data karyawan (admin)</span>
              <select
                name="employee"
                defaultValue={employee?.id || ""}
                className="max-w-full sm:max-w-80"
              >
                <option value="">Akun saya</option>
                {choices.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-secondary">Lihat</button>
          </SearchForm>
        )}
      </div>
      {preview && (
        <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          Mode pratinjau admin: melihat data {employee!.fullName}. Pengajuan dan kamera
          dinonaktifkan; tindakan pribadi hanya melalui akun karyawan yang bersangkutan.
        </p>
      )}
    </>
  );
  if (tab === "persetujuan") {
    const [faces, leaves, captures] = await Promise.all([
      db.portalFace.findMany({
        where: { status: "PENDING" },
        select: {
          employeeId: true,
          employee: { select: { fullName: true } },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      db.portalLeave.findMany({
        where: { status: "PENDING" },
        include: { employee: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      db.portalCapture.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          kind: true,
          capturedAt: true,
          distance: true,
          employee: { select: { fullName: true } },
          schedule: { select: { date: true, outletName: true, location: true } },
        },
        orderBy: { capturedAt: "asc" },
        take: 50,
      }),
    ]);
    return (
      <div className="space-y-5">
        {header}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Pendaftaran wajah"
            value={String(faces.length)}
            note="Menunggu pemeriksaan identitas"
            icon="people"
          />
          <Stat
            label="Bukti absensi"
            value={String(captures.length)}
            note="Periksa wajah dan foto area kerja"
            icon="check"
          />
          <Stat
            label="Cuti & izin"
            value={String(leaves.length)}
            note="Menunggu keputusan admin"
            icon="calendar"
          />
        </div>
        <p className="text-sm text-slate-500">
          Menampilkan maksimal 50 pengajuan terlama per jenis. Pengajuan kasbon diproses oleh
          keuangan{" "}
          {hasPermission(user, "kasbon") ? (
            <Link href="/kasbon" className="font-semibold text-emerald-700 underline">
              melalui menu Kasbon
            </Link>
          ) : (
            "melalui menu Kasbon"
          )}
          .
        </p>
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Pendaftaran Wajah</h2>
          {!faces.length && (
            <p className="panel p-5 text-sm text-slate-500">
              Tidak ada pendaftaran wajah yang menunggu.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {faces.map((f) => (
              <article key={f.employeeId} className="panel space-y-4 p-5">
                <h3 className="font-bold">{f.employee.fullName}</h3>
                <p className="text-xs text-slate-500">
                  Pastikan wajah sesuai identitas karyawan sebelum menyetujui.
                </p>
                <Image
                  unoptimized
                  src={`/api/portal/photo/face/${f.employeeId}`}
                  width={320}
                  height={240}
                  alt={`Pendaftaran wajah ${f.employee.fullName}`}
                  className="max-h-60 rounded-xl object-contain"
                />
                <PortalReview type="FACE" id={f.employeeId} version={f.updatedAt.toISOString()} />
              </article>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Bukti Absensi</h2>
          {!captures.length && (
            <p className="panel p-5 text-sm text-slate-500">
              Tidak ada bukti absensi yang menunggu.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {captures.map((c) => (
              <article key={c.id} className="panel space-y-4 p-5">
                <h3 className="font-bold">
                  {c.employee.fullName} - {c.kind === "IN" ? "Masuk" : "Pulang"}
                </h3>
                <p className="text-sm">
                  {c.schedule.outletName || c.schedule.location || "Lokasi belum diatur"} -{" "}
                  {displayDate(c.schedule.date)}
                </p>
                <p className="text-xs text-slate-500">
                  Waktu server: {c.capturedAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}{" "}
                  WIB
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {["selfie", "cart"].map((type) => (
                    <div key={type}>
                      <Image
                        unoptimized
                        src={`/api/portal/photo/${type}/${c.id}`}
                        width={320}
                        height={240}
                        alt={type === "selfie" ? "Bukti wajah" : "Bukti area kerja"}
                        className="w-full rounded-xl"
                      />
                      <PhotoLink type={type} id={c.id} label="Perbesar" />
                    </div>
                  ))}
                </div>
                <PortalReview type="ATTENDANCE" id={c.id} />
              </article>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Pengajuan Cuti & Izin</h2>
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Persetujuan cuti/libur mengubah jadwal yang sudah ada menjadi LIBUR. Izin/sakit mencatat
            ketidakhadiran. Dampak terhadap gaji mengikuti aturan payroll yang berlaku; kuota cuti
            berbayar belum dikonfigurasi.
          </p>
          {!leaves.length && (
            <p className="panel p-5 text-sm text-slate-500">Tidak ada pengajuan yang menunggu.</p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {leaves.map((l) => (
              <article key={l.id} className="panel space-y-4 p-5">
                <h3 className="font-bold">
                  {l.employee.fullName} - {leaveKinds[l.kind]}
                </h3>
                <p className="text-sm">
                  {displayDate(l.startDate)} - {displayDate(l.endDate)}
                </p>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{l.reason}</p>
                <PortalReview type="LEAVE" id={l.id} />
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }
  if (!employee || !employee.active)
    return (
      <div className="space-y-5">
        {header}
        <section className="panel space-y-3 p-6">
          <h2 className="font-bold">Akun belum terhubung ke karyawan aktif</h2>
          <p className="text-sm text-slate-500">
            Hubungkan akun melalui Role & Akun Login, lalu pilih role Portal Karyawan untuk akun
            layanan pribadi.{" "}
            {canPreview
              ? "Untuk meninjau tampilan, pilih karyawan pada pilihan di atas."
              : "Hubungi admin untuk mengaktifkan akses Anda."}
          </p>
          {canPreview && (
            <Link href="/role" className="button-secondary">
              Buka Role & Akun Login
            </Link>
          )}
        </section>
      </div>
    );
  const month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(query.month || "")
      ? query.month!
      : today.slice(0, 7),
    start = new Date(month + "-01T00:00:00Z"),
    end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const [payrolls, money, schedules, leaves, face, captures, nearby] = await Promise.all([
    db.payroll.findMany({
      where: { employeeId: employee.id, status: "PAID" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        paidAt: true,
        basePay: true,
        backupPay: true,
        standbyPay: true,
        warehouseBonus: true,
        bonusPaid: true,
        lateDeduction: true,
        loanDeduction: true,
        otherDeduction: true,
        settlementDeduction: true,
        netPay: true,
        notes: true,
      },
      orderBy: { endDate: "desc" },
      take: 24,
    }),
    db.moneyEntry.findMany({
      where: { employeeId: employee.id, kind: { in: ["LOAN", "REPAYMENT"] } },
      select: {
        id: true,
        kind: true,
        date: true,
        amount: true,
        notes: true,
        status: true,
        sourceId: true,
        decisionNotes: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.schedule.findMany({
      where: { employeeId: employee.id, date: { gte: start, lt: end } },
      include: { attendance: true },
      orderBy: { date: "asc" },
    }),
    db.portalLeave.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.portalFace.findUnique({
      where: { employeeId: employee.id },
      select: { status: true, decisionNotes: true },
    }),
    db.portalCapture.findMany({
      where: { employeeId: employee.id, schedule: { date: { gte: start, lt: end } } },
      select: {
        id: true,
        scheduleId: true,
        kind: true,
        capturedAt: true,
        status: true,
        decisionNotes: true,
      },
      orderBy: { capturedAt: "desc" },
    }),
    db.schedule.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: new Date(new Date(today + "T00:00:00Z").getTime() - 86400000),
          lte: new Date(new Date(today + "T00:00:00Z").getTime() + 86400000),
        },
      },
      include: {
        attendance: true,
        portalCaptures: {
          where: { status: { in: ["PENDING", "APPROVED"] } },
          select: { kind: true },
        },
      },
      orderBy: { date: "asc" },
    }),
  ]);
  const approvedLoans = money.filter((m) => m.kind === "LOAN" && m.status === "APPROVED"),
    repayments = money.filter((m) => m.kind === "REPAYMENT" && m.status === "APPROVED"),
    outstanding =
      approvedLoans.reduce((sum, l) => sum + l.amount, 0) -
      repayments.reduce((sum, r) => sum + r.amount, 0),
    pending = money.filter((m) => m.kind === "LOAN" && m.status === "PENDING"),
    latest = payrolls[0],
    todaySchedule = nearby.find((s) => s.date.toISOString().slice(0, 10) === today),
    present = schedules.filter(
      (s) => s.attendance && ["HADIR", "SETENGAH_HARI"].includes(s.attendance.status),
    ).length;
  const monthFilter = (
    <SearchForm
      action=""
      prefetch={false}
      scroll={false}
      className="panel flex flex-wrap items-end gap-3 p-4"
    >
      {preview && <input type="hidden" name="employee" value={employee.id} />}
      <label className="field">
        <span className="text-xs">Periode jadwal / absensi</span>
        <input type="month" name="month" defaultValue={month} required />
      </label>
      <button className="button-primary">Terapkan</button>
    </SearchForm>
  );
  const cameraOptions = nearby
    .map((s) => {
      let canIn = false,
        canOut = false;
      try {
        portalWindow(s, "IN");
        canIn = !s.attendance && !s.portalCaptures.some((c) => c.kind === "IN");
      } catch {}
      try {
        portalWindow(s, "OUT");
        canOut =
          s.attendance?.checkInMinutes != null &&
          s.attendance.checkOutMinutes === null &&
          !s.portalCaptures.some((c) => c.kind === "OUT");
      } catch {}
      return {
        id: s.id,
        label:
          displayDate(s.date) +
          " - " +
          (s.outletName || s.location || "Lokasi kerja") +
          " - " +
          clock(s.startMinutes) +
          " - " +
          clock(s.endMinutes),
        canIn,
        canOut,
      };
    })
    .filter((s) => s.canIn || s.canOut);
  const scheduleTable = (
    <Table
      heads={["Tanggal", "Lokasi / Outlet", "Shift", "Jam Bertugas", "Status", "Catatan"]}
      empty="Belum ada jadwal pada periode ini."
      rows={schedules.map((s) => [
        displayDate(s.date),
        s.outletName || s.location || "-",
        s.shift || s.role,
        clock(s.startMinutes) +
          " - " +
          clock(
            s.endMinutes,
            s.endMinutes !== null && s.startMinutes !== null && s.endMinutes <= s.startMinutes,
          ),
        s.status,
        s.notes || "-",
      ])}
    />
  );
  return (
    <div className="space-y-5">
      {header}
      {tab === "" && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Tugas hari ini"
              value={
                todaySchedule
                  ? todaySchedule.status === "LIBUR"
                    ? "Libur"
                    : todaySchedule.status === "STANBY"
                      ? "Standby"
                      : todaySchedule.outletName || todaySchedule.location || "Lokasi kerja"
                  : "Belum ada jadwal"
              }
              note={
                todaySchedule
                  ? todaySchedule.status === "KERJA"
                    ? clock(todaySchedule.startMinutes) + " - " + clock(todaySchedule.endMinutes)
                    : "Status sesuai jadwal hari ini"
                  : "Periksa Jadwal Saya atau hubungi admin"
              }
              icon="location"
            />
            <Stat
              label="Gaji terakhir"
              value={latest ? rupiah(latest.netPay) : "Belum diterbitkan"}
              note={
                latest
                  ? displayDate(latest.startDate) + " - " + displayDate(latest.endDate)
                  : "Slip muncul setelah payroll dibayar"
              }
              icon="coins"
            />
            <Stat
              label="Sisa kasbon"
              value={rupiah(outstanding)}
              note={pending.length + " pengajuan menunggu persetujuan"}
              icon="wallet"
            />
            <Stat
              label="Kehadiran periode ini"
              value={present + " hari"}
              note="Berdasarkan absensi yang sudah dicatat admin"
              icon="check"
            />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel space-y-4 p-5">
              <h2 className="font-bold">Aktivitas Hari Ini</h2>
              <p className="text-sm text-slate-500">
                {displayDate(new Date(today + "T00:00:00Z"))} - WIB
              </p>
              {todaySchedule ? (
                <>
                  <p className="font-semibold">
                    {todaySchedule.status === "KERJA"
                      ? todaySchedule.outletName || todaySchedule.location
                      : todaySchedule.status === "LIBUR"
                        ? "Libur"
                        : "Standby"}
                  </p>
                  <p className="text-sm">
                    {todaySchedule.status === "KERJA" ? (
                      <>
                        {clock(todaySchedule.startMinutes)} - {clock(todaySchedule.endMinutes)} |{" "}
                        {todaySchedule.attendance
                          ? attendanceLabels[todaySchedule.attendance.status]
                          : "Belum ada absensi disetujui"}
                      </>
                    ) : todaySchedule.status === "LIBUR" ? (
                      "Hari libur sesuai jadwal Anda."
                    ) : (
                      "Menunggu penugasan dari admin."
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Belum ada penugasan kerja hari ini. Hari tanpa jadwal belum otomatis menjadi
                  catatan libur karyawan.
                </p>
              )}
              <Link className="button-primary" href={link("absensi")}>
                Buka Absensi Saya
              </Link>
            </section>
            <section className="panel space-y-4 p-5">
              <h2 className="font-bold">Pengajuan Saya</h2>
              <p className="text-sm">
                Kasbon menunggu: <strong>{pending.length}</strong>
              </p>
              <p className="text-sm">
                Cuti / izin menunggu:{" "}
                <strong>{leaves.filter((l) => l.status === "PENDING").length}</strong>
              </p>
              <p className="text-sm">
                Wajah: <strong>{face ? portalStatuses[face.status] : "Belum didaftarkan"}</strong>
              </p>
              <div className="flex flex-wrap gap-3">
                <Link className="button-secondary" href={link("kasbon")}>
                  Ajukan Kasbon
                </Link>
                <Link className="button-secondary" href={link("cuti")}>
                  Ajukan Cuti / Izin
                </Link>
              </div>
            </section>
          </div>
          <h2 className="text-lg font-bold">Jadwal Periode Terpilih</h2>
          {monthFilter}
          {scheduleTable}
        </>
      )}
      {tab === "gaji" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Gaji terakhir"
              value={latest ? rupiah(latest.netPay) : "Belum tersedia"}
              note="Gaji bersih yang sudah dibayar"
              icon="coins"
            />
            <Stat
              label="Periode terakhir"
              value={latest ? displayDate(latest.endDate) : "-"}
              note={latest ? "Mulai " + displayDate(latest.startDate) : "Belum ada payroll dibayar"}
              icon="calendar"
            />
            <Stat
              label="Tanggal pembayaran"
              value={
                latest?.paidAt ? displayDate(new Date(todayWib(latest.paidAt) + "T00:00:00Z")) : "-"
              }
              note="Waktu pembayaran tercatat oleh admin"
              icon="check"
            />
          </div>
          <p className="text-sm text-slate-500">
            Menampilkan 24 slip terbaru yang sudah dibayar. Draft dan payroll dibatalkan tidak
            ditampilkan.
          </p>
          <Table
            heads={["Slip", "Periode", "Gaji Bersih", "Dibayar", "Rincian"]}
            empty="Belum ada slip gaji yang diterbitkan untuk Anda."
            rows={payrolls.map((p) => [
              p.id,
              displayDate(p.startDate) + " - " + displayDate(p.endDate),
              <strong key="net">{rupiah(p.netPay)}</strong>,
              p.paidAt ? displayDate(new Date(todayWib(p.paidAt) + "T00:00:00Z")) : "-",
              <details key="detail" className="min-w-64">
                <summary className="cursor-pointer font-semibold text-emerald-700">
                  Lihat Slip Gaji
                </summary>
                <dl className="mt-3 space-y-2 text-xs">
                  {[
                    ["Gaji pokok", p.basePay],
                    ["Tambahan backup", p.backupPay],
                    ["Standby", p.standbyPay],
                    ["Bonus gudang", p.warehouseBonus],
                    ["Bonus dibayar", p.bonusPaid],
                    ["Potongan terlambat", p.lateDeduction],
                    ["Potongan kasbon", p.loanDeduction],
                    ["Potongan selisih", p.settlementDeduction],
                    ["Potongan lainnya", p.otherDeduction],
                    ["Gaji bersih", p.netPay],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt>{label}</dt>
                      <dd>{rupiah(Number(value))}</dd>
                    </div>
                  ))}
                </dl>
                {p.notes && <p className="mt-3 text-xs">{p.notes}</p>}
              </details>,
            ])}
          />
        </>
      )}
      {tab === "kasbon" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Sisa kasbon"
              value={rupiah(outstanding)}
              note="Kasbon disetujui dikurangi pembayaran disetujui"
              icon="wallet"
            />
            <Stat
              label="Total pembayaran"
              value={rupiah(repayments.reduce((s, r) => s + r.amount, 0))}
              note="Termasuk potongan payroll yang sudah dibayar"
              icon="coins"
            />
            <Stat
              label="Dalam pengajuan"
              value={rupiah(pending.reduce((s, l) => s + l.amount, 0))}
              note={pending.length + " pengajuan menunggu admin"}
              icon="clock"
            />
          </div>
          {!preview && (
            <section className="panel space-y-4 p-5">
              <h2 className="font-bold">Pengajuan Kasbon</h2>
              <PortalLoanForm requestKey={randomUUID()} />
            </section>
          )}
          <h2 className="text-lg font-bold">Rekap Kasbon</h2>
          <Table
            heads={[
              "ID Kasbon",
              "Tanggal",
              "Nominal",
              "Terbayar",
              "Sisa",
              "Status",
              "Catatan Admin",
            ]}
            empty="Belum ada kasbon."
            rows={money
              .filter((m) => m.kind === "LOAN")
              .slice(0, 100)
              .map((l) => {
                const paid = repayments
                  .filter((r) => r.sourceId === l.id)
                  .reduce((sum, r) => sum + r.amount, 0);
                return [
                  l.id,
                  displayDate(l.date),
                  rupiah(l.amount),
                  rupiah(paid),
                  l.status === "APPROVED" ? rupiah(l.amount - paid) : "-",
                  <Badge key="status" status={l.status} />,
                  l.decisionNotes || l.notes,
                ];
              })}
          />
          <h2 className="text-lg font-bold">Riwayat Pembayaran / Potongan</h2>
          <Table
            heads={["Tanggal", "Referensi Kasbon", "Nominal", "Status", "Keterangan"]}
            empty="Belum ada pembayaran kasbon."
            rows={money
              .filter((m) => m.kind === "REPAYMENT")
              .slice(0, 100)
              .map((r) => [
                displayDate(r.date),
                r.sourceId || "-",
                rupiah(r.amount),
                moneyStatuses[r.status],
                r.notes,
              ])}
          />
        </>
      )}
      {tab === "jadwal" && (
        <>
          {monthFilter}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Jadwal kerja"
              value={schedules.filter((s) => s.status === "KERJA").length + " hari"}
              note="Pada periode terpilih"
              icon="calendar"
            />
            <Stat
              label="Libur"
              value={schedules.filter((s) => s.status === "LIBUR").length + " hari"}
              note="Libur yang tercatat di jadwal"
              icon="clock"
            />
            <Stat
              label="Standby"
              value={schedules.filter((s) => s.status === "STANBY").length + " hari"}
              note="Menunggu penugasan"
              icon="location"
            />
          </div>
          {scheduleTable}
        </>
      )}
      {tab === "absensi" && (
        <>
          {!preview && <PortalCamera faceStatus={face?.status || null} schedules={cameraOptions} />}{" "}
          {face?.decisionNotes && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Catatan pendaftaran wajah: {face.decisionNotes}
            </p>
          )}
          {monthFilter}
          <h2 className="text-lg font-bold">Rekap Absensi</h2>
          <Table
            heads={[
              "Tanggal",
              "Outlet / Lokasi",
              "Jadwal",
              "Masuk",
              "Pulang",
              "Terlambat",
              "Status",
            ]}
            empty="Belum ada jadwal atau absensi pada periode ini."
            rows={schedules.map((s) => {
              const summary = attendanceSummary(s, s.attendance);
              return [
                displayDate(s.date),
                s.outletName || s.location || "-",
                clock(s.startMinutes) + " - " + clock(s.endMinutes),
                clock(s.attendance?.checkInMinutes, s.attendance?.checkInNextDay),
                clock(s.attendance?.checkOutMinutes, s.attendance?.checkOutNextDay),
                s.attendance?.checkInMinutes != null ? summary.lateMinutes + " menit" : "-",
                s.status !== "KERJA"
                  ? s.status
                  : s.attendance
                    ? attendanceLabels[s.attendance.status]
                    : "Belum disetujui / diisi",
              ];
            })}
          />
          <h2 className="text-lg font-bold">Bukti Absensi Kamera</h2>
          <Table
            heads={["Waktu Server (WIB)", "Jenis", "Status", "Bukti", "Catatan Admin"]}
            empty="Belum ada bukti absensi kamera pada periode ini."
            rows={captures.map((c) => [
              c.capturedAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
              c.kind === "IN" ? "Masuk" : "Pulang",
              <Badge key="status" status={c.status} />,
              <div key="photos" className="flex gap-3">
                <PhotoLink type="selfie" id={c.id} label="Wajah" />
                <PhotoLink type="cart" id={c.id} label="Area kerja" />
              </div>,
              c.decisionNotes || "-",
            ])}
          />
        </>
      )}
      {tab === "cuti" && (
        <>
          {!preview && (
            <section className="panel space-y-4 p-5">
              <h2 className="font-bold">Ajukan Cuti / Izin / Libur</h2>
              <PortalLeaveForm requestKey={randomUUID()} today={today} />
            </section>
          )}
          <Table
            heads={["Jenis", "Tanggal", "Alasan", "Status", "Catatan Admin", "Aksi"]}
            empty="Belum ada pengajuan cuti atau izin."
            rows={leaves.map((l) => [
              leaveKinds[l.kind],
              displayDate(l.startDate) + " - " + displayDate(l.endDate),
              l.reason,
              <Badge key="status" status={l.status} />,
              l.decisionNotes || "-",
              !preview && l.status === "PENDING" ? <PortalCancel key="cancel" id={l.id} /> : "-",
            ])}
          />
        </>
      )}
    </div>
  );
}
