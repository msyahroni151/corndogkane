import { loadPosCatalog } from "@/lib/pos-catalog";
import { getPrisma } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { PosOpenTransactions } from "@/components/pos-open-transactions";
export default async function DraftPage() {
  const user = await requireAccess("pos");
  await requireAccess("open-transaction");
  return (
    <PosOpenTransactions userId={user.id} canResume catalog={await loadPosCatalog(getPrisma())} />
  );
}
