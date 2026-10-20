import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { readOutletHours } from "@/lib/outlet-settings";
import { APP_TIME_ZONE } from "@/lib/local-date";
import { OutletMonitoringCards } from "@/components/outlet-monitoring-cards";

export default async function OutletMonitoring() {
  await requireAccess("monitoring-outlet");
  const outlets = await getPrisma().outlet.findMany({
    where: { active: true, closed: false },
    select: {
      id: true,
      name: true,
      nameCode: true,
      operatingHours: true,
      area: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  const cards = outlets.map((outlet) => {
    let hours = null;
    try {
      hours = readOutletHours(outlet.operatingHours);
    } catch {
      /* Incomplete master hours need attention. */
    }
    return {
      id: outlet.id,
      name: outlet.name,
      nameCode: outlet.nameCode,
      areaId: outlet.area.id,
      areaName: outlet.area.name,
      hours,
    };
  });
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return <OutletMonitoringCards outlets={cards} today={today} />;
}
