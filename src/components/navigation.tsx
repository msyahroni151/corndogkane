"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { permissionForPath } from "@/lib/permissions";
import { peopleMenu, payrollMenu } from "@/lib/navigation";
import { UiIcon } from "@/components/ui-icon";
import {
  financeMenu,
  mainMenu,
  nightOperationsMenu,
  salesMenu,
  relationMenu,
  settingsMenu,
  activeMainMenu,
} from "@/lib/navigation";
export function Navigation({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
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
        {visibleNightOperations.length > 0 && (
          <section className="mb-7">
            <p className="nav-caption">ADMIN OPERASIONAL MALAM</p>
            <div className="space-y-1.5">
              {visibleNightOperations.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setExpanded(false)}
                  aria-current={active === item.href ? "page" : undefined}
                  className={`nav-item relative ${active === item.href ? "nav-active" : ""}`}
                >
                  <UiIcon name={item.icon} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {visibleSales.length > 0 && (
          <section className="mb-7">
            <p className="nav-caption">PENJUALAN &amp; KASIR</p>
            <div className="space-y-1.5">
              {visibleSales.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setExpanded(false)}
                  aria-current={active === item.href ? "page" : undefined}
                  className={`nav-item relative ${active === item.href ? "nav-active" : ""}`}
                >
                  <UiIcon name={item.icon} />
                  <span>{item.name}</span>
                  {item.href === "/pos" && (
                    <small className="ml-auto rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] text-white">
                      Baru
                    </small>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
        <p className="nav-caption">SDM &amp; OPERASIONAL</p>
        <div className="space-y-1.5">
          {visibleMain.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setExpanded(false)}
              aria-current={active === item.activeHref ? "page" : undefined}
              className={`nav-item relative ${active === item.activeHref ? "nav-active" : ""}`}
            >
              <UiIcon name={item.icon} />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <section key={group.title}>
              <p className="nav-caption mt-9">{group.title}</p>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setExpanded(false)}
                    aria-current={active === item.href ? "page" : undefined}
                    className={`nav-item relative ${active === item.href ? "nav-active" : ""}`}
                  >
                    <UiIcon name={item.icon} />
                    <span>{item.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </div>
    </nav>
  );
}
