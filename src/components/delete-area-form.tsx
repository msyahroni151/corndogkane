"use client";
import { useActionState, useEffect } from "react";
import { deleteArea } from "@/app/master-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
export function DeleteAreaForm({
  id,
  name,
  version,
}: {
  id: string;
  name: string;
  version: string;
}) {
  const [state, action, pending] = useActionState(deleteArea, {}),
    close = useCloseFormDialog();
  useEffect(() => {
    if (state.success) {
      notifySuccess(state.success);
      close?.();
    }
  }, [state.success, close]);
  return (
    <form action={action} className="space-y-4 p-6" aria-busy={pending}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <p>
        Hapus area <strong>{name}</strong>?
      </p>
      <p className="text-xs text-slate-500">
        Area yang masih digunakan oleh outlet atau penempatan tidak dapat dihapus.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="button-secondary"
          onClick={() => close?.()}
          disabled={pending}
        >
          Batal
        </button>
        <button className="button-primary !bg-red-600" disabled={pending}>
          {pending ? "Menghapus…" : "Hapus Area"}
        </button>
      </div>
    </form>
  );
}
