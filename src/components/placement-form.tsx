"use client";
import { LocalInput } from "@/components/local-input";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { savePlacement } from "@/app/placement-actions";
import { roleLabels, type OperationalRole } from "@/lib/placements";
import type { FormState } from "@/lib/form-state";
type Choice = { id: string; name: string };
export function PlacementForm({
  employees,
  areas,
  outlets,
  today,
}: {
  employees: (Choice & { group: "outlet" | "warehouse"; role: OperationalRole })[];
  areas: Choice[];
  outlets: (Choice & { areaId: string })[];
  today: string;
}) {
  const end = new Date(today + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 6);
  const initial = {
    employeeId: "",
    role: "REGULER" as OperationalRole,
    startDate: today,
    endDate: end.toISOString().slice(0, 10),
    areaId: "",
    outletId: "",
    location: "GUDANG",
    notes: "",
  };
  const [draft, setDraft] = useState(initial);
  const selected = employees.find((employee) => employee.id === draft.employeeId);
  const warehouse = selected?.group === "warehouse";
  const router = useRouter();
  const closeDialog = useCloseFormDialog();
  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, form) => {
    const result = await savePlacement(previous, form);
    if (result.success) {
      closeDialog?.();
      setDraft(initial);
      router.push("/penempatan?tersimpan=1");
      router.refresh();
    }
    return result;
  }, {});
  const change = (key: keyof typeof initial, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  return (
    <form
      aria-busy={pending}
      aria-label="Tambah penempatan periode"
      className="panel mt-7 p-6"
      action={action}
      onReset={(event) => event.preventDefault()}
    >
      <h2 className="text-xl font-bold">Tambah penempatan periode</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Isi periode baru untuk perpindahan. Periode sebelumnya tidak ditimpa. Hanya karyawan
        lapangan dan gudang yang aktif tersedia di pilihan.
      </p>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <label className="field">
          Nama karyawan *
          <select
            required
            name="employeeId"
            value={draft.employeeId}
            onChange={(event) => {
              const employee = employees.find((item) => item.id === event.target.value);
              setDraft((old) => ({
                ...old,
                employeeId: event.target.value,
                role: employee?.role || "REGULER",
                startDate:
                  employee?.group === "warehouse" && !warehouse
                    ? today.slice(0, 7) + "-01"
                    : warehouse && employee?.group === "outlet"
                      ? initial.startDate
                      : old.startDate,
                endDate:
                  employee?.group === "warehouse" && !warehouse
                    ? new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0))
                        .toISOString()
                        .slice(0, 10)
                    : warehouse && employee?.group === "outlet"
                      ? initial.endDate
                      : old.endDate,
                areaId: "",
                outletId: "",
              }));
            }}
          >
            <option value="">Pilih karyawan…</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.id}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Periode mulai *
          <LocalInput
            required
            type="date"
            name="startDate"
            value={draft.startDate}
            onChange={(event) => change("startDate", event.target.value)}
          />
        </label>
        <label className="field">
          Periode selesai *
          <LocalInput
            required
            type="date"
            name="endDate"
            value={draft.endDate}
            onChange={(event) => change("endDate", event.target.value)}
          />
        </label>
        <label className="field">
          {warehouse ? "Jabatan gudang" : "Role operasional"} *
          <select
            required
            name="role"
            value={draft.role}
            onChange={(event) =>
              setDraft((old) => ({
                ...old,
                role: event.target.value as OperationalRole,
                outletId: "",
              }))
            }
          >
            {(warehouse
              ? [selected?.role || "CREW_GUDANG"]
              : (["REGULER", "BACKUP"] as OperationalRole[])
            ).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </label>
        {warehouse ? (
          <label className="field">
            Lokasi kerja *
            <LocalInput
              required
              name="location"
              value={draft.location}
              onChange={(event) => change("location", event.target.value)}
              maxLength={100}
            />
          </label>
        ) : (
          <>
            <label className="field">
              Area asal *
              <select
                required
                name="areaId"
                value={draft.areaId}
                onChange={(event) => change("areaId", event.target.value)}
              >
                <option value="">Pilih area…</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-slate-500">
                Area asal tetap sesuai tim/leader, termasuk saat membantu area lain.
              </span>
            </label>
            {draft.role === "REGULER" ? (
              <label className="field">
                Outlet default *
                <select
                  required
                  name="outletId"
                  value={draft.outletId}
                  onChange={(event) => {
                    const outlet = outlets.find((item) => item.id === event.target.value);
                    setDraft((old) => ({
                      ...old,
                      outletId: event.target.value,
                      areaId: old.areaId || outlet?.areaId || "",
                    }));
                  }}
                >
                  <option value="">Pilih outlet…</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                Crew backup mengikuti area asal. Outlet harian akan diisi melalui jadwal, sehingga
                outlet default dikosongkan.
              </p>
            )}
          </>
        )}
      </div>
      <label className="field mt-5">
        Catatan penempatan
        <textarea
          rows={2}
          name="notes"
          value={draft.notes}
          onChange={(event) => change("notes", event.target.value)}
          maxLength={2000}
        />
      </label>
      {!employees.length && (
        <p className="mt-5 text-sm text-amber-800">
          Belum ada karyawan yang memenuhi kriteria. Isi biodata departemen dan jabatan melalui Data
          karyawan terlebih dahulu.
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button disabled={pending || !selected} className="button-primary">
          {pending ? "Menyimpan…" : "Simpan penempatan"}
        </button>
      </div>
    </form>
  );
}
