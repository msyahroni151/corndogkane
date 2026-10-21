"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useState, type MouseEvent, type FocusEvent } from "react";
import { UiIcon, type IconName } from "@/components/ui-icon";
import { useSidebar } from "@/components/sidebar-shell";

type Position = { left: number; top: number; maxWidth: number };
export function SidebarLink({
  href,
  name,
  icon,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  name: string;
  icon: IconName;
  active: boolean;
  badge?: string;
  onNavigate: () => void;
}) {
  const { collapsed } = useSidebar();
  const id = useId();
  const [position, setPosition] = useState<Position | null>(null);
  const visible = collapsed && position !== null;
  function show(event: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>) {
    if (!collapsed || !window.matchMedia("(min-width: 1024px)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({
      left: bounds.right + 12,
      top: bounds.top + bounds.height / 2,
      maxWidth: Math.max(120, window.innerWidth - bounds.right - 28),
    });
  }
  useEffect(() => {
    if (!visible) return;
    const hide = () => setPosition(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", key);
    };
  }, [visible]);
  return (
    <>
      <Link
        href={href}
        prefetch={false}
        aria-label={name}
        aria-current={active ? "page" : undefined}
        aria-describedby={visible ? id : undefined}
        className={`nav-item relative ${active ? "nav-active" : ""}`}
        onMouseEnter={show}
        onMouseLeave={() => setPosition(null)}
        onFocus={show}
        onBlur={() => setPosition(null)}
        onClick={() => {
          setPosition(null);
          onNavigate();
        }}
      >
        <UiIcon name={icon} />
        <span className="sidebar-menu-label">{name}</span>
        {badge && (
          <small className="sidebar-menu-badge ml-auto rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] text-white">
            {badge}
          </small>
        )}
      </Link>
      {visible &&
        createPortal(
          <div id={id} role="tooltip" className="sidebar-menu-tooltip" style={position}>
            {name}
          </div>,
          document.body,
        )}
    </>
  );
}
