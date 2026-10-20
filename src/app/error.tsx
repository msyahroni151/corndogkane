"use client";
export default function ApplicationError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-[65vh] items-center justify-center p-6">
      <section className="panel w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl text-amber-700">
          !
        </div>
        <h1 className="text-xl font-bold">Halaman belum dapat dimuat</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Terjadi gangguan saat memuat halaman. Silakan coba lagi. Jika berulang, pastikan database
          lokal sudah aktif melalui Mulai-Database.cmd.
        </p>
        <button type="button" onClick={retry} className="button-primary mt-6">
          Coba lagi
        </button>
        <p className="mt-4 text-xs text-slate-400">
          Periksa hasil penyimpanan sebelum mengirim ulang formulir.
        </p>
      </section>
    </main>
  );
}
