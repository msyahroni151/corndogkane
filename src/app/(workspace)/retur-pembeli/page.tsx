import { requireAccess } from "@/lib/auth";
import { PosReturnsPreview } from "@/components/pos-returns-preview";
export default async function ReturnsPage() {
  await requireAccess("retur-pembeli");
  return <PosReturnsPreview />;
}
