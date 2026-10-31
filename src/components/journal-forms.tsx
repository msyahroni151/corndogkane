"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { LocalInput } from "@/components/local-input";
import { createJournalTransaction, saveFinancialAccount } from "@/app/journal-actions";
import { accountKinds } from "@/lib/general-journal";
import type { FormState } from "@/lib/form-state";
function useSave(save: typeof createJournalTransaction, route: string) {
  const router = useRouter(),
    close = useCloseFormDialog(),
    handled = useRef(false);
  const [state, action, pending] = useActionState<FormState, FormData>(save, {});
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.push(route);
    }
  }, [state.success, pending, close, router, route]);
  return { state, action, pending };
}
export function FinancialAccountForm({
  record,
}: {
  record?: {
    id: string;
    code: string;
    name: string;
    kind: string;
    active: boolean;
    version: string;
    normalBalance?: string;
    subGroup?: string;
    notes?: string;
    sourceType?: string;
  };
}) {
  const { state, action, pending } = useSave(
    saveFinancialAccount,
    "/finance/laporan-akuntansi?tab=coa&tersimpan=1",
  );
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="p-6"
      aria-label="Form Master Akun"
    >
      <fieldset disabled={pending} className="space-y-4">
        {record && (
          <>
            <input type="hidden" name="id" value={record.id} />
            <input type="hidden" name="version" value={record.version} />
          </>
        )}
        <label className="field">
          Kode akun *
          <input
            name="code"
            required
            maxLength={30}
            defaultValue={record?.code}
            readOnly={record?.sourceType === "SYSTEM"}
            placeholder="Kode akun"
          />
        </label>
        <label className="field">
          Nama akun *
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={record?.name}
            placeholder="Nama akun"
          />
        </label>
        <label className="field">
          Jenis akun *
          <select name="kind" defaultValue={record?.kind || "ASET"}>
            {Object.entries(accountKinds).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Saldo normal *
          <select name="normalBalance" defaultValue={record?.normalBalance || "DEBIT"}>
            <option value="DEBIT">DEBIT</option>
            <option value="CREDIT">CREDIT</option>
            <option value="BOTH">DEBIT / CREDIT</option>
          </select>
        </label>
        <label className="field">
          Subkelompok
          <input name="subGroup" maxLength={120} defaultValue={record?.subGroup || "Lainnya"} />
        </label>
        <label className="field">
          Catatan
          <textarea name="notes" maxLength={2000} defaultValue={record?.notes} />
        </label>
        <label className="field">
          Status *
          <select name="active" defaultValue={String(record?.active ?? true)}>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </label>
        <p className="text-xs text-slate-500">
          Akun nonaktif tetap tersimpan dalam riwayat jurnal.
        </p>
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button className="button-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan akun"}
        </button>
      </div>
    </form>
  );
}
export function JournalForm({
  accounts,
  today,
}: {
  accounts: { id: string; code: string; name: string }[];
  today: string;
}) {
  const [date, setDate] = useState(today);
  const { state, action, pending } = useSave(
    createJournalTransaction,
    `/open-transaction?from=${date}&to=${date}&tersimpan=1`,
  );
  const [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [side, setSide] = useState("CREDIT"),
    [amount, setAmount] = useState(""),
    [notes, setNotes] = useState(""),
    [postingKey, setPostingKey] = useState("");
  useEffect(() => setPostingKey(crypto.randomUUID()), []);
  const close = useCloseFormDialog();
  const opposite = side === "CREDIT" ? "DEBIT" : "CREDIT";
  const ready =
    source && target && source !== target && Number(amount) > 0 && notes.trim() && postingKey;
  const choices = (exclude: string) =>
    accounts
      .filter((a) => a.id !== exclude)
      .map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} · {a.name}
        </option>
      ));
  const buttons = (value: string, change: (v: string) => void) => (
    <div className="flex gap-1.5">
      {["DEBIT", "CREDIT"].map((v) => (
        <button
          type="button"
          key={v}
          aria-pressed={value === v}
          className={`button-secondary !px-3 !text-xs ${value === v ? "!border-emerald-600 !bg-emerald-50 !text-emerald-800" : "!text-slate-400"}`}
          onClick={() => change(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="p-6"
      aria-label="Catat Transfer Antar Akun"
    >
      <fieldset disabled={pending} className="space-y-5">
        <input type="hidden" name="postingKey" value={postingKey} />
        <input type="hidden" name="sourceSide" value={side} />
        <input type="hidden" name="targetSide" value={opposite} />
        <label className="field">
          Tanggal transaksi *
          <LocalInput
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <div>
          <label className="field" htmlFor="journal-source">
            Akun Asal *
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              id="journal-source"
              name="sourceAccountId"
              className="min-w-0 flex-1"
              required
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Pilih akun…</option>
              {choices(target)}
            </select>
            {buttons(side, setSide)}
          </div>
        </div>
        <div>
          <label className="field" htmlFor="journal-target">
            Akun Tujuan *
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              id="journal-target"
              name="targetAccountId"
              className="min-w-0 flex-1"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Pilih akun…</option>
              {choices(source)}
            </select>
            {buttons(opposite, (v) => setSide(v === "DEBIT" ? "CREDIT" : "DEBIT"))}
          </div>
        </div>
        <label className="field">
          Nominal (Rp) *
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            min="1"
            max="1000000000"
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="field">
          Keterangan *
          <input
            name="notes"
            required
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: setor tunai, transfer ke bank…"
          />
        </label>
        {!accounts.length && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Master Akun masih kosong. Tambahkan akun terlebih dahulu.
          </p>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          className="button-secondary flex-1"
          onClick={close}
          disabled={pending}
        >
          Batal
        </button>
        <button className="button-primary flex-1" disabled={pending || !ready}>
          {pending ? "Menyimpan…" : "Lanjutkan Transaksi"}
        </button>
      </div>
    </form>
  );
}
