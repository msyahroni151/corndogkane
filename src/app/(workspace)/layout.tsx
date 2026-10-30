import { SidebarShell, SidebarToggle } from "@/components/sidebar-shell";
import "@/components/sidebar.css";
import { DemoNotice } from "@/components/demo-notice";
import { BrandLogo } from "@/components/brand-logo";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/auth-actions";
import { SessionExpiry } from "@/components/session-expiry";
import { SectionNavigation } from "@/components/section-navigation";
import { WorkspaceHeading } from "@/components/workspace-heading";
import { Navigation } from "@/components/navigation";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const portalOnly = user.permissions.length === 1 && user.permissions[0] === "portal-karyawan";
  return (
    <SidebarShell>
      <SessionExpiry expiresAt={user.expiresAt} />
      <aside
        id="workspace-sidebar"
        className="border-b border-[#e5ece8] bg-white px-5 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r lg:py-7"
      >
        <div className="sidebar-brand mb-5 flex shrink-0 items-center gap-3 px-2 lg:mb-9">
          <BrandLogo size={46} />
          <div className="sidebar-brand-copy">
            <p className="text-[13px] font-extrabold tracking-wide">CORNDOG KANE</p>
            <p className="mt-1 text-[11px] text-slate-400">Back Office</p>
          </div>
        </div>
        <div className="sidebar-menu-scroll min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
          <Navigation permissions={user.permissions} />
        </div>
        <div className="sidebar-footer hidden shrink-0 pt-5 lg:block">
          <div className="rounded-2xl bg-[#eff6f1] p-4">
            <span className="mb-2 block h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-xs font-semibold text-[#335c48]">
              {portalOnly ? "Portal pribadi karyawan" : "Ruang kerja administrasi"}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              {portalOnly
                ? "Informasi dan pengajuan pribadi dalam satu tempat."
                : "Tim, penempatan, dan operasional dalam satu tempat."}
            </p>
          </div>
          <p className="mt-5 px-2 text-[10px] text-slate-400">Corndog Kane · Back Office</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#e5ece8] bg-white px-5 py-4 lg:px-8">
          <SidebarToggle />
          <WorkspaceHeading userName={user.name} />
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {process.env.HRIS_DEMO_MODE === "1"
                ? "Demo"
                : process.env.HRIS_LOCAL_MODE === "1" || process.env.NODE_ENV === "development"
                  ? "Lokal"
                  : "Online"}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f0e9] text-xs font-bold text-[#335c48]">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold">{user.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{user.roleName}</p>
              </div>
            </div>
            <form action={logout}>
              <button className="button-secondary">Keluar</button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-5 sm:p-7 lg:p-8">
          <DemoNotice />
          <SectionNavigation permissions={user.permissions} />
          {children}
        </main>
      </div>
    </SidebarShell>
  );
}
