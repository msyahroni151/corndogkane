import { APP_TIME_ZONE } from "@/lib/local-date";
export const receiptKinds = ["CUSTOMER", "PRODUCTION", "PACKING", "SETTLEMENT"] as const;
export type ReceiptKind = (typeof receiptKinds)[number];
export const receiptKindLabels: Record<ReceiptKind, string> = {
  CUSTOMER: "Pelanggan",
  PRODUCTION: "Dapur / Produksi",
  PACKING: "Packing / Topping",
  SETTLEMENT: "Rekap Kasir",
};
export const receiptDateFormats = [
  "DD/MM/YYYY HH:mm",
  "DD/MM/YYYY HH:mm:ss",
  "YYYY-MM-DD HH:mm",
] as const;
export type ReceiptSettings = {
  brand: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  headerText: string;
  footerText: string;
  paperWidth: 58 | 80;
  currencyFormat: "RP" | "IDR";
  dateFormat: (typeof receiptDateFormats)[number];
  taxLabel: string;
  showLogo: boolean;
  showOutlet: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  showLoyalty: boolean;
  showAddons: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showQuantity: boolean;
  active: boolean;
  customLabel1: string;
  customValue1: string;
  customLabel2: string;
  customValue2: string;
};
export type ReceiptTemplateRecord = {
  scope: string;
  kind: ReceiptKind;
  revision: number;
  settings: ReceiptSettings;
};
export type ReceiptData = {
  id: string;
  dateISO: string;
  outlet: string;
  cashier: string;
  method: string;
  received: number;
  total: number;
  preview?: boolean;
  customer?: string;
  discount?: number;
  tax?: number;
  loyaltyEarned?: number;
  loyaltyBalance?: number;
  cancelled?: boolean;
  items: {
    name: string;
    quantity: number;
    price: number;
    addons?: { name: string; unitPrice?: number }[];
    notes?: string;
  }[];
  settlement?: {
    transactions: number;
    total: number;
    payments: { method: string; amount: number }[];
    cashExpected: number;
    cashActual: number;
  };
};
export function defaultReceiptSettings(kind: ReceiptKind = "CUSTOMER"): ReceiptSettings {
  return {
    brand: "Corndog Kane",
    address: "",
    phone: "",
    email: "",
    website: "",
    logoUrl: "/corndog-kane-logo.png",
    headerText:
      kind === "PRODUCTION"
        ? "BON PRODUKSI"
        : kind === "PACKING"
          ? "BON PACKING / TOPPING"
          : kind === "SETTLEMENT"
            ? "REKAP KASIR"
            : "",
    footerText:
      kind === "CUSTOMER"
        ? "Terima kasih telah berbelanja"
        : kind === "SETTLEMENT"
          ? "Rekap penerimaan kasir"
          : kind === "PRODUCTION"
            ? "Siapkan pesanan sesuai rincian di atas"
            : "Periksa glaze, topping, dan saus sebelum diserahkan",
    paperWidth: 80,
    currencyFormat: "RP",
    dateFormat: "DD/MM/YYYY HH:mm",
    taxLabel: "Pajak",
    showLogo: true,
    showOutlet: true,
    showCashier: true,
    showCustomer: false,
    showLoyalty: false,
    showAddons: true,
    showDiscount: true,
    showTax: true,
    showQuantity: true,
    active: true,
    customLabel1: "",
    customValue1: "",
    customLabel2: "",
    customValue2: "",
  };
}
export function parseReceiptSettings(input: unknown): ReceiptSettings {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Pengaturan struk tidak valid.");
  const source = input as Record<string, unknown>,
    result = defaultReceiptSettings();
  const lengths = {
    brand: 150,
    address: 500,
    phone: 50,
    email: 254,
    website: 500,
    logoUrl: 500,
    headerText: 500,
    footerText: 2000,
    taxLabel: 80,
    customLabel1: 100,
    customValue1: 500,
    customLabel2: 100,
    customValue2: 500,
  } as const;
  for (const [key, max] of Object.entries(lengths)) {
    if (typeof source[key] !== "string" || (source[key] as string).length > max)
      throw Error("Isi " + key + " maksimal " + max + " karakter.");
    Object.assign(result, { [key]: (source[key] as string).trim() });
  }
  if (!result.brand) throw Error("Nama toko wajib diisi.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw Error("Isi alamat email yang valid.");
  for (const key of ["website", "logoUrl"] as const) {
    const value = result[key];
    if (!value || (key === "logoUrl" && value === "/corndog-kane-logo.png")) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") throw Error();
    } catch {
      throw Error(
        (key === "logoUrl" ? "URL logo" : "Website") + " harus berupa tautan HTTPS yang valid.",
      );
    }
  }
  if (source.paperWidth !== 58 && source.paperWidth !== 80)
    throw Error("Pilih kertas 58 mm atau 80 mm.");
  result.paperWidth = source.paperWidth;
  if (source.currencyFormat !== "RP" && source.currencyFormat !== "IDR")
    throw Error("Format mata uang tidak valid.");
  result.currencyFormat = source.currencyFormat;
  if (!receiptDateFormats.includes(source.dateFormat as ReceiptSettings["dateFormat"]))
    throw Error("Format tanggal tidak valid.");
  result.dateFormat = source.dateFormat as ReceiptSettings["dateFormat"];
  for (const key of [
    "showLogo",
    "showOutlet",
    "showCashier",
    "showCustomer",
    "showLoyalty",
    "showAddons",
    "showDiscount",
    "showTax",
    "showQuantity",
    "active",
  ] as const) {
    if (typeof source[key] !== "boolean") throw Error("Pilihan tampilan struk tidak valid.");
    result[key] = source[key];
  }
  if (
    (result.customValue1 && !result.customLabel1) ||
    (result.customValue2 && !result.customLabel2)
  )
    throw Error("Isi label untuk setiap nilai field kustom.");
  return result;
}
export function resolveReceiptSettings(
  records: readonly ReceiptTemplateRecord[],
  scope: string,
  kind: ReceiptKind = "CUSTOMER",
): ReceiptSettings {
  return (
    records.find((r) => r.scope === scope && r.kind === kind && r.settings.active)?.settings ||
    records.find((r) => r.scope === "GLOBAL" && r.kind === kind && r.settings.active)?.settings ||
    defaultReceiptSettings(kind)
  );
}
export function receiptMoney(amount: number, settings: ReceiptSettings) {
  return (
    (settings.currencyFormat === "IDR" ? "IDR " : "Rp ") +
    amount.toLocaleString("id-ID", { maximumFractionDigits: 0 })
  );
}
export function receiptDate(iso: string, format: ReceiptSettings["dateFormat"]) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date),
    get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const day = format.startsWith("YYYY")
    ? get("year") + "-" + get("month") + "-" + get("day")
    : get("day") + "/" + get("month") + "/" + get("year");
  return (
    day +
    " " +
    get("hour") +
    ":" +
    get("minute") +
    (format.endsWith("ss") ? ":" + get("second") : "") +
    " WIB"
  );
}
