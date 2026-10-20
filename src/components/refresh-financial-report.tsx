"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export function RefreshFinancialReport() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="button-secondary"
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? "Memperbarui…" : "↻ Perbarui laporan"}
    </button>
  );
}
