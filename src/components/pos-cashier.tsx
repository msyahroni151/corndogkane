"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/components/ui-icon";
import { notifySuccess } from "@/components/notification-toasts";
import type { SaleInput } from "@/lib/sale-input";
import {
  type PosProduct,
  paymentMethods,
  productPrice,
  readPreviewDrafts,
  writePreviewDrafts,
  cartTotal,
  type CartItem,
  type PaymentMethod,
} from "@/lib/pos-preview";
import { PrintableReceipt } from "@/components/receipt-paper";
import {
  resolveReceiptSettings,
  type ReceiptKind,
  type ReceiptTemplateRecord,
} from "@/lib/receipt-templates";
import { APP_TIME_ZONE } from "@/lib/local-date";
import { rupiah } from "@/lib/money";
export type PosOutlet = { id: string; name: string; areaName: string; reference?: boolean };
type Receipt = {
  dateISO: string;
  outletId: string;
  kind: ReceiptKind;
  preview: boolean;
  id: string;
  date: string;
  outlet: string;
  cashier: string;
  method: string;
  received: number;
  total: number;
  print: boolean;
  items: { name: string; quantity: number; price: number }[];
};
function clockLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  })
    .format(date)
    .replace(/\./g, ":");
}
export function PosCashier({
  userId,
  userName,
  outlets,
  draftId,
  canUseDrafts,
  receiptTemplates = [],
  catalog,
  crews,
  today,
  employeeId,
}: {
  catalog: PosProduct[];
  crews: { id: string; name: string; outletIds: string[] }[];
  today: string;
  employeeId?: string;
  userId: string;
  userName: string;
  outlets: PosOutlet[];
  draftId?: string;
  canUseDrafts: boolean;
  receiptTemplates?: ReceiptTemplateRecord[];
}) {
  const router = useRouter();
  function scheduledCrew(outletId: string) {
    const assigned = crews.filter((crew) => crew.outletIds.includes(outletId));
    return (
      assigned.find((crew) => crew.id === employeeId)?.id ||
      (assigned.length === 1 ? assigned[0].id : "")
    );
  }
  const [crewId, setCrewId] = useState(() => scheduledCrew(outlets[0]?.id || ""));
  const [pending, setPending] = useState(false),
    [recoveryError, setRecoveryError] = useState(false);
  const attempt = useRef<SaleInput | null>(null),
    posting = useRef(false),
    pendingKey = "ck:pos-checkout:" + userId;
  useEffect(() => {
    let disposed = false;
    async function recover() {
      try {
        const text = localStorage.getItem(pendingKey);
        if (!text) return;
        setRecoveryError(true);
        const body = JSON.parse(text) as SaleInput;
        if (!body.key || !Array.isArray(body.items)) throw Error("Data tertunda tidak valid.");
        const response = await fetch("/api/pos/sales?key=" + encodeURIComponent(body.key), {
          cache: "no-store",
        });
        if (disposed) return;
        if (response.ok) {
          const result = await response.json();
          attempt.current = null;
          try {
            localStorage.removeItem(pendingKey);
          } catch {}
          const saved = result.receipt;
          setReceipt({
            ...saved,
            kind: "CUSTOMER",
            print: false,
            date:
              new Intl.DateTimeFormat("id-ID", {
                timeZone: APP_TIME_ZONE,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(saved.dateISO)) + " WIB",
          });
          setRecoveryError(false);
          notifySuccess(
            "Pembayaran sebelumnya sudah tersimpan. Riwayat dipulihkan tanpa membuat transaksi baru.",
          );
          router.refresh();
          return;
        }
        if (response.status !== 404)
          throw Error(
            "Status pembayaran belum dapat diperiksa. Jangan membuat transaksi yang sama lagi.",
          );
        if (!body.items.every((i) => catalog.some((p) => p.id === i.productId))) {
          attempt.current = null;
          try {
            localStorage.removeItem(pendingKey);
          } catch {}
          setRecoveryError(false);
          setError(
            "Pembayaran tertunda belum tercatat dan menu sudah berubah. Periksa kembali pesanan sebelum membayar.",
          );
          return;
        }
        attempt.current = body;
        setCart(body.items);
        setOutletId(body.outletId);
        setCrewId(body.crewId);
        setMethod(body.method);
        setCash(String(body.received));
        setOpen(true);
        setRecoveryError(false);
        setError(
          "Ada pembayaran yang belum tercatat. Coba ulang; kunci transaksi yang sama mencegah pencatatan ganda.",
        );
      } catch (reason) {
        if (!disposed) {
          setRecoveryError(true);
          setError(
            reason instanceof Error
              ? reason.message
              : "Periksa pembayaran tertunda sebelum membuat transaksi baru.",
          );
        }
      }
    }
    void recover();
    return () => {
      disposed = true;
    };
  }, [pendingKey]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<PaymentMethod>("TUNAI");
  const [outletId, setOutletId] = useState(outlets[0]?.id || "");
  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [cash, setCash] = useState("");
  const [open, setOpen] = useState(false);
  const [print, setPrint] = useState(false);
  const [receiptKind, setReceiptKind] = useState<ReceiptKind>("CUSTOMER");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [savedId, setSavedId] = useState<string | undefined>(draftId);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const outlet = outlets.find((item) => item.id === outletId);
  useEffect(() => {
    const tick = () => setNow(new Date());
    queueMicrotask(tick);
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!draftId) return;
    const draft = readPreviewDrafts(userId, catalog).find((item) => item.id === draftId);
    queueMicrotask(() => {
      if (draft) {
        setCart(draft.items);
        setSavedId(draft.id);
        if (draft.method) setMethod(draft.method);
        if (draft.outletId && outlets.some((item) => item.id === draft.outletId))
          setOutletId(draft.outletId);
      } else {
        setSavedId(undefined);
        setError("Draft tidak ditemukan di browser ini.");
      }
    });
  }, [draftId, userId, outlets]);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  const products = catalog.filter(
    (product) =>
      (category === "Semua" || product.category === category) &&
      product.name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")),
  );
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartTotal(cart, method, catalog);
  const received = Number(cash || 0);
  const validCash = Number.isSafeInteger(received) && received >= total && received <= 1000000000;
  const canPay =
    !pending &&
    !recoveryError &&
    total > 0 &&
    cart.length > 0 &&
    !!outlet &&
    !!crewId &&
    (method !== "TUNAI" || validCash);
  function add(productId: string) {
    const quantity = Number(quantities[productId] || "1");
    const existing = cart.find((item) => item.productId === productId)?.quantity || 0;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity + existing > 100) {
      setError("Jumlah harus 1–100 per menu, termasuk yang ada di keranjang.");
      return;
    }
    setError("");
    setCart((previous) =>
      existing
        ? previous.map((item) =>
            item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item,
          )
        : [...previous, { productId, quantity }],
    );
  }
  function change(productId: string, delta: number) {
    setCart((previous) =>
      previous
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(100, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
    setError("");
  }
  function saveDraft() {
    if (!cart.length || !outlet || !canUseDrafts) return;
    try {
      const drafts = readPreviewDrafts(userId, catalog);
      if (!savedId && drafts.length >= 50) {
        setError("Maksimal 50 draft pratinjau. Hapus draft lama terlebih dahulu.");
        return;
      }
      const id = savedId || "DRAFT-" + crypto.randomUUID().toUpperCase();
      const old = drafts.find((item) => item.id === id);
      writePreviewDrafts(userId, [
        {
          id,
          createdAt: old?.createdAt || new Date().toISOString(),
          items: cart,
          outletId,
          method,
        },
        ...drafts.filter((item) => item.id !== id),
      ]);
      setSavedId(id);
      setError("");
      notifySuccess(
        "Draft pesanan tersimpan pada browser ini. Buka Draft Pesanan untuk melanjutkan.",
      );
    } catch {
      setError("Draft belum tersimpan. Penyimpanan browser tidak tersedia.");
    }
  }
  function close() {
    if (posting.current || attempt.current) {
      setError("Konfirmasikan ulang pembayaran yang tertunda sebelum menutup popup.");
      return;
    }
    setOpen(false);
    trigger.current?.focus();
  }
  async function finish() {
    if (posting.current || !outlet || (!attempt.current && !canPay)) return;
    posting.current = true;
    setPending(true);
    setError("");
    try {
      const body = attempt.current || {
        key:
          savedId && /^[A-F0-9-]{36}$/.test(savedId.slice(6))
            ? savedId.slice(6).toLowerCase()
            : crypto.randomUUID(),
        outletId: outlet.id,
        crewId,
        date: today,
        source: "POS" as const,
        method,
        received: method === "TUNAI" ? received : total,
        quotedTotal: total,
        notes: "",
        items: cart,
      };
      if (!attempt.current) {
        try {
          localStorage.setItem(pendingKey, JSON.stringify(body));
        } catch {
          throw Error(
            "Penyimpanan browser tidak tersedia. Transaksi belum dikirim; aktifkan penyimpanan browser terlebih dahulu.",
          );
        }
      }
      attempt.current = body;
      const response = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 400) {
          attempt.current = null;
          try {
            localStorage.removeItem(pendingKey);
          } catch {}
        }
        throw Error(
          result.error || "Pembayaran belum dikonfirmasi. Coba ulang transaksi yang sama.",
        );
      }
      const saved = result.receipt,
        timestamp = new Date(saved.dateISO);
      attempt.current = null;
      try {
        localStorage.removeItem(pendingKey);
      } catch {}
      if (savedId) {
        try {
          writePreviewDrafts(
            userId,
            readPreviewDrafts(userId, catalog).filter((d) => d.id !== savedId),
          );
        } catch {
          /* Receipt already persisted; do not retry it as a new sale. */
        }
      }
      setReceipt({
        ...saved,
        kind: receiptKind,
        print,
        date:
          new Intl.DateTimeFormat("id-ID", {
            timeZone: APP_TIME_ZONE,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(timestamp) + " WIB",
      });
      try {
        localStorage.setItem("ck:sales-updated", Date.now().toString());
      } catch {}
      setOpen(false);
      setCart([]);
      setCash("");
      setSavedId(undefined);
      notifySuccess(
        saved.stockPending
          ? "Transaksi tersimpan. Ada pemakaian bahan yang belum diproses; periksa Monitoring Outlet."
          : "Transaksi tersimpan dan Monitoring Outlet diperbarui.",
      );
      if (draftId) router.replace("/pos");
      else router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Koneksi terputus. Coba ulang pembayaran yang sama.",
      );
    } finally {
      posting.current = false;
      setPending(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
        POS terhubung ke Monitoring Outlet. Harga mengikuti Setting Menu; bahan berkurang dari stok
        outlet sesuai resep yang tersedia.
      </div>
      {!outlets.length && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">
          Belum ada outlet aktif sesuai jadwal Anda. Hubungi admin untuk memeriksa jadwal HR.
        </p>
      )}
      {outlets.length > 0 && !crewId && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">
          Petugas POS belum dapat ditentukan dari jadwal HR outlet ini. Periksa jadwal dan gunakan
          akun crew yang bertugas sebelum mencatat transaksi.
        </p>
      )}
      <section aria-label="Informasi kasir" className="kane-outlet-bar panel">
        <div>
          <h2>CORNDOG KANE</h2>
          <p className="kane-kicker">PENCATATAN PENJUALAN</p>
          <p className="mt-1 text-xs text-slate-500">
            {outlet?.name || "Pilih outlet"}
            {outlet?.areaName ? ` · ${outlet.areaName}` : ""}
          </p>
        </div>
        <div className="kane-outlet-controls">
          <span className="text-xs text-slate-500">{userName}</span>
          <label>
            <span className="sr-only">Outlet kasir</span>
            <select
              aria-label="Outlet kasir"
              value={outletId}
              onChange={(event) => {
                setOutletId(event.target.value);
                setCrewId(scheduledCrew(event.target.value));
              }}
            >
              {outlets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="kane-clock">
            <strong>{now ? clockLabel(now) : "--:--:--"} WIB</strong>
            <small>
              {now
                ? new Intl.DateTimeFormat("id-ID", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: APP_TIME_ZONE,
                  }).format(now)
                : ""}
            </small>
          </div>
        </div>
      </section>
      <p className="text-xs text-slate-500">
        Siap. Outlet {outlet?.name || "belum dipilih"} · {userName}
        {outlet?.reference ? " · Outlet referensi" : ""}
      </p>
      <div className="pos-layout kane-pos-layout">
        <section aria-label="Daftar menu" className="min-w-0 space-y-3">
          <div className="pos-filter panel">
            <label className="pos-search">
              <UiIcon name="search" size={16} />
              <input
                aria-label="Cari menu"
                placeholder="Cari menu…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button type="button" aria-label="Hapus pencarian" onClick={() => setQuery("")}>
                  ×
                </button>
              )}
            </label>
            <div className="pos-categories" aria-label="Kategori menu">
              {["Semua", ...new Set(catalog.map((p) => p.category))].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  className={category === value ? "selected" : ""}
                  onClick={() => setCategory(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="panel pos-products kane-products">
            <div className="pos-section-heading">
              <h2>
                <UiIcon name="box" size={16} />
                Menu
              </h2>
              <span>{products.length} menu</span>
            </div>
            <div className="pos-product-grid">
              {products.map((product) => (
                <article className="pos-product" key={product.id}>
                  <div className="flex items-center gap-2">
                    <span className="pos-product-icon" aria-hidden="true">
                      ♨
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{product.name}</h3>
                      <p className="mt-1 text-[11px] text-slate-500">Per pcs</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-bold text-emerald-700">
                    {rupiah(productPrice(product, method))}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      aria-label={`Jumlah ${product.name}`}
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      placeholder="Qty"
                      value={quantities[product.id] ?? ""}
                      onChange={(event) =>
                        setQuantities((previous) => ({
                          ...previous,
                          [product.id]: event.target.value,
                        }))
                      }
                      className="pos-quantity-input"
                    />
                    <button
                      type="button"
                      aria-label={`Tambahkan ${product.name}`}
                      className="pos-add"
                      onClick={() => add(product.id)}
                    >
                      + Tambah
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!products.length && (
              <div className="pos-no-menu">
                <UiIcon name="search" size={28} />
                <h3>Menu tidak ditemukan</h3>
                <p>Coba kata kunci atau kategori lainnya.</p>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("Semua");
                  }}
                >
                  Tampilkan semua menu
                </button>
              </div>
            )}
          </div>
        </section>
        <section aria-label="Keranjang" className="panel pos-cart kane-cart">
          <div className="pos-cart-header">
            <h2>
              <UiIcon name="cart" size={18} />
              Keranjang
            </h2>
            <span className="badge" aria-live="polite">
              {count} item
            </span>
          </div>
          <div className="pos-cart-items">
            {!cart.length ? (
              <div className="pos-empty-cart">
                <span>
                  <UiIcon name="cart" size={32} />
                </span>
                <h3>Keranjang masih kosong</h3>
                <p>Pilih menu untuk mulai transaksi.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-red-600"
                    onClick={() => {
                      setCart([]);
                      setSavedId(undefined);
                      setCash("");
                    }}
                  >
                    Kosongkan keranjang
                  </button>
                </div>
                {cart.map((item) => {
                  const product = catalog.find((product) => product.id === item.productId)!;
                  const price = productPrice(product, method);
                  return (
                    <div className="pos-cart-row" key={item.productId}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{rupiah(price)} / pcs</p>
                        <div className="pos-stepper">
                          <button
                            type="button"
                            aria-label={`Kurangi ${product.name}`}
                            onClick={() => change(item.productId, -1)}
                          >
                            −
                          </button>
                          <span aria-label={`Jumlah di keranjang ${product.name}`}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tambah ${product.name}`}
                            disabled={item.quantity === 100}
                            onClick={() => change(item.productId, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{rupiah(price * item.quantity)}</p>
                        <button
                          type="button"
                          aria-label={`Hapus ${product.name}`}
                          className="mt-3 text-xs text-slate-400 hover:text-red-600"
                          onClick={() =>
                            setCart((previous) =>
                              previous.filter((row) => row.productId !== item.productId),
                            )
                          }
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div className="pos-payment kane-payment">
            <p className="mb-2 text-xs text-slate-500">Metode pembayaran</p>
            <div className="pos-methods">
              {paymentMethods.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={method === value}
                  className={method === value ? "selected" : ""}
                  onClick={() => {
                    setMethod(value);
                    setCash("");
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="field mt-3 !gap-1.5 !text-xs !font-medium">
              Uang diterima (Rp)
              <input
                aria-label="Uang diterima"
                inputMode="numeric"
                maxLength={17}
                disabled={method !== "TUNAI"}
                value={
                  method !== "TUNAI"
                    ? total.toLocaleString("id-ID")
                    : cash
                      ? Number(cash).toLocaleString("id-ID")
                      : ""
                }
                placeholder="Rp. 0"
                onChange={(event) =>
                  setCash(event.target.value.replace(/[^0-9]/g, "").slice(0, 10))
                }
              />
            </label>
            <p className="mt-2 text-[11px] text-slate-500">
              {method === "TUNAI"
                ? "Masukkan nominal uang pelanggan."
                : "Nominal mengikuti total pembayaran non-tunai."}
            </p>
            <dl className="pos-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{rupiah(total)}</dd>
              </div>
              <div className="pos-grand-total">
                <dt>Total</dt>
                <dd aria-label="Total pembayaran">{rupiah(total)}</dd>
              </div>
              {method === "TUNAI" && received > 0 && cart.length > 0 && (
                <div>
                  <dt>Kembalian</dt>
                  <dd aria-label="Kembalian">{rupiah(Math.max(0, received - total))}</dd>
                </div>
              )}
            </dl>
            {method === "TUNAI" && cart.length > 0 && received > 0 && !validCash && (
              <p className="mb-3 text-xs text-amber-700">
                Uang diterima belum mencukupi total pembayaran.
              </p>
            )}
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canPay}
                className="button-primary !px-2 !text-xs"
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setPrint(true);
                  setOpen(true);
                }}
              >
                Simpan &amp; Print Struk
              </button>
              <button
                type="button"
                disabled={!canPay}
                className="button-secondary !px-2"
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setPrint(false);
                  setOpen(true);
                }}
              >
                Simpan Tanpa Print
              </button>
            </div>
            {canUseDrafts && (
              <a
                href="/pos/draft"
                className="mt-3 block text-center text-xs font-medium text-emerald-700"
              >
                Lihat Draft Pesanan
              </a>
            )}
            {canUseDrafts && (
              <button
                type="button"
                className="mt-3 w-full text-xs font-medium text-emerald-700 disabled:text-slate-400"
                disabled={!cart.length || !outlet}
                onClick={saveDraft}
              >
                Simpan draft pesanan
              </button>
            )}
          </div>
        </section>
      </div>
      {open && (
        <dialog
          ref={dialog}
          aria-labelledby="pos-payment-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/45"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 id="pos-payment-title" className="font-bold">
              Konfirmasi Pembayaran
            </h2>
            <button
              type="button"
              aria-label="Tutup pembayaran"
              className="button-secondary"
              onClick={close}
            >
              ×
            </button>
          </div>
          <div className="space-y-4 p-6">
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Pembayaran ini akan disimpan sebagai transaksi nyata di outlet yang dipilih. Pastikan
              pesanan dan uang diterima sudah benar.
            </p>
            <p className="text-sm font-semibold">
              {outlet?.name} · {userName}
            </p>
            <div className="space-y-2 text-xs">
              {cart.map((item) => {
                const product = catalog.find((product) => product.id === item.productId)!;
                return (
                  <div key={item.productId} className="flex justify-between gap-3">
                    <span>
                      {item.quantity} × {product.name}
                    </span>
                    <span>{rupiah(productPrice(product, method) * item.quantity)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-sm">
              <span>{method}</span>
              <strong>{rupiah(total)}</strong>
            </div>
            {method === "TUNAI" && (
              <p className="flex justify-between text-sm">
                <span>Kembalian</span>
                <strong>{rupiah(received - total)}</strong>
              </p>
            )}
            {print && (
              <label className="field">
                Jenis Struk
                <select
                  value={receiptKind}
                  onChange={(e) => setReceiptKind(e.target.value as ReceiptKind)}
                >
                  <option value="CUSTOMER">Pelanggan</option>
                  <option value="PRODUCTION">Dapur / Produksi</option>
                  <option value="PACKING">Packing / Topping</option>
                </select>
              </label>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              className="button-primary w-full"
              disabled={pending || (!canPay && !attempt.current)}
              onClick={finish}
            >
              {pending ? "Menyimpan…" : print ? "Simpan & Cetak Struk" : "Konfirmasi & Simpan"}
            </button>
          </div>
        </dialog>
      )}
      {receipt?.print && (
        <PrintableReceipt
          data={receipt}
          settings={resolveReceiptSettings(receiptTemplates, receipt.outletId, receipt.kind)}
          kind={receipt.kind}
          printKey={receipt.id}
        />
      )}
    </div>
  );
}
