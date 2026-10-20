"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authNoticeCookie, authNoticeMessages } from "@/lib/auth-notice";

const SUCCESS_EVENT = "hris:success";
export function notifySuccess(message: string) {
  window.dispatchEvent(new CustomEvent(SUCCESS_EVENT, { detail: message }));
}

export function NotificationToasts() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  useEffect(() => {
    function receive(event: Event) {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message === "string" && message.trim())
        setNotice({ message: message.slice(0, 300) });
    }
    window.addEventListener(SUCCESS_EVENT, receive);
    return () => window.removeEventListener(SUCCESS_EVENT, receive);
  }, []);
  useEffect(() => {
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${authNoticeCookie}=`));
    if (!cookie) return;
    document.cookie = `${authNoticeCookie}=; Max-Age=0; Path=/; SameSite=Lax`;
    const kind = cookie.slice(authNoticeCookie.length + 1);
    if (kind === "signed-in" || kind === "signed-out") {
      // Dispatch after the listener is installed, including on a full page load.
      queueMicrotask(() => notifySuccess(authNoticeMessages[kind]));
    }
  }, [pathname]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex w-[calc(100%-2.5rem)] max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-lg"
      data-notification="success"
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-semibold text-emerald-700"
      >
        ✓
      </span>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 pt-1 text-sm font-medium text-slate-700"
      >
        {notice.message}
      </p>
      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => setNotice(null)}
        className="shrink-0 rounded px-1 text-xl leading-7 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
      >
        ×
      </button>
    </div>
  );
}
