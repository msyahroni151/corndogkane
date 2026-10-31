"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePlan, updatePlan } from "@/app/production-plan-actions";
import { useCloseFormDialog } from "@/components/form-dialog";
import { notifySuccess } from "@/components/notification-toasts";
export type PlanChoice = { id: string; name: string; unit: string };
export type PlanEdit = {
  id: string;
  version: string;
  itemId: string;
  date: string;
  quantity: string;
  notes: string;
};
export function ProductionPlanForm({
  items,
  today,
  initial,
}: {
  items: PlanChoice[];
  today: string;
  initial?: PlanEdit;
}) {
  const [state, action, pending] = useActionState(savePlan, {}),
    [key, setKey] = useState(""),
    [date, setDate] = useState(initial?.date || today),
    close = useCloseFormDialog(),
    router = useRouter(),
    done = useRef(false);
  useEffect(() => setKey(crypto.randomUUID()), []);
  useEffect(() => {
    if (state.success && !done.current) {
      done.current = true;
      notifySuccess(state.success);
      close?.();
      router.push(
        "/produksi-gudang?" + new URLSearchParams({ tab: "rencana", from: date, to: date }),
      );
    }
  }, [state.success, close, router, date]);
  return (
    <form action={action} className="space-y-4 p-6" aria-busy={pending}>
      <input type="hidden" name="postingKey" value={key} />
      {initial && (
        <>
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="version" value={initial.version} />
        </>
      )}
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Hasil produksi *
          <select name="itemId" required defaultValue={initial?.itemId || ""}>
            <option value="">Pilih hasil gudang…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.unit.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tanggal produksi *
          <input
            type="date"
            name="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="field">
          Target jumlah hasil *
          <input
            type="number"
            name="quantity"
            min="0.001"
            max="1000000000"
            step="0.001"
            required
            defaultValue={initial?.quantity || ""}
          />
        </label>
        <label className="field sm:col-span-2">
          Catatan rencana
          <textarea name="notes" rows={3} maxLength={2000} defaultValue={initial?.notes || ""} />
        </label>
      </fieldset>
      <p className="text-xs text-slate-500">
        Menyimpan rencana tidak mengurangi bahan dan tidak menambah stok hasil. Catat hasil setelah
        produksi benar-benar dilakukan.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button className="button-primary" disabled={pending || !key || !items.length}>
          {pending ? "Menyimpan…" : "Simpan Rencana"}
        </button>
      </div>
    </form>
  );
}
export function ProductionPlanStatus({
  id,
  version,
  status,
}: {
  id: string;
  version: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updatePlan, {});
  useEffect(() => {
    if (state.success) notifySuccess(state.success);
  }, [state.success]);
  return (
    <form
      action={action}
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        const button = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (
          button?.value === "CANCEL" &&
          !window.confirm("Batalkan rencana ini? Riwayat tetap tersimpan dan stok tidak berubah.")
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      {status === "PLANNED" && (
        <button name="intent" value="START" className="button-secondary" disabled={pending}>
          Mulai
        </button>
      )}
      {["PLANNED", "IN_PROGRESS"].includes(status) && (
        <button
          name="intent"
          value="CANCEL"
          className="button-secondary !text-red-700"
          disabled={pending}
        >
          Batalkan
        </button>
      )}
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
