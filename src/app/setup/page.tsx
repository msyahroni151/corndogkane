import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { localSetupAllowed } from "@/lib/auth";
import { AuthScreen } from "@/components/auth-screen";
import { AuthForm } from "@/components/auth-form";
async function Content() {
  if (!(await localSetupAllowed())) notFound();
  if (await getPrisma().user.count()) redirect("/login");
  return (
    <AuthScreen
      title="Buat akun administrator"
      description="Penyiapan satu kali untuk website lokal. Email ini menjadi identitas login aplikasi; belum terhubung ke login Google."
    >
      <AuthForm setup />
    </AuthScreen>
  );
}
export default function SetupPage() {
  return (
    <Suspense fallback={<p className="p-8">Menyiapkan akun…</p>}>
      <Content />
    </Suspense>
  );
}
