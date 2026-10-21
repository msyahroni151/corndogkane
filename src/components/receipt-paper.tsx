"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  receiptDate,
  receiptMoney,
  type ReceiptData,
  type ReceiptKind,
  type ReceiptSettings,
} from "@/lib/receipt-templates";
import "@/components/receipt-template.css";
export function ReceiptPaper({
  settings: s,
  data,
  kind = "CUSTOMER",
}: {
  settings: ReceiptSettings;
  data: ReceiptData;
  kind?: ReceiptKind;
}) {
  const money = (value: number) => receiptMoney(value, s),
    row = (label: string, value: string, bold = false) => (
      <div className={`receipt-line ${bold ? "receipt-total" : ""}`}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
    ),
    priced = kind === "CUSTOMER",
    summary = data.settlement;
  let logoUrl = s.logoUrl === "/corndog-kane-logo.png" ? s.logoUrl : "";
  try {
    if (new URL(s.logoUrl).protocol === "https:") logoUrl = s.logoUrl;
  } catch {
    // A logo URL may still be incomplete while the editor is typing.
  }
  return (
    <article
      className="kane-receipt"
      style={{ width: s.paperWidth - 8 + "mm" }}
      aria-label="Isi struk"
    >
      <header className="receipt-center">
        {s.showLogo && logoUrl && (
          <Image
            className="receipt-logo"
            src={logoUrl}
            alt="Logo toko"
            width={58}
            height={58}
            unoptimized
          />
        )}
        <h2>{s.brand}</h2>
        {s.showOutlet && data.outlet && <p>{data.outlet}</p>}
        {s.address && <p className="receipt-small receipt-multiline">{s.address}</p>}
        {s.phone && <p className="receipt-small">Telp. {s.phone}</p>}
        {s.email && <p className="receipt-small">{s.email}</p>}
        {s.website && <p className="receipt-small">{s.website}</p>}
        {s.headerText && <p className="receipt-multiline receipt-heading">{s.headerText}</p>}
      </header>
      {data.preview && <p className="receipt-preview-mark">PRATINJAU - BUKAN BUKTI PEMBAYARAN</p>}
      <hr />
      {row("Tanggal", receiptDate(data.dateISO, s.dateFormat))}
      {s.showCashier && row("Kasir", data.cashier)}
      <p className="receipt-small">No. {data.id}</p>
      {s.showCustomer && data.customer && row("Pelanggan", data.customer)}
      {data.cancelled && <p className="receipt-preview-mark">TRANSAKSI DIBATALKAN</p>}
      <hr />
      {kind === "SETTLEMENT" ? (
        <>
          {summary ? (
            <>
              {row("Jumlah transaksi", String(summary.transactions))}
              {row("Total penjualan", money(summary.total), true)}
              <hr />
              {summary.payments.map((payment) => (
                <div key={payment.method}>{row(payment.method, money(payment.amount))}</div>
              ))}
              <hr />
              {row("Kas seharusnya", money(summary.cashExpected))}
              {row("Kas aktual", money(summary.cashActual))}
              {row("Selisih kas", money(summary.cashActual - summary.cashExpected), true)}
            </>
          ) : (
            <p>Belum ada data rekap kasir.</p>
          )}
        </>
      ) : (
        <>
          {data.items.map((item, index) => (
            <div key={index} className="receipt-item">
              <p className="receipt-item-name">
                {index + 1}. {item.name}
              </p>
              {s.showAddons &&
                item.addons?.map((addon, i) => (
                  <p key={i} className="receipt-small">
                    {addon.name}
                    {priced && addon.unitPrice !== undefined
                      ? " +" + money(addon.unitPrice) + "/pcs"
                      : ""}
                  </p>
                ))}
              {item.notes && (
                <p className="receipt-small receipt-multiline">Catatan: {item.notes}</p>
              )}
              {priced
                ? row(
                    item.quantity + " pcs x " + money(item.price),
                    money(item.quantity * item.price),
                  )
                : row("Jumlah", item.quantity + " pcs", true)}
            </div>
          ))}
          <hr />
          {s.showQuantity &&
            row("Total QTY", data.items.reduce((sum, item) => sum + item.quantity, 0) + " pcs")}
          {priced && (
            <>
              <hr />
              {row(
                "Subtotal",
                money(data.items.reduce((sum, item) => sum + item.quantity * item.price, 0)),
              )}
              {s.showDiscount &&
                !!data.discount &&
                row("Diskon / Promo", "- " + money(data.discount))}
              {s.showTax &&
                typeof data.tax === "number" &&
                row(s.taxLabel || "Pajak", money(data.tax))}
              {row("Total", money(data.total), true)}
              {row("Bayar (" + data.method + ")", money(data.received))}
              {row("Kembali", money(Math.max(0, data.received - data.total)))}
            </>
          )}
        </>
      )}
      {s.showLoyalty && typeof data.loyaltyEarned === "number" && (
        <p className="receipt-small receipt-center">Poin diperoleh: {data.loyaltyEarned}</p>
      )}
      {s.showLoyalty && typeof data.loyaltyBalance === "number" && (
        <p className="receipt-small receipt-center">Total poin: {data.loyaltyBalance}</p>
      )}
      {(s.customLabel1 || s.customLabel2) && <hr />}
      {s.customLabel1 && row(s.customLabel1, s.customValue1)}
      {s.customLabel2 && row(s.customLabel2, s.customValue2)}
      {s.footerText && (
        <>
          <hr />
          <p className="receipt-center receipt-multiline">{s.footerText}</p>
        </>
      )}
    </article>
  );
}
export function PrintableReceipt({
  settings,
  data,
  kind = "CUSTOMER",
  printKey,
}: {
  settings: ReceiptSettings;
  data: ReceiptData;
  kind?: ReceiptKind;
  printKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    printed = useRef(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (printed.current === printKey || !ref.current) return;
    printed.current = printKey;
    let cancelled = false;
    async function print() {
      const element = ref.current;
      if (!element) return;
      await Promise.race([
        Promise.all(
          [...element.querySelectorAll("img")].map((img) => img.decode?.().catch(() => {})),
        ),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (document.fonts) await document.fonts.ready;
      if (cancelled) return;
      const measure = document.createElement("div");
      measure.style.cssText =
        "position:absolute;left:-10000px;top:0;visibility:hidden;width:" +
        (settings.paperWidth - 8) +
        "mm";
      const clone = element.querySelector("article")!.cloneNode(true) as HTMLElement;
      clone.style.maxWidth = "none";
      measure.append(clone);
      document.body.append(measure);
      const height = Math.max(
        60,
        Math.ceil((measure.getBoundingClientRect().height * 25.4) / 96) + 10,
      );
      measure.remove();
      let style = document.getElementById("kane-receipt-page-style") as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement("style");
        style.id = "kane-receipt-page-style";
        document.head.append(style);
      }
      style.textContent =
        "@page { size: " +
        settings.paperWidth +
        "mm " +
        height +
        "mm; margin:0; } @media print { html,body { margin:0!important;padding:0!important; } body > #pos-print-receipt { box-sizing:border-box!important; width:" +
        settings.paperWidth +
        "mm!important;max-width:none!important;margin:0!important;padding:4mm!important; } }";
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!cancelled) window.print();
    }
    print().catch(() =>
      setError("Struk belum dapat dicetak. Periksa gambar logo dan coba kembali."),
    );
    return () => {
      cancelled = true;
    };
  }, [printKey, settings, data]);
  return (
    <>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {createPortal(
        <div ref={ref} id="pos-print-receipt" className="pos-print-receipt">
          <ReceiptPaper settings={settings} data={data} kind={kind} />
        </div>,
        document.body,
      )}
    </>
  );
}
