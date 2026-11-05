import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { pendingMfa, setupSecret, totp } from "@/lib/mfa";
import { openPrivate } from "@/lib/private-data";
import { MfaForm } from "@/components/mfa-form";
import { finishMfaEnrollment } from "@/app/mfa-actions";
export default async function MfaPage() {
  const c = await pendingMfa();
  if (!c) redirect("/login");
  const codes =
    c.verifiedAt && c.recoveryCipher
      ? (JSON.parse(openPrivate(c.recoveryCipher, "mfa-recovery").toString("utf8")) as string[])
      : null;
  const secret = !codes && c.setupCipher ? setupSecret(c.setupCipher) : null;
  const qr = secret
    ? await QRCode.toDataURL(totp(secret, c.user.email).toString(), { width: 240, margin: 2 })
    : null;
  return (
    <main className="mx-auto max-w-xl space-y-5 p-6 sm:py-12">
      <section className="panel space-y-5 p-6">
        <h1 className="text-xl font-bold">
          {codes
            ? "Simpan kode pemulihan"
            : secret
              ? "Aktifkan verifikasi dua langkah"
              : "Verifikasi keamanan"}
        </h1>
        {codes ? (
          <>
            <p>
              Simpan kode berikut di tempat aman. Setiap kode hanya dapat digunakan satu kali jika
              authenticator tidak dapat diakses. Kode tidak akan ditampilkan lagi setelah Anda
              melanjutkan.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4 font-mono text-xs">
              {codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <form action={finishMfaEnrollment}>
              <button className="button-primary">Sudah disimpan, lanjutkan</button>
            </form>
          </>
        ) : (
          <>
            <p>
              {secret
                ? "Pindai QR menggunakan aplikasi authenticator, kemudian masukkan kode 6 digit untuk mengonfirmasi. Akun belum dapat mengakses data sebelum verifikasi selesai."
                : "Masukkan kode dari aplikasi authenticator atau gunakan satu kode pemulihan."}
            </p>
            {qr && (
              <Image
                src={qr}
                width={240}
                height={240}
                alt="QR penyiapan authenticator"
                unoptimized
              />
            )}
            {secret && (
              <details>
                <summary>Masukkan kunci secara manual</summary>
                <p className="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono">{secret}</p>
              </details>
            )}
            <MfaForm />
            <p className="text-xs text-slate-500">
              Jangan bagikan QR, kunci, atau kode kepada orang lain. Verifikasi berlaku 10 menit.
            </p>
          </>
        )}
        <Link href="/login" className="text-sm underline">
          Kembali ke login
        </Link>
      </section>
    </main>
  );
}
