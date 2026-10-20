"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCloseFormDialog } from "@/components/form-dialog";
import { LocalInput } from "@/components/local-input";
import { createOperationalExpense, payOperationalExpense } from "@/app/operational-expense-actions";
import { isPaymentAccount, type PaymentMethod } from "@/lib/operational-expenses";
import type { FormState } from "@/lib/form-state";
import "./operational-expenses.css";
export type ExpenseAccountChoice = {
  id: string;
  code: string;
  name: string;
  kind: string;
  active: boolean;
};
function useExpenseAction(save: typeof createOperationalExpense, date: string) {
  const router = useRouter(),
    close = useCloseFormDialog(),
    handled = useRef(false);
  const [state, action, pending] = useActionState<FormState, FormData>(save, {});
  useEffect(() => {
    if (state.success && !pending && !handled.current) {
      handled.current = true;
      close?.();
      router.push(`/finance/pengeluaran-operasional?from=${date}&to=${date}&tersimpan=1`);
      router.refresh();
    }
  }, [state.success, pending, close, router, date]);
  return { state, action, pending, close };
}
function PaymentFields({
  accounts,
  method,
  setMethod,
  account,
  setAccount,
}: {
  accounts: ExpenseAccountChoice[];
  method: PaymentMethod;
  setMethod: (v: PaymentMethod) => void;
  account: string;
  setAccount: (v: string) => void;
}) {
  const available = accounts.filter((a) => isPaymentAccount(a, method));
  return (
    <>
      <div>
        <p className="expense-label">Dibayar dari</p>
        <div className="expense-buttons">
          {[
            ["CASH", "Kas Tunai"],
            ["BANK", "Transfer / Bank"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className="expense-choice"
              aria-pressed={method === value}
              onClick={() => {
                setMethod(value as PaymentMethod);
                setAccount("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="paymentMethod" value={method} />
      <label className="field">
        Akun pembayaran *
        <select
          name="paymentAccountId"
          required
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">Pilih akun {method === "CASH" ? "kas" : "bank"}…</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </select>
      </label>
      {!available.length && (
        <p className="expense-hint">
          Belum ada akun {method === "CASH" ? "kas" : "bank"} aktif yang sesuai pada COA.
        </p>
      )}
    </>
  );
}
export function OperationalExpenseForm({
  accounts,
  paymentAccounts,
  purposes,
  today,
}: {
  accounts: ExpenseAccountChoice[];
  paymentAccounts: ExpenseAccountChoice[];
  purposes: string[];
  today: string;
}) {
  const [date, setDate] = useState(today),
    [paidAt, setPaidAt] = useState(today),
    [method, setMethod] = useState<PaymentMethod>("CASH"),
    [paymentAccount, setPaymentAccount] = useState(""),
    [status, setStatus] = useState("PAID"),
    [purpose, setPurpose] = useState(""),
    [amount, setAmount] = useState(""),
    [expenseAccount, setExpenseAccount] = useState(""),
    [postingKey, setPostingKey] = useState("");
  const { state, action, pending, close } = useExpenseAction(createOperationalExpense, date),
    listId = useId();
  useEffect(() => setPostingKey(crypto.randomUUID()), []);
  const ready =
    expenseAccount &&
    purpose.trim() &&
    Number(amount) > 0 &&
    postingKey &&
    (status === "UNPAID" || paymentAccount);
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      aria-label="Catat Pengeluaran Operasional"
      className="expense-form"
    >
      <fieldset disabled={pending} className="space-y-4">
        <input type="hidden" name="postingKey" value={postingKey} />
        <input type="hidden" name="status" value={status} />
        <p className="expense-group">
          ▱ &nbsp; Grup: <strong>Beban Operasional</strong> (otomatis) — pilih sub-akun tujuan di
          bawah.
        </p>
        <label className="field">
          Tanggal pengeluaran *
          <LocalInput
            type="date"
            name="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="field">
          Akun Beban (Debit) *
          <select
            name="expenseAccountId"
            required
            value={expenseAccount}
            onChange={(e) => setExpenseAccount(e.target.value)}
          >
            <option value="">Pilih akun beban…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Untuk apa? *
          <input
            name="purpose"
            list={listId}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={180}
            required
            placeholder="Pilih atau ketik (mis. Sabun cuci piring)…"
          />
          <datalist id={listId}>
            {purposes.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
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
        {status === "PAID" ? (
          <PaymentFields
            accounts={paymentAccounts}
            method={method}
            setMethod={setMethod}
            account={paymentAccount}
            setAccount={setPaymentAccount}
          />
        ) : (
          <>
            <div>
              <p className="expense-label">Dibayar dari</p>
              <div className="expense-buttons">
                {[
                  ["CASH", "Kas Tunai"],
                  ["BANK", "Transfer / Bank"],
                ].map(([v, label]) => (
                  <button
                    type="button"
                    key={v}
                    className="expense-choice"
                    aria-pressed={method === v}
                    onClick={() => {
                      setMethod(v as PaymentMethod);
                      setPaymentAccount("");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <input type="hidden" name="paymentMethod" value={method} />
          </>
        )}
        <div>
          <p className="expense-label">Sudah dibayar?</p>
          <div className="expense-buttons expense-payment-status">
            {[
              ["PAID", "Sudah Bayar"],
              ["UNPAID", "Belum Bayar"],
            ].map(([v, label]) => (
              <button
                type="button"
                key={v}
                className="expense-choice"
                aria-pressed={status === v}
                onClick={() => setStatus(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {status === "PAID" ? (
          <label className="field">
            Tanggal pembayaran *
            <LocalInput
              type="date"
              name="paidAt"
              required
              value={paidAt}
              min={date || undefined}
              max={today}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </label>
        ) : (
          <p className="expense-hint">
            Disimpan sebagai tagihan belum bayar. Jurnal dibuat saat pembayaran dicatat.
          </p>
        )}
        <label className="field">
          Catatan (opsional)
          <textarea name="notes" maxLength={2000} rows={3} placeholder="Catatan tambahan…" />
        </label>
        {!accounts.length && (
          <p className="expense-hint">
            Belum ada akun Beban Operasional aktif. Periksa COA terlebih dahulu.
          </p>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="expense-error">
          {state.error}
        </p>
      )}
      <footer className="expense-form-footer">
        <button type="button" className="button-secondary" onClick={close} disabled={pending}>
          Batal
        </button>
        <button className="button-primary" disabled={pending || !ready}>
          {pending ? "Menyimpan…" : "Lanjutkan"}
        </button>
      </footer>
    </form>
  );
}
export function OperationalExpensePaymentForm({
  record,
  accounts,
  today,
}: {
  record: {
    id: string;
    version: string;
    date: string;
    purpose: string;
    amountLabel: string;
    method: PaymentMethod;
  };
  accounts: ExpenseAccountChoice[];
  today: string;
}) {
  const [method, setMethod] = useState<PaymentMethod>(record.method),
    [account, setAccount] = useState("");
  const { state, action, pending, close } = useExpenseAction(payOperationalExpense, record.date);
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="expense-form"
      aria-label="Catat Pembayaran Pengeluaran"
    >
      <fieldset disabled={pending} className="space-y-4">
        <input type="hidden" name="id" value={record.id} />
        <input type="hidden" name="version" value={record.version} />
        <p className="font-semibold">{record.purpose}</p>
        <p className="text-lg font-bold text-emerald-800">{record.amountLabel}</p>
        <PaymentFields
          accounts={accounts}
          method={method}
          setMethod={setMethod}
          account={account}
          setAccount={setAccount}
        />
        <label className="field">
          Tanggal pembayaran *
          <LocalInput
            type="date"
            name="paidAt"
            defaultValue={today}
            min={record.date}
            max={today}
            required
          />
        </label>
      </fieldset>
      {state.error && (
        <p role="alert" className="expense-error">
          {state.error}
        </p>
      )}
      <footer className="expense-form-footer">
        <button type="button" className="button-secondary" onClick={close} disabled={pending}>
          Batal
        </button>
        <button className="button-primary" disabled={pending || !account}>
          {pending ? "Menyimpan…" : "Catat Pembayaran"}
        </button>
      </footer>
    </form>
  );
}
