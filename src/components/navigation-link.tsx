"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentProps } from "react";
type Props = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string };
/** Prepare the full destination only after hover, focus or touch intent. */
export function NavigationLink({
  href,
  onMouseEnter,
  onMouseLeave,
  onBlur,
  onNavigate,
  onFocus,
  onTouchStart,
  onPointerDown,
  ...props
}: Props) {
  const pathname = usePathname();
  const [prepared, setPrepared] = useState<{ href: string; from: string } | null>(null);
  function prepare() {
    if (href.startsWith("/") && props["aria-current"] !== "page")
      setPrepared({ href, from: pathname });
  }
  return (
    <Link
      {...props}
      href={href}
      prefetch={
        prepared?.href === href && prepared.from === pathname && props["aria-current"] !== "page"
      }
      onMouseEnter={(e) => {
        prepare();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setPrepared(null);
        onMouseLeave?.(e);
      }}
      onBlur={(e) => {
        setPrepared(null);
        onBlur?.(e);
      }}
      onNavigate={(e) => {
        setPrepared(null);
        onNavigate?.(e);
      }}
      onFocus={(e) => {
        prepare();
        onFocus?.(e);
      }}
      onPointerDown={(e) => {
        prepare();
        onPointerDown?.(e);
      }}
      onTouchStart={(e) => {
        prepare();
        onTouchStart?.(e);
      }}
    />
  );
}
