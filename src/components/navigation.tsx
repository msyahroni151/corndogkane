"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { permissionForPath } from "@/lib/permissions";
import { peopleMenu, payrollMenu } from "@/lib/navigation";
import { UiIcon } from "@/components/ui-icon";
import { SidebarLink } from "@/components/sidebar-link";
import {
  financeMenu,
  mainMenu,
  nightOperationsMenu,
  salesMenu,
  relationMenu,
  inventoryMenu,
  settingsMenu,
  employeePortalMenu,
  activeMainMenu,
} from "@/lib/navigation";
export function Navigation({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const query = useSearchParams();
  const previewEmployee =
    pathname.startsWith("/portal-karyawan") && permissions.includes("role")
      ? query.get("employee")
      : null;
  const active = activeMainMenu(pathname);
  const [expanded, setExpanded] = useState(false);
  const allowed = (href: string) => {
    const key = permissionForPath(href);
    return key ? permissions.includes(key) : false;
  };
  const visibleNightOperations = nightOperationsMenu.filter((item) => allowed(item.href));
  const visibleSales = salesMenu.filter((item) => allowed(item.href));
  const visibleMain = mainMenu.flatMap((item) => {
    const group =
      item.href === "/karyawan" ? peopleMenu : item.href === "/payroll" ? payrollMenu : null;
    const destination = group?.find((child) => allowed(child.href));
    return (group ? destination : allowed(item.href))
      ? [{ ...item, href: destination?.href || item.href, activeHref: item.href }]
      : [];
  });
  const groups = [
    { title: "FINANCE & ACOUNTING", items: financeMenu.filter((item) => allowed(item.href)) },
    { title: "RELASI", items: relationMenu.filter((item) => allowed(item.href)) },
    { title: "INVENTORY & PEMBELIAN", items: inventoryMenu.filter((item) => allowed(item.href)) },
    { title: "PORTAL KARYAWAN", items: employeePortalMenu.filter((item) => allowed(item.href)) },
    { title: "SETTING", items: settingsMenu.filter((item) => allowed(item.href)) },
  ];
  return (
    <nav aria-label="Menu utama" className="shrink-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="workspace-navigation"
        onClick={() => setExpanded(!expanded)}
        className="button-secondary mb-3 w-full gap-2 lg:hidden"
      >
        <UiIcon name="menu" />
        {expanded ? "Tutup menu" : "Menu navigasi"}
      </button>
      <div id="workspace-navigation" className={`${expanded ? "block" : "hidden"} lg:block`}>
        {[
          {
            title: "MENU UTAMA",
            items: visibleNightOperations.map((item) => ({ ...item, activeHref: item.href })),
          },
          {
            title: "PENJUALAN & KASIR",
            items: visibleSales.map((item) => ({ ...item, activeHref: item.href })),
          },
          { title: "SDM & OPERASIONAL", items: visibleMain },
          ...groups.map((group) => ({
            ...group,
            items: group.items.map((item) => ({
              ...item,
              href:
                previewEmployee &&
                item.href.startsWith("/portal-karyawan") &&
                item.href !== "/portal-karyawan/persetujuan"
                  ? item.href + "?employee=" + encodeURIComponent(previewEmployee)
                  : item.href,
              activeHref: item.href,
            })),
          })),
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <section key={group.title} className="sidebar-nav-group">
              <p className="nav-caption">{group.title}</p>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    name={item.name}
                    icon={item.icon}
                    active={active === item.activeHref}
                    badge={item.href === "/pos" ? "Baru" : undefined}
                    onNavigate={() => setExpanded(false)}
                  />
                ))}
              </div>
            </section>
          ))}
      </div>
    </nav>
  );
}
