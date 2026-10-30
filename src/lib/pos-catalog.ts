import type { PrismaClient } from "@/generated/prisma/client";
import { paymentMethods, type PosProduct } from "@/lib/pos-preview";
export async function loadPosCatalog(db: PrismaClient): Promise<PosProduct[]> {
  const items = await db.inventoryItem.findMany({
    where: { kind: "PRODUCT", active: true },
    orderBy: { name: "asc" },
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    category: /moza|mozarella/i.test(i.name)
      ? "Mozarella"
      : /beng.?beng/i.test(i.name)
        ? "Beng-Beng"
        : /mix/i.test(i.name)
          ? "Mix"
          : /sosis/i.test(i.name)
            ? "Sosis"
            : i.category,
    price: i.sellingPrice,
    prices: Object.fromEntries(
      paymentMethods.map((m) => [m, i.sellingPrice]),
    ) as PosProduct["prices"],
    unit: "pcs",
    icon: i.emoji || "♨",
  }));
}
