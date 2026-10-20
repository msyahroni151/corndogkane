import { DemoNotice } from "@/components/demo-notice";
import { BrandLogo } from "@/components/brand-logo";
export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-[#294b3c] p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-4">
          <BrandLogo size={80} />
          <span className="text-lg font-bold tracking-wide">CORNDOG KANE</span>
        </div>
        <div>
          <p className="mb-5 text-sm text-emerald-200">HRIS & PAYROLL</p>
          <h1 className="max-w-lg text-5xl font-semibold leading-tight">
            Administrasi tim dalam satu tempat.
          </h1>
          <p className="mt-7 max-w-md leading-7 text-emerald-100/80">
            Kelola biodata karyawan, lalu lanjutkan ke jadwal, absensi, dan payroll secara bertahap.
          </p>
        </div>
        <p className="text-sm text-emerald-100/60">
          Corndog Kane · {process.env.HRIS_DEMO_MODE === "1" ? "Demo aplikasi" : "HRIS & Payroll"}
        </p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <BrandLogo size={96} />
          </div>
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">{description}</p>
          <DemoNotice />
          {children}
        </div>
      </section>
    </main>
  );
}
