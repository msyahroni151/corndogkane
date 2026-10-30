"use client";
import { NavigationLink } from "@/components/navigation-link";
import { usePathname } from "next/navigation";
import { peopleMenu, payrollMenu, matchesMenu } from "@/lib/navigation";
import { UiIcon } from "@/components/ui-icon";
export function SectionNavigation({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const people = peopleMenu.some((item) => matchesMenu(pathname, item.href));
  const payroll = payrollMenu.some((item) => matchesMenu(pathname, item.href));
  if (!people && !payroll) return null;
  const items = (people ? peopleMenu : payrollMenu).filter((item) =>
    permissions.includes(item.href.slice(1)),
  );
  return (
    <nav
      aria-label={people ? "Submenu Karyawan & SDM" : "Submenu Payroll"}
      className="mb-7 min-w-0 border-b border-[#dbe7df]"
    >
      <div className="flex gap-1 overflow-x-auto pb-px">
        {items.map((item) => (
          <NavigationLink
            key={item.href}
            href={item.href}
            aria-current={matchesMenu(pathname, item.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${matchesMenu(pathname, item.href) ? "border-[#44785a] bg-[#e4f0e7] text-[#244c3a]" : "border-transparent text-slate-500 hover:bg-[#edf4ef] hover:text-[#244c3a]"}`}
          >
            <UiIcon name={item.icon} size={17} />
            <span>{item.name}</span>
          </NavigationLink>
        ))}
      </div>
    </nav>
  );
}
