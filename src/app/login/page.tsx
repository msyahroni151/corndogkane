import { homeFor } from "@/lib/permissions";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, localSetupAllowed } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { AuthForm } from "@/components/auth-form";
import { AuthScreen } from "@/components/auth-screen";
async function Content() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.permissions));
  const needsSetup = (await getPrisma().user.count()) === 0 && (await localSetupAllowed());
  return (
    <AuthScreen
      title="Selamat datang"
      description="Masuk untuk mengelola Back Office Corndog Kane."
    >
      <AuthForm />
      {needsSetup && (
        <Link className="mt-6 block text-center text-sm font-semibold text-[#3b6051]" href="/setup">
          Pertama kali? Buat akun administrator →
        </Link>
      )}
      <p className="mt-8 text-xs leading-5 text-slate-500">
        Login tetap tersimpan saat halaman dimuat ulang. Sesi berakhir saat keluar atau berganti
        hari (WIB).
      </p>
    </AuthScreen>
  );
}
export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8">Menyiapkan halaman masuk…</p>}>
      <Content />
    </Suspense>
  );
}
