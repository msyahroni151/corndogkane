import { loadReceiptTemplates } from "@/lib/receipt-template-data";
import { hasPermission } from "@/lib/permissions";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { PosCashier } from "@/components/pos-cashier";
import { loadPosCatalog } from "@/lib/pos-catalog";
import { todayWib, parseCivilDate } from "@/lib/placements";
import { canRecordOutletCrew } from "@/lib/outlet-operations";
export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const user = await requireAccess("pos");
  const query = await searchParams;
  const db = getPrisma(),
    today = todayWib(),
    canManage = hasPermission(user, "monitoring-outlet");
  const masterQuery = {
    where: { active: true, closed: false, area: { active: true } },
    select: { id: true, name: true, area: { select: { name: true } } },
    orderBy: { name: "asc" as const },
  };
  const [receiptTemplates, catalog, assignments, allMasters, employees] = await Promise.all([
    loadReceiptTemplates(),
    loadPosCatalog(db),
    db.schedule.findMany({
      where: {
        date: parseCivilDate(today),
        status: "KERJA",
        ...(!canManage ? { employeeId: user.employeeId || "NONE" } : {}),
      },
      select: { outletId: true, employeeId: true },
    }),
    canManage ? db.outlet.findMany(masterQuery) : Promise.resolve([]),
    db.employee.findMany({
      where: { active: true, ...(!canManage ? { id: user.employeeId || "NONE" } : {}) },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        active: true,
        department: true,
        position: true,
      },
    }),
  ]);
  const masters = canManage
    ? allMasters
    : await db.outlet.findMany({
        ...masterQuery,
        where: {
          ...masterQuery.where,
          id: { in: assignments.map((a) => a.outletId).filter((id): id is string => !!id) },
        },
      });
  const outlets = masters.map((o) => ({ id: o.id, name: o.name, areaName: o.area.name }));
  const crews = employees.filter(canRecordOutletCrew).map((e) => ({
    id: e.id,
    name: e.fullName + (e.employeeCode ? " · " + e.employeeCode : ""),
    outletIds: assignments
      .filter((a) => a.employeeId === e.id)
      .map((a) => a.outletId)
      .filter((id): id is string => !!id),
  }));
  const draftId =
    hasPermission(user, "open-transaction") &&
    typeof query.draft === "string" &&
    /^DRAFT-[A-Z0-9-]{1,80}$/.test(query.draft)
      ? query.draft
      : undefined;
  return (
    <>
      <PosCashier
        catalog={catalog}
        crews={crews}
        today={today}
        employeeId={user.employeeId || undefined}
        receiptTemplates={receiptTemplates}
        userId={user.id}
        userName={user.name}
        outlets={outlets}
        draftId={draftId}
        canUseDrafts={hasPermission(user, "open-transaction")}
      />
    </>
  );
}
