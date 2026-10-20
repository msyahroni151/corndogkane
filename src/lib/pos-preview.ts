// Snapshot of the Corndog Kane cashier catalogue supplied by the user.
// Reading this catalogue does not connect or send sales to the reference application.
export const paymentMethods = ["QRIS", "TUNAI", "Shopee Food", "Grab Food", "GoFood"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type PosProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  icon: string;
  unit: string;
  prices: Record<PaymentMethod, number>;
};
export const previewProducts: readonly PosProduct[] = [
  {
    id: "mozarella-original",
    name: "Mozarella Original",
    category: "Mozarella",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "mozarella-crumble",
    name: "Mozarella Crumble",
    category: "Mozarella",
    price: 11000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 11000,
      TUNAI: 11000,
      "Shopee Food": 11000,
      "Grab Food": 11000,
      GoFood: 11000,
    },
  },
  {
    id: "mozarella-mie",
    name: "Mozarella Mie",
    category: "Mozarella",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mozarella-kentang",
    name: "Mozarella Kentang",
    category: "Mozarella",
    price: 13000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 13000,
      TUNAI: 13000,
      "Shopee Food": 13000,
      "Grab Food": 13000,
      GoFood: 13000,
    },
  },
  {
    id: "mozarella-cornflakes",
    name: "Mozarella Cornflakes",
    category: "Mozarella",
    price: 13000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 13000,
      TUNAI: 13000,
      "Shopee Food": 13000,
      "Grab Food": 13000,
      GoFood: 13000,
    },
  },
  {
    id: "mozarella-coklat",
    name: "Mozarella Coklat",
    category: "Mozarella",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mozarella-tiramisu",
    name: "Mozarella Tiramisu",
    category: "Mozarella",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mozarella-greentea",
    name: "Mozarella Greentea",
    category: "Mozarella",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mozarella-vanilla",
    name: "Mozarella Vanilla",
    category: "Mozarella",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mozarella-taro",
    name: "Mozarella Taro",
    category: "Mozarella",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mozarella-strawberry",
    name: "Mozarella Strawberry",
    category: "Mozarella",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mix-original",
    name: "Mix Original",
    category: "Mix",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "mix-crumble",
    name: "Mix Crumble",
    category: "Mix",
    price: 11000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 11000,
      TUNAI: 11000,
      "Shopee Food": 11000,
      "Grab Food": 11000,
      GoFood: 11000,
    },
  },
  {
    id: "mix-mie",
    name: "Mix Mie",
    category: "Mix",
    price: 12000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 12000,
      TUNAI: 12000,
      "Shopee Food": 12000,
      "Grab Food": 12000,
      GoFood: 12000,
    },
  },
  {
    id: "mix-kentang",
    name: "Mix Kentang",
    category: "Mix",
    price: 13000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 13000,
      TUNAI: 13000,
      "Shopee Food": 13000,
      "Grab Food": 13000,
      GoFood: 13000,
    },
  },
  {
    id: "mix-cornflakes",
    name: "Mix Cornflakes",
    category: "Mix",
    price: 13000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 13000,
      TUNAI: 13000,
      "Shopee Food": 13000,
      "Grab Food": 13000,
      GoFood: 13000,
    },
  },
  {
    id: "beng-beng-original",
    name: "Beng-Beng Original",
    category: "Beng-Beng",
    price: 8000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 8000,
      TUNAI: 8000,
      "Shopee Food": 8000,
      "Grab Food": 8000,
      GoFood: 8000,
    },
  },
  {
    id: "beng-beng-coklat",
    name: "Beng-Beng Coklat",
    category: "Beng-Beng",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "beng-beng-tiramisu",
    name: "Beng-Beng Tiramisu",
    category: "Beng-Beng",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "beng-beng-greentea",
    name: "Beng-Beng Greentea",
    category: "Beng-Beng",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "beng-beng-vanilla",
    name: "Beng-Beng Vanilla",
    category: "Beng-Beng",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "beng-beng-taro",
    name: "Beng-Beng Taro",
    category: "Beng-Beng",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "beng-beng-strawberry",
    name: "Beng-Beng Strawberry",
    category: "Beng-Beng",
    price: 10000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 10000,
      TUNAI: 10000,
      "Shopee Food": 10000,
      "Grab Food": 10000,
      GoFood: 10000,
    },
  },
  {
    id: "sosis-original",
    name: "Sosis Original",
    category: "Sosis",
    price: 6000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 6000,
      TUNAI: 6000,
      "Shopee Food": 6000,
      "Grab Food": 6000,
      GoFood: 6000,
    },
  },
  {
    id: "sosis-crumble",
    name: "Sosis Crumble",
    category: "Sosis",
    price: 7000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 7000,
      TUNAI: 7000,
      "Shopee Food": 7000,
      "Grab Food": 7000,
      GoFood: 7000,
    },
  },
  {
    id: "sosis-mie",
    name: "Sosis Mie",
    category: "Sosis",
    price: 8000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 8000,
      TUNAI: 8000,
      "Shopee Food": 8000,
      "Grab Food": 8000,
      GoFood: 8000,
    },
  },
  {
    id: "sosis-kentang",
    name: "Sosis Kentang",
    category: "Sosis",
    price: 9000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 9000,
      TUNAI: 9000,
      "Shopee Food": 9000,
      "Grab Food": 9000,
      GoFood: 9000,
    },
  },
  {
    id: "sosis-cornflakes",
    name: "Sosis Cornflakes",
    category: "Sosis",
    price: 9000,
    icon: "♨",
    unit: "pcs",
    prices: {
      QRIS: 9000,
      TUNAI: 9000,
      "Shopee Food": 9000,
      "Grab Food": 9000,
      GoFood: 9000,
    },
  },
];
export const previewCategories = ["Semua", "Mozarella", "Mix", "Beng-Beng", "Sosis"] as const;
export const referenceOutlets = [
  "ANTAPANI",
  "CIPADUNG",
  "CISARANTEN",
  "CIWASTRA",
  "KLININGAN",
  "MARGAHAYU",
  "PSM",
  "CIGENDING",
  "CIKUTRA",
  "CIJERAH",
  "MARGACINTA",
  "STT TELKOM",
  "PAHLAWAN",
  "BALONGGEDE",
  "CIPAMOKOLAN",
  "SD SERANG",
  "KALIPAH APO",
  "GERLONG",
  "KERKOF",
  "PESANTREN",
  "PERMANA",
  "BUDI",
] as const;
export function productPrice(product: PosProduct, method: PaymentMethod = "TUNAI") {
  return product.prices[method];
}
export type CartItem = { productId: string; quantity: number };
export type PreviewDraft = {
  id: string;
  createdAt: string;
  items: CartItem[];
  outletId?: string;
  method?: PaymentMethod;
};
export const draftEvent = "ck:pos-preview-drafts";
function key(userId: string) {
  return "ck:pos-preview:" + userId;
}
export function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const result = new Map<string, number>();
  for (const item of value.slice(0, 100)) {
    if (!item || typeof item !== "object") continue;
    const { productId, quantity } = item as CartItem;
    if (
      !previewProducts.some((product) => product.id === productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    )
      continue;
    result.set(productId, Math.min(100, (result.get(productId) || 0) + quantity));
  }
  return Array.from(result, ([productId, quantity]) => ({ productId, quantity }));
}
export function readPreviewDrafts(userId: string): PreviewDraft[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw || raw.length > 200000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 50).flatMap((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.id !== "string" ||
        !/^DRAFT-[A-Z0-9-]{1,80}$/.test(entry.id) ||
        typeof entry.createdAt !== "string" ||
        !Number.isFinite(Date.parse(entry.createdAt))
      )
        return [];
      const items = normalizeCart(entry.items);
      return items.length
        ? [
            {
              id: entry.id,
              createdAt: entry.createdAt,
              items,
              ...(typeof entry.outletId === "string" && entry.outletId.length <= 120
                ? { outletId: entry.outletId }
                : {}),
              ...(paymentMethods.includes(entry.method)
                ? { method: entry.method as PaymentMethod }
                : {}),
            },
          ]
        : [];
    });
  } catch {
    return [];
  }
}
export function writePreviewDrafts(userId: string, drafts: PreviewDraft[]) {
  localStorage.setItem(key(userId), JSON.stringify(drafts.slice(0, 50)));
  window.dispatchEvent(new Event(draftEvent));
}
export function cartTotal(items: CartItem[], method: PaymentMethod = "TUNAI") {
  return items.reduce((sum, item) => {
    const product = previewProducts.find((product) => product.id === item.productId);
    return sum + (product ? productPrice(product, method) : 0) * item.quantity;
  }, 0);
}
