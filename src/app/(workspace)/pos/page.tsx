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
  const receiptTemplates = await loadReceiptTemplates();
  const db = getPrisma(),
    today = todayWib(),
    canManage = hasPermission(user, "monitoring-outlet"),
    account = await db.user.findUnique({ where: { id: user.id }, select: { employeeId: true } });
  const assignments = await db.schedule.findMany({
    where: {
      date: parseCivilDate(today),
      status: "KERJA",
      ...(!canManage ? { employeeId: account?.employeeId || "NONE" } : {}),
    },
    select: { outletId: true, employeeId: true },
  });
  const masters = await db.outlet.findMany({
    where: {
      active: true,
      closed: false,
      area: { active: true },
      ...(!canManage
        ? { id: { in: assignments.map((a) => a.outletId).filter((id): id is string => !!id) } }
        : {}),
    },
    select: { id: true, name: true, area: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const outlets = masters.map((o) => ({ id: o.id, name: o.name, areaName: o.area.name }));
  const employees = await db.employee.findMany({
      where: { active: true, ...(!canManage ? { id: account?.employeeId || "NONE" } : {}) },
    }),
    crews = employees.filter(canRecordOutletCrew).map((e) => ({
      id: e.id,
      name: e.fullName + (e.employeeCode ? " · " + e.employeeCode : ""),
      outletIds: assignments
        .filter((a) => a.employeeId === e.id)
        .map((a) => a.outletId)
        .filter((id): id is string => !!id),
    }));
  const catalog = await loadPosCatalog(db);
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
        employeeId={account?.employeeId || undefined}
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
