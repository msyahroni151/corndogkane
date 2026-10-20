import { hasPermission } from "@/lib/permissions";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { PosCashier } from "@/components/pos-cashier";
import { referenceOutlets } from "@/lib/pos-preview";
export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const user = await requireAccess("pos");
  const query = await searchParams;
  const masters = await getPrisma().outlet.findMany({
    where: { active: true, closed: false, area: { active: true } },
    select: { id: true, name: true, area: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const outlets = masters.length
    ? masters.map((outlet) => ({ id: outlet.id, name: outlet.name, areaName: outlet.area.name }))
    : referenceOutlets.map((name, index) => ({
        id: `REF-${index + 1}`,
        name,
        areaName: "Outlet referensi",
        reference: true,
      }));
  const draftId =
    hasPermission(user, "open-transaction") &&
    typeof query.draft === "string" &&
    /^DRAFT-[A-Z0-9-]{1,80}$/.test(query.draft)
      ? query.draft
      : undefined;
  return (
    <PosCashier
      userId={user.id}
      userName={user.name}
      outlets={outlets}
      draftId={draftId}
      canUseDrafts={hasPermission(user, "open-transaction")}
    />
  );
}
