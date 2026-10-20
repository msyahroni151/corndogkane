import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
export default async function MasterAccountPage() {
  await requireAccess("master-akun");
  redirect("/finance/laporan-akuntansi?tab=coa");
}
