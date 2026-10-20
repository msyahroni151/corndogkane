import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { MasterQuery } from "@/components/master-page";
export default async function LegacyMaster({
  searchParams,
}: {
  searchParams: Promise<MasterQuery>;
}) {
  await requireUser();
  const query = await searchParams;
  const base = query.editOutlet || query.tersimpan === "outlet" ? "/master-outlet" : "/master-area";
  const params = new URLSearchParams();
  for (const key of ["q", "editArea", "editOutlet", "tersimpan"] as const)
    if (typeof query[key] === "string") params.set(key, query[key]);
  redirect(base + (params.size ? "?" + params.toString() : ""));
}
