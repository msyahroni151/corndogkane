"use client";
import { LocalInput } from "@/components/local-input";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { saveOutlet } from "@/app/master-actions";
import { outletDays, type OutletHours } from "@/lib/outlet-settings";
import type { FormState } from "@/lib/form-state";
export function OutletForm({
  areas,
  initial,
  successRoute,
  cancelRoute,
}: {
  areas: { id: string; name: string; active: boolean }[];
  initial?: {
    id: string;
    name: string;
    nameCode?: string | null;
    areaId: string;
    active: boolean;
    closed?: boolean;
    dailyRate: number | null;
    hours: OutletHours | null;
  };
  successRoute: string;
  cancelRoute: string;
}) {
  const [name, setName] = useState(initial?.name || ""),
    [nameCode, setNameCode] = useState(initial?.nameCode || ""),
    [area, setArea] = useState(initial?.areaId || ""),
    [active, setActive] = useState(initial?.closed ? "closed" : String(initial?.active ?? true)),
    [rate, setRate] = useState(initial?.dailyRate?.toString() || "");
  const [hours, setHours] = useState<OutletHours>(
    initial?.hours || outletDays.map(() => ({ open: "", close: "", closed: false })),
  );
  const [state, action, pending] = useActionState<FormState, FormData>(saveOutlet, {});
  const close = useCloseFormDialog(),
    router = useRouter(),
    handled = useRef(false);
  useEffect(() => {
    if (state.success && !handled.current) {
      handled.current = true;
      close?.();
      router.push(successRoute);
    }
  }, [state.success, close, router, successRoute]);
  function change(index: number, patch: Partial<OutletHours[number]>) {
    setHours((old) => old.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  }
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      className="panel p-6"
    >
      {initial && <input name="existingId" type="hidden" value={initial.id} />}
      <input name="dailyRate" type="hidden" value={rate} />
      <input name="operatingHours" type="hidden" value={JSON.stringify(hours)} />
      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Nama outlet *
            <LocalInput
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className="field">
            Kode nama
            <LocalInput
              name="nameCode"
              value={nameCode}
              onChange={(event) => setNameCode(event.target.value.toUpperCase())}
              maxLength={40}
              placeholder="Contoh: ANT"
            />
          </label>
          <label className="field">
            Area outlet *
            <select name="areaId" value={area} onChange={(e) => setArea(e.target.value)} required>
              <option value="">Pilih area…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.active ? "" : " · tidak aktif"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Tarif harian (Rp) *
            <LocalInput
              aria-label="Tarif harian (Rp)"
              inputMode="numeric"
              value={rate.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              onChange={(e) =>
                setRate(e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""))
              }
              required
              maxLength={14}
              placeholder="80.000"
            />
            <span className="text-xs font-normal text-slate-500">
              Dipakai payroll sesuai outlet kerja pada jadwal.
            </span>
          </label>
          <label className="field">
            Status *
            <select name="active" value={active} onChange={(e) => setActive(e.target.value)}>
              <option value="true">AKTIF</option>
              <option value="false">TIDAK AKTIF</option>
              <option value="closed">TUTUP</option>
            </select>
            <span className="text-xs font-normal text-slate-500">
              TUTUP: outlet sudah tidak beroperasi lagi; riwayat tetap tersimpan.
            </span>
          </label>
        </div>
        <section>
          <h3 className="font-bold">Jam Operasional Senin–Minggu</h3>
          <p className="mb-4 mt-1 text-xs text-slate-500">
            Jam tutup yang lebih awal berarti tutup pada hari berikutnya. Centang Tutup untuk hari
            tidak beroperasi.
          </p>
          <div className="space-y-3">
            {outletDays.map((label, i) => (
              <div
                key={label}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-[90px_1fr_1fr_auto]"
              >
                <span className="text-sm font-semibold">{label}</span>
                <label className="flex items-center gap-2 text-xs sm:order-last">
                  <LocalInput
                    type="checkbox"
                    aria-label={`Tutup ${label}`}
                    checked={hours[i].closed}
                    onChange={(e) => change(i, { closed: e.target.checked })}
                  />
                  Tutup
                </label>
                <label className="field text-xs">
                  Jam buka
                  <LocalInput
                    aria-label={`Jam buka ${label}`}
                    type="time"
                    value={hours[i].open}
                    onChange={(e) => change(i, { open: e.target.value })}
                    disabled={hours[i].closed}
                    required={!hours[i].closed}
                  />
                </label>
                <label className="field text-xs">
                  Jam tutup
                  <LocalInput
                    aria-label={`Jam tutup ${label}`}
                    type="time"
                    value={hours[i].close}
                    onChange={(e) => change(i, { close: e.target.value })}
                    disabled={hours[i].closed}
                    required={!hours[i].closed}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="button-secondary"
          disabled={pending}
          onClick={() => {
            close?.();
            router.push(cancelRoute);
          }}
        >
          Batal
        </button>
        <button className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : initial ? "Simpan perubahan" : "Simpan outlet"}
        </button>
      </div>
    </form>
  );
}
