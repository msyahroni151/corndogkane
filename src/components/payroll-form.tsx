"use client";
import { LocalInput } from "@/components/local-input";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { createPayroll, decidePayroll } from "@/app/payroll-actions";
import { rupiah } from "@/lib/money";
import type { FormState } from "@/lib/form-state";
export function PayrollForm({
  employees = [],
  loans = [],
  settlements = [],
  today,
  id,
}: {
  employees?: { id: string; name: string }[];
  loans?: { id: string; employeeId: string; left: number }[];
  settlements?: { id: string; employeeId: string; left: number; label: string }[];
  today: string;
  id?: string;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    id ? decidePayroll : createPayroll,
    {},
  );
  const router = useRouter(),
    close = useCloseFormDialog(),
    handled = useRef(false);
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.push("/payroll?tersimpan=1");
    }
  }, [state.success, pending, close, router]);
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      aria-busy={pending}
      className="panel p-6"
    >
      {id ? (
        <>
          <input type="hidden" name="id" value={id} />
          <p className="mb-4 font-semibold">{id}</p>
          <label className="field">
            Keputusan
            <select name="decision">
              <option value="PAID">Catat sudah dibayar</option>
              <option value="CANCELLED">Batalkan draft</option>
            </select>
          </label>
          <p className="mt-4 text-sm text-slate-500">
            Gunakan setelah pembayaran benar-benar dilakukan. Catatan yang sudah dibayar menjadi
            arsip; potongan kasbon dan pengambilan bonus otomatis tercatat satu kali. Tombol ini
            tidak mentransfer uang.
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field sm:col-span-2">
              Karyawan *
              <select
                name="employeeId"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Pilih karyawan…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Periode mulai *
              <LocalInput
                type="date"
                name="startDate"
                defaultValue={today.slice(0, 8) + "01"}
                required
              />
            </label>
            <label className="field">
              Periode akhir *<LocalInput type="date" name="endDate" defaultValue={today} required />
            </label>
            <label className="field">
              Tarif cadangan jadwal lama / office (Rp)
              <input
                name="dailyRate"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                defaultValue="0"
                required
              />
            </label>
            <label className="field">
              Tambahan backup per hari kerja (Rp)
              <input
                name="backupRate"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                defaultValue="30000"
                required
              />
            </label>
            <label className="field">
              Bonus disetujui yang dibayarkan (Rp)
              <input
                name="bonusPaid"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                defaultValue="0"
                required
              />
            </label>
            <label className="field">
              Denda telat dipotong sekarang (Rp)
              <input
                name="lateDeduction"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                defaultValue="0"
                required
              />
            </label>
            <label className="field">
              Potongan lain (Rp)
              <input
                name="otherDeduction"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                defaultValue="0"
                required
              />
            </label>
            <label className="field sm:col-span-2">
              Omzet CIJERAH per tanggal (jika ada)
              <textarea name="sales" rows={3} placeholder="12/10/2026=800000" maxLength={3000} />
            </label>
            <label className="field sm:col-span-2">
              Catatan / alasan penundaan potongan
              <textarea name="notes" rows={3} maxLength={2000} />
            </label>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Tarif outlet mengikuti tarif tersimpan pada jadwal tiap tanggal; kolom tarif cadangan
            hanya dipakai jika jadwal belum memiliki tarif outlet. Gudang: Rp80.000/shift, Rp40.000
            setengah hari, full shift Rp160.000. Bonus sendiri dihitung dari kehadiran nyata dan
            shift yang selesai. Backup standby Rp50.000 mulai 2 Oktober 2026. Isi potongan 0 untuk
            ditunda.
          </p>
          <fieldset key={employeeId} className="mt-6 space-y-3">
            <legend className="mb-3 font-semibold">Kasbon yang dipotong sekarang</legend>
            {loans
              .filter((l) => l.employeeId === employeeId && l.left > 0)
              .map((l) => (
                <label className="field" key={l.id}>
                  {l.id} · sisa {rupiah(l.left)}
                  <input
                    type="number"
                    name={`loan:${l.id}`}
                    min="0"
                    max={l.left}
                    step="1"
                    defaultValue="0"
                    required
                  />
                </label>
              ))}
            <p className="text-xs text-slate-500">
              Sisa kasbon tetap tersedia pada periode berikutnya. Nominal diperiksa lagi saat
              pembayaran dicatat.
            </p>
          </fieldset>
          <fieldset key={`settlements-${employeeId}`} className="mt-6 space-y-3">
            <legend className="mb-3 font-semibold">Selisih setoran yang dipotong sekarang</legend>
            {settlements
              .filter((s) => s.employeeId === employeeId && s.left > 0)
              .map((s) => (
                <label className="field" key={s.id}>
                  {s.label} · sisa {rupiah(s.left)}
                  <input
                    type="number"
                    name={`settle:${s.id}`}
                    min="0"
                    max={s.left}
                    step="1"
                    defaultValue="0"
                    required
                  />
                </label>
              ))}
            <p className="text-xs text-slate-500">
              Hanya kekurangan setoran disetujui sampai akhir periode yang dapat dipotong. Isi 0
              untuk ditunda, atau isi sebagian untuk dicicil. Saldo baru berkurang setelah payroll
              dicatat dibayar.
            </p>
          </fieldset>
        </>
      )}
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button disabled={pending} className="button-primary">
          {pending ? "Menyimpan…" : id ? "Simpan keputusan" : "Hitung & simpan draft"}
        </button>
      </div>
    </form>
  );
}
