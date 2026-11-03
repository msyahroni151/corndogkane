"use client";
import { useActionState, useEffect } from "react";
import { deleteRecipe } from "@/app/recipe-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
export function DeleteRecipeForm({
  id,
  name,
  version,
  production,
}: {
  id: string;
  name: string;
  version: string;
  production: boolean;
}) {
  const [state, action, pending] = useActionState(deleteRecipe, {}),
    close = useCloseFormDialog();
  useEffect(() => {
    if (state.success) {
      notifySuccess(state.success);
      close?.();
    }
  }, [state.success, close]);
  return (
    <form action={action} aria-busy={pending} className="space-y-4 p-6">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="scope" value={production ? "production" : "sale"} />
      <p>
        Hapus komposisi resep <strong>{name}</strong>?
      </p>
      <p className="text-sm text-slate-500">
        Barang, bahan, stok, dan riwayat transaksi tetap tersimpan. Status resep akan menjadi Belum
        diatur dan bisa diisi kembali melalui Atur Resep.
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="button-secondary"
          disabled={pending}
          onClick={() => close?.()}
        >
          Batal
        </button>
        <button className="button-primary !bg-red-600" disabled={pending}>
          {pending ? "Menghapus…" : "Hapus Resep"}
        </button>
      </div>
    </form>
  );
}
