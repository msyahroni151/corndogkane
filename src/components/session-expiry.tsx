"use client";
import { useEffect } from "react";
export function SessionExpiry({ expiresAt }: { expiresAt: string }) {
  useEffect(() => {
    const remaining = () => new Date(expiresAt).getTime() - Date.now();
    const check = () => {
      if (remaining() <= 0) window.location.replace("/login");
    };
    const timer = window.setTimeout(check, Math.max(0, remaining()));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [expiresAt]);
  return null;
}
