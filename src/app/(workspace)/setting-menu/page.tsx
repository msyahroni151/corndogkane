import InventoryWorkspace from "@/components/inventory-workspace";
import type { ComponentProps } from "react";

export default function Page({
  searchParams,
}: Pick<ComponentProps<typeof InventoryWorkspace>, "searchParams">) {
  return <InventoryWorkspace searchParams={searchParams} menuSettings />;
}
