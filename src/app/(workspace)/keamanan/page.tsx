import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { MfaForm } from "@/components/mfa-form";
import { SecurityRetentionForm } from "@/components/security-retention-form";
import { acknowledgeSecurityAlert } from "@/app/security-actions";
const date = (value: Date | null) =>
  value ? value.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";
export default async function SecurityPage() {
  const user = await requireUser(),
    owner = user.roleSystemKey === "OWNER",
    db = getPrisma();
  const [alerts, backups, setting] = owner
    ? await Promise.all([
        db.securityAlert.findMany({
          where: { acknowledgedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
        db.securityBackupRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
        db.securitySetting.findUnique({ where: { id: "default" } }),
      ])
    : [[], [], null];
  // eslint-disable-next-line react-hooks/purity -- Dynamic Server Component captures the request time after authenticated reads.
  const now = Date.now();
  const cutoff = new Date(now - (setting?.photoRetentionDays || 180) * 86400000);
  const reviewCount = owner
    ? await db.portalCapture.count({ where: { capturedAt: { lt: cutoff } } })
    : 0;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Keamanan akun</h1>
      <section className="panel space-y-4 p-5">
        <h2 className="font-semibold">Verifikasi dua langkah</h2>
        <p>
          {user.mfaEnabled
            ? "Aktif. Login memerlukan password dan kode authenticator atau kode pemulihan."
            : "Belum aktif. Tambahkan authenticator untuk melindungi akun Anda."}
        </p>
        {!user.mfaEnabled && <MfaForm enroll />}
        <p className="text-xs text-slate-500">
          Simpan kode pemulihan terpisah dari perangkat authenticator. Jangan membagikan akun atau
          kode verifikasi.
        </p>
      </section>
      {owner && (
        <>
          <section className="panel space-y-4 p-5">
            <h2 className="font-semibold">Peringatan keamanan · {alerts.length}</h2>
            {!alerts.length && (
              <p className="text-slate-500">Tidak ada peringatan yang belum ditinjau.</p>
            )}
            {alerts.map((alert) => (
              <article
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {alert.title}{" "}
                    <span
                      className={alert.severity === "CRITICAL" ? "text-red-700" : "text-amber-700"}
                    >
                      ·{" "}
                      {alert.severity === "CRITICAL"
                        ? "Penting"
                        : alert.severity === "WARNING"
                          ? "Perlu diperiksa"
                          : "Informasi"}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{alert.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {date(alert.updatedAt)} · {alert.occurrences} kejadian
                  </p>
                </div>
                <form action={acknowledgeSecurityAlert}>
                  <input type="hidden" name="id" value={alert.id} />
                  <button className="button-secondary">Sudah ditinjau</button>
                </form>
              </article>
            ))}
          </section>
          <section className="panel space-y-4 p-5">
            <h2 className="font-semibold">Backup dan uji pemulihan</h2>
            <p className="text-sm text-slate-500">
              Backup terenkripsi dijadwalkan setiap hari pukul 02.15 WIB pada komputer pengelola.
              Jika komputer mati, tugas berjalan saat komputer aktif kembali. Salinan disimpan
              terpisah dari server online.
            </p>
            {!backups.length ? (
              <p className="text-amber-700">Belum ada hasil backup terjadwal yang tercatat.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {["Database", "Status", "Waktu", "Uji pemulihan"].map((t) => (
                        <th className="p-3" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.id} className="border-t border-slate-100">
                        <td className="p-3">{b.target === "online" ? "Online" : "Lokal"}</td>
                        <td className="p-3">
                          {b.status === "SUCCESS"
                            ? "Berhasil"
                            : b.status === "FAILED"
                              ? "Gagal"
                              : "Berjalan"}
                        </td>
                        <td className="p-3">{date(b.createdAt)}</td>
                        <td className="p-3">{date(b.restoredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {backups[0] && now - backups[0].createdAt.getTime() > 36 * 3600000 && (
              <p className="text-red-700">
                Backup terakhir lebih dari 36 jam. Periksa komputer dan tugas backup.
              </p>
            )}
          </section>
          <section className="panel space-y-4 p-5">
            <h2 className="font-semibold">Penyimpanan foto absensi</h2>
            <p className="text-sm">
              {reviewCount} bukti absensi melewati batas peninjauan. Data wajah dan foto baru
              disimpan terenkripsi; tidak ada penghapusan otomatis.
            </p>
            <SecurityRetentionForm days={setting?.photoRetentionDays || 180} />
          </section>
        </>
      )}
    </div>
  );
}
