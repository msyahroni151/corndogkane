"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncLegacyOutletBonuses } from "@/app/outlet-bonus-actions";
import { notifySuccess } from "@/components/notification-toasts";
import type { FormState } from "@/lib/form-state";
export function SyncOutletBonuses() {
  const [state, action, pending] = useActionState(syncLegacyOutletBonuses, {} as FormState),
    router = useRouter();
  useEffect(() => {
    if (state.success) {
      notifySuccess(state.success);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action}>
      <button className="button-secondary" disabled={pending}>
        {pending ? "Menyinkronkan…" : "Sinkronkan rekap lama"}
      </button>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
