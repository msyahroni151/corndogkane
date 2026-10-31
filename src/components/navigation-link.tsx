"use client";
import Link from "next/link";
import { useState, type ComponentProps } from "react";
type Props = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string };
/** Prepare the full destination only after hover, focus or touch intent. */
export function NavigationLink({
  href,
  onMouseEnter,
  onFocus,
  onTouchStart,
  onPointerDown,
  ...props
}: Props) {
  const [preparedHref, setPreparedHref] = useState<string | null>(null);
  function prepare() {
    if (href.startsWith("/") && props["aria-current"] !== "page") setPreparedHref(href);
  }
  return (
    <Link
      {...props}
      href={href}
      prefetch={preparedHref === href}
      onMouseEnter={(e) => {
        prepare();
        onMouseEnter?.(e);
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
