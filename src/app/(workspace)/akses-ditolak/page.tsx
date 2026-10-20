import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
export default async function AccessDenied() {
  const user = await requireUser();
  const home = homeFor(user.permissions);
  return (
    <section className="panel p-8">
      <h2 className="text-lg font-bold">Akses menu belum diberikan</h2>
      <p className="mt-3 text-sm text-slate-500">
        Hubungi pengelola untuk menyesuaikan hak akses role Anda.
      </p>
      {home !== "/akses-ditolak" && (
        <Link href={home} className="button-primary mt-5">
          Kembali ke menu saya
        </Link>
      )}
    </section>
  );
}
