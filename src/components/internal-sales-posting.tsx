"use client";

import { useActionState } from "react";
import { postInternalSalesNovember2026 } from "@/app/internal-sales-posting";
import type { FormState } from "@/lib/form-state";

export function InternalSalesPosting() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    postInternalSalesNovember2026,
    {},
  );
  return (
    <form action={action} className="panel space-y-2 p-4">
      <p className="text-sm">
        Penjualan 13 outlet internal, 1–15 November 2026 · Rp161.691.000
      </p>
      <button className="btn-primary" disabled={pending || Boolean(state.success)}>
        {pending ? "Memposting penjualan…" : "Posting ke akun 4101"}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="text-sm">{state.success}</p>}
    </form>
  );
}
