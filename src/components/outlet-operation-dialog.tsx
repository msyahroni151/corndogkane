"use client";
import { outletBonus, outletBonusRate } from "@/lib/outlet-bonus";

import { useEffect, useId, useRef, useState } from "react";

import { LocalInput } from "@/components/local-input";

import { notifySuccess } from "@/components/notification-toasts";

import {
  operationalCash,
  operationalProducts,
  operationalPayments,
  type OperationalLoad,
} from "@/lib/outlet-operations";

import { rupiah } from "@/lib/money";

export function OutletOperationDialog({
  outlet,

  date: initialDate,

  onClose,

  onSaved,
}: {
  outlet: { id: string; name: string };

  date: string;

  onClose: () => void;

  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  const [date, setDate] = useState(initialDate),
    [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;

    if (!element) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    element.showModal();

    const before = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      element.close();

      document.body.style.overflow = before;

      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="outlet-operation-title"
      className="operation-dialog"
      onCancel={(event) => {
        event.preventDefault();

        if (!saving) onClose();
      }}
    >
      <header className="operation-dialog-header">
        <div>
          <h2 id="outlet-operation-title">Operasional Outlet · {outlet.name}</h2>

          <p>Isi rekap penjualan per tanggal operasional.</p>
        </div>

        <button
          type="button"
          className="button-secondary"
          aria-label="Tutup formulir operasional"
          disabled={saving}
          onClick={onClose}
        >
          Tutup
        </button>
      </header>

      <div className="operation-dialog-body">
        <label className="field operation-date">
          Tanggal Operasional *
          <LocalInput
            type="date"
            aria-label="Tanggal Operasional"
            value={date}
            required
            disabled={saving}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        {date ? (
          <OperationDateForm
            key={date}
            date={date}
            outletId={outlet.id}
            onSaving={setSaving}
            onSaved={onSaved}
          />
        ) : (
          <p className="operation-form-note">Isi tanggal operasional yang valid.</p>
        )}
      </div>
    </dialog>
  );
}

function OperationDateForm({
  date,

  outletId,

  onSaving,

  onSaved,
}: {
  date: string;

  outletId: string;

  onSaving: (saving: boolean) => void;

  onSaved: () => void;
}) {
  const [loaded, setLoaded] = useState<OperationalLoad | null>(null),
    [error, setError] = useState("");

  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function read() {
      try {
        const params = new URLSearchParams({ outletId, date });

        const response = await fetch("/api/outlets/operations?" + params, {
          signal: controller.signal,

          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) throw Error(result.error || "Data belum dapat dibaca.");

        if (!controller.signal.aborted) {
          setLoaded(result);

          setError("");
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Data belum dapat dibaca.");
      }
    }

    void read();

    return () => controller.abort();
  }, [date, outletId, retry]);

  if (!loaded)
    return (
      <div className="operation-form-note">
        {error ? (
          <>
            <p role="alert">{error}</p>

            <button
              className="button-secondary mt-3"
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Coba lagi
            </button>
          </>
        ) : (
          "Menyiapkan formulir…"
        )}
      </div>
    );

  return (
    <OperationFields
      loaded={loaded}
      date={date}
      outletId={outletId}
      onSaving={onSaving}
      onSaved={onSaved}
    />
  );
}

function OperationFields({
  loaded,

  date,

  outletId,

  onSaving,

  onSaved,
}: {
  loaded: OperationalLoad;

  date: string;

  outletId: string;

  onSaving: (saving: boolean) => void;

  onSaved: () => void;
}) {
  const entry = loaded.entry;

  const [crewId, setCrewId] = useState(entry?.crewId || ""),
    [trainingCrewName, setTrainingCrewName] = useState(entry?.trainingCrewName || "");

  const [doughUsed, setDoughUsed] = useState(
    entry?.doughUsed == null ? "" : String(entry.doughUsed),
  );

  const [expenseAmount, setExpenseAmount] = useState(
    entry?.expenseAmount == null ? "" : String(entry.expenseAmount),
  );

  const [cashReceived, setCashReceived] = useState(
    entry?.cashReceived == null ? "" : String(entry.cashReceived),
  );
  const [expenseNotes, setExpenseNotes] = useState(entry?.expenseNotes || "");

  const crewListId = useId();

  const [crewSearch, setCrewSearch] = useState(
    loaded.employees.find((employee) => employee.id === entry?.crewId)?.name ||
      entry?.crewLabel ||
      "",
  );

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      operationalProducts.map((item) => [
        item.key,

        entry?.quantities[item.key] ? String(entry.quantities[item.key]) : "",
      ]),
    ),
  );

  const [payments, setPayments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      operationalPayments.map((item) => [
        item.key,

        entry?.[item.key] ? String(entry[item.key]) : "",
      ]),
    ),
  );

  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);

  const price = (key: string, fallback: number) => entry?.unitPrices[key] ?? fallback;

  const total = operationalProducts.reduce(
    (sum, item) => sum + Number(quantities[item.key] || 0) * price(item.key, item.price),

    0,
  );

  const noncash = operationalPayments.reduce(
    (sum, item) => sum + Number(payments[item.key] || 0),

    0,
  );

  const cash = operationalCash({
    totalGross: total,
    qris: Number(payments.qris || 0),
    gofood: Number(payments.gofood || 0),
    grabfood: Number(payments.grabfood || 0),
    shopeefood: Number(payments.shopeefood || 0),
    expenseAmount: Number(expenseAmount || 0),
  });
  const bonus = outletBonus(
    total,
    outletBonusRate(
      loaded.outletName || "",
      date,
      entry?.bonusDailyRate ?? loaded.dailyRate ?? null,
      total,
    ),
  );
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) return;

    if (!crewId) {
      setError("Pilih kode crew dari daftar yang tersedia.");

      return;
    }

    setPending(true);

    onSaving(true);

    setError("");

    try {
      const response = await fetch("/api/outlets/operations", {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          outletId,

          date,

          version: entry?.version ?? null,

          crewId,

          trainingCrewName: trainingCrewName.trim() || null,

          doughUsed: doughUsed === "" ? null : Number(doughUsed),
          expenseAmount: expenseAmount === "" ? null : Number(expenseAmount),

          expenseNotes: expenseNotes.trim() || null,
          cashReceived: cashReceived === "" ? null : Number(cashReceived),

          quantities: Object.fromEntries(
            operationalProducts.map((item) => [item.key, Number(quantities[item.key] || 0)]),
          ),

          ...Object.fromEntries(
            operationalPayments.map((item) => [item.key, Number(payments[item.key] || 0)]),
          ),
        }),
      });

      const result = await response.json();

      if (!response.ok) throw Error(result.error || "Rekap belum tersimpan.");

      notifySuccess(result.success);

      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rekap belum tersimpan.");
    } finally {
      setPending(false);

      onSaving(false);
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending}>
      <fieldset disabled={pending}>
        <div className="operation-crews">
          <label className="field">
            Nama Crew *
            <input
              type="text"
              aria-label="Nama Crew"
              aria-autocomplete="list"
              list={crewListId}
              required
              autoComplete="off"
              placeholder="Ketik untuk mencari kode crew..."
              value={crewSearch}
              onChange={(event) => {
                const text = event.target.value;

                setCrewSearch(text);

                const matched = loaded.employees.find(
                  (employee) => employee.name.toUpperCase() === text.trim().toUpperCase(),
                );

                setCrewId(matched?.id || (entry && text === entry.crewLabel ? entry.crewId : ""));
              }}
              onBlur={() => {
                const matched = loaded.employees.find((employee) => employee.id === crewId);

                if (matched) setCrewSearch(matched.name);
              }}
            />
            <datalist id={crewListId}>
              {loaded.employees.map((employee) => (
                <option key={employee.id} value={employee.name} />
              ))}
            </datalist>
          </label>

          <label className="field">
            Nama Crew Training
            <input
              type="text"
              aria-label="Nama Crew Training"
              value={trainingCrewName}
              onChange={(event) => setTrainingCrewName(event.target.value)}
              maxLength={100}
              placeholder="Isi nama crew training (opsional)"
            />
          </label>
        </div>

        {!loaded.employees.length && (
          <p className="operation-form-note">
            Belum ada CREW OUTLET, CREW BACKUP, atau AREA SUPERVISOR yang aktif dan memiliki kode
            nama.
          </p>
        )}

        {["Isian", "Balutan", "Topping"].map((group) => (
          <section className="operation-product-group" key={group}>
            <h3>{group}</h3>

            <div className="operation-product-grid">
              {operationalProducts

                .filter((item) => item.group === group)

                .map((item) => (
                  <label className="operation-product-input" key={item.key}>
                    <span>
                      <strong>{item.label}</strong>

                      <small>{rupiah(price(item.key, item.price))}/pcs</small>
                    </span>

                    <input
                      type="number"
                      aria-label={`QTY ${item.label}`}
                      inputMode="numeric"
                      min={0}
                      max={10000}
                      step={1}
                      value={quantities[item.key]}
                      placeholder="0"
                      onChange={(event) =>
                        setQuantities((old) => ({ ...old, [item.key]: event.target.value }))
                      }
                    />

                    <small>QTY</small>
                  </label>
                ))}
            </div>
          </section>
        ))}

        <section className="operation-product-group">
          <h3>Pemakaian Adonan</h3>
          <label className="field operation-date">
            Adonan terpakai (pcs)
            <input
              type="number"
              aria-label="Adonan terpakai (pcs)"
              aria-describedby="operation-dough-help"
              min={0}
              max={10000}
              step={1}
              inputMode="numeric"
              placeholder="Isi jumlah pcs"
              value={doughUsed}
              onChange={(event) => setDoughUsed(event.target.value)}
            />
          </label>
          <p id="operation-dough-help" className="operation-form-note">
            1 pcs = 500 gram adonan + 1 sendok teh parmifan. Tidak dihitung sebagai omzet.
          </p>
        </section>

        <section className="operation-product-group">
          <h3>Pembayaran non-tunai</h3>

          <div className="operation-payment-grid">
            {operationalPayments.map((item) => (
              <label className="field" key={item.key}>
                {item.label} (Rp)
                <input
                  aria-label={`${item.label} (Rp)`}
                  type="text"
                  inputMode="numeric"
                  maxLength={13}
                  placeholder="0"
                  value={(payments[item.key] || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                  onChange={(event) =>
                    setPayments((old) => ({
                      ...old,

                      [item.key]: event.target.value

                        .replace(/[^0-9]/g, "")

                        .replace(/^0+(?=\d)/, ""),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="operation-product-group">
          <h3>Pengeluaran outlet</h3>

          <div className="operation-payment-grid">
            <label className="field">
              Nominal Pengeluaran (Rp)
              <input
                aria-label="Nominal Pengeluaran (Rp)"
                type="text"
                inputMode="numeric"
                maxLength={13}
                placeholder="0"
                value={expenseAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                onChange={(event) =>
                  setExpenseAmount(
                    event.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""),
                  )
                }
              />
            </label>

            <label className="field">
              Keterangan Pengeluaran
              <textarea
                aria-label="Keterangan Pengeluaran"
                maxLength={1000}
                rows={3}
                placeholder="Contoh: beli minyak, gas, atau kebutuhan outlet..."
                value={expenseNotes}
                onChange={(event) => setExpenseNotes(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="operation-product-group">
          <h3>Setoran cash diterima</h3>
          <label className="field">
            Real / Setoran Cash Diterima (Rp)
            <input
              aria-label="Real / Setoran Cash Diterima (Rp)"
              type="text"
              inputMode="numeric"
              maxLength={13}
              placeholder="Belum diterima"
              value={cashReceived.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              onChange={(e) =>
                setCashReceived(e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""))
              }
            />
          </label>
          <p className="operation-form-note">
            Kosongkan jika belum diterima. Isi 0 jika setoran yang diterima nol.
          </p>
        </section>
        <div className="operation-totals">
          <div>
            <span>Total penjualan produk</span>

            <strong>{rupiah(total)}</strong>
          </div>

          <div>
            <span>Total pembayaran non-tunai</span>

            <strong>{rupiah(noncash)}</strong>
          </div>

          <div>
            <span>Total pengeluaran</span>

            <strong>{expenseAmount === "" ? "—" : rupiah(Number(expenseAmount))}</strong>
          </div>

          <div>
            <span>Cash</span>

            <strong>
              {rupiah(
                operationalCash({
                  totalGross: total,

                  qris: Number(payments.qris || 0),

                  gofood: Number(payments.gofood || 0),

                  grabfood: Number(payments.grabfood || 0),

                  shopeefood: Number(payments.shopeefood || 0),

                  expenseAmount: Number(expenseAmount || 0),
                }),
              )}
            </strong>
          </div>
        </div>

        <div className="operation-totals">
          <div>
            <span>Bonus crew (langsung masuk saldo)</span>
            <strong>{bonus == null ? "Atur tarif outlet" : rupiah(bonus)}</strong>
          </div>
          <div>
            <span>Selisih (REAL − CASH)</span>
            <strong>{cashReceived === "" ? "—" : rupiah(Number(cashReceived) - cash)}</strong>
          </div>
        </div>
        <p className="operation-form-note">
          Cash = omzet − QRIS − total online food − pengeluaran.
        </p>

        {noncash > total && (
          <p className="operation-amount-note">
            Pembayaran non-tunai melebihi total harga produk. Periksa kembali jumlah atau nominal
            yang diisi.
          </p>
        )}

        <p className="operation-form-note">
          Satu rekap per outlet dan tanggal. Rekap yang sudah ada akan dibuka untuk diperbarui.
        </p>
      </fieldset>

      {error && (
        <p className="operation-error" role="alert">
          {error}
        </p>
      )}

      <footer className="operation-form-footer">
        <button
          className="button-primary"
          type="submit"
          disabled={pending || (!loaded.employees.length && !entry)}
        >
          {pending ? "Menyimpan…" : entry ? "Simpan perubahan" : "Simpan rekap"}
        </button>
      </footer>
    </form>
  );
}
