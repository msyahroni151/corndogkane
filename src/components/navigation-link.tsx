"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ComponentProps } from "react";
type Props = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string };
/** Prefetch hanya menu yang dituju, bukan seluruh menu sekaligus. */
export function NavigationLink({
  href,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onTouchStart,
  ...props
}: Props) {
  const router = useRouter(),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    requested = useRef(0);
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function prepare(delay = 0) {
    if (
      Date.now() - requested.current < 10_000 ||
      props["aria-current"] === "page" ||
      !href.startsWith("/")
    )
      return;
    cancel();
    timer.current = setTimeout(() => {
      requested.current = Date.now();
      router.prefetch(href);
    }, delay);
  }
  useEffect(() => {
    requested.current = 0;
    return cancel;
  }, [href]);
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        prepare();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        cancel();
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        prepare(0);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        cancel();
        onBlur?.(e);
      }}
      onTouchStart={(e) => {
        prepare(0);
        onTouchStart?.(e);
      }}
    />
  );
}
