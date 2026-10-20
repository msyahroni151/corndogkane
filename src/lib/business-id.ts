import { Prisma } from "@/generated/prisma/client";

const formats = {
  employee: { table: "employees", prefix: "EMP", counter: "employee", legacy: ["employee-web"] },
  area: { table: "areas", prefix: "BA", counter: "area", legacy: ["area-web"] },
  outlet: { table: "outlets", prefix: "OUT", counter: "outlet", legacy: ["outlet-web"] },
  supplier: { table: "partners", prefix: "SUP", counter: "partner-SUPPLIER", legacy: [] },
  customer: { table: "partners", prefix: "PLG", counter: "partner-CUSTOMER", legacy: [] },
  loan: { table: "money_entries", prefix: "KSB", counter: "loan-entry", legacy: [] },
  bonus: { table: "money_entries", prefix: "BON", counter: "bonus-entry", legacy: [] },
  payroll: { table: "payrolls", prefix: "PYR", counter: "payroll", legacy: [] },
} as const;

/** Reserve in the same transaction as insertion; imported and deleted IDs remain reserved. */
export async function allocateBusinessId(tx: Prisma.TransactionClient, kind: keyof typeof formats) {
  const format = formats[kind];
  if (kind === "employee") await tx.$executeRaw`SELECT pg_advisory_xact_lock(714212)`;
  else
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"business-id:" + format.counter}))`;
  const [latest] = await tx.$queryRaw<{ highest: bigint }[]>(Prisma.sql`
    SELECT COALESCE(MAX(regexp_replace(id, ${"^" + format.prefix + "-(WEB-)?"}, '')::bigint), 0) AS highest
    FROM ${Prisma.raw(format.table)} WHERE id ~ ${"^" + format.prefix + "-(WEB-)?[0-9]+$"}
  `);
  const counters = await tx.sequenceCounter.findMany({
    where: { name: { in: [format.counter, ...format.legacy] } },
  });
  const next = Math.max(Number(latest.highest), 0, ...counters.map((counter) => counter.value)) + 1;
  if (!Number.isSafeInteger(next) || next > 2147483647)
    throw new Error("Urutan ID sudah mencapai batas.");
  await tx.sequenceCounter.upsert({
    where: { name: format.counter },
    create: { name: format.counter, value: next },
    update: { value: next },
  });
  return format.prefix + "-" + String(next).padStart(5, "0");
}
