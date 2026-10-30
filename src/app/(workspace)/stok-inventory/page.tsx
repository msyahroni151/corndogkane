import { redirect } from "next/navigation";
import InventoryWorkspace from "@/components/inventory-workspace";
import type { ComponentProps } from "react";

export default async function Page({
  searchParams,
}: Pick<ComponentProps<typeof InventoryWorkspace>, "searchParams">) {
  const query = await searchParams;
  if (query.tab === "produk" || query.tab === "subproduk") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") params.set(key, value);
    }
    redirect("/setting-menu?" + params);
  }
  return <InventoryWorkspace searchParams={Promise.resolve(query)} />;
}
