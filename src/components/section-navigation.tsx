"use client";
import { NavigationLink } from "@/components/navigation-link";
import { usePathname } from "next/navigation";
import { peopleMenu, payrollMenu, matchesMenu } from "@/lib/navigation";
import { UiIcon } from "@/components/ui-icon";
export function SectionNavigation({
  permissions,
  dateLabel,
}: {
  permissions: string[];
  dateLabel: string;
}) {
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
      className="mb-7 flex min-w-0 items-center justify-between gap-3 border-b border-[#dbe7df]"
    >
      <div className="flex min-w-0 gap-1 overflow-x-auto pb-px">
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
      {pathname === "/dashboard" && (
        <div className="mb-1 ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[#e4ebe6] bg-white px-3.5 py-2.5 text-xs text-slate-500">
          <UiIcon name="calendar" size={16} />
          <span>{dateLabel}</span>
        </div>
      )}
    </nav>
  );
}
