"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
export function BusinessDashboardRefresh() {
  const router = useRouter(),
    [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="button-secondary"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? "Memuat..." : "Muat ulang"}
    </button>
  );
}
