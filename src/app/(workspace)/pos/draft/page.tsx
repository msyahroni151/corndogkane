import { requireAccess } from "@/lib/auth";
import { PosOpenTransactions } from "@/components/pos-open-transactions";
export default async function DraftPage() {
  const user = await requireAccess("pos");
  await requireAccess("open-transaction");
  return <PosOpenTransactions userId={user.id} canResume />;
}
