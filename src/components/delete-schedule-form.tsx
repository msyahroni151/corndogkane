"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteSchedule } from "@/app/schedule-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
export function DeleteScheduleForm({
  id,
  version,
  name,
  date,
}: {
  id: string;
  version: string;
  name: string;
  date: string;
}) {
  const [state, action, pending] = useActionState(deleteSchedule, {}),
    close = useCloseFormDialog(),
    router = useRouter();
  useEffect(() => {
    if (state.success) {
      notifySuccess(state.success);
      close?.();
      router.refresh();
    }
  }, [state.success, close, router]);
  return (
    <form action={action} aria-busy={pending} className="space-y-4 p-6">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <p>
        Hapus jadwal <strong>{name}</strong> tanggal <strong>{date}</strong>?
      </p>
      <p className="text-sm text-slate-500">
        Jadwal yang sudah memiliki absensi, bukti absensi portal, transaksi penjualan, atau payroll
        dibayar tidak dapat dihapus. Riwayat penempatan tetap tersimpan.
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          className="button-secondary"
          onClick={() => close?.()}
        >
          Batal
        </button>
        <button disabled={pending} className="button-primary !bg-red-600">
          {pending ? "Menghapus…" : "Hapus Jadwal"}
        </button>
      </div>
    </form>
  );
}
