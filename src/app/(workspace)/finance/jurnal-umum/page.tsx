import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
export default async function LegacyExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAccess("finance-expenses");
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["from", "to", "q", "status"])
    if (typeof params[key] === "string") query.set(key, params[key] as string);
  redirect("/finance/pengeluaran-operasional" + (query.size ? "?" + query.toString() : ""));
}
