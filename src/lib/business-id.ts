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
  const [reserved] = await tx.$queryRaw<{ value: number }[]>(Prisma.sql`
    WITH highest_id AS (
      SELECT COALESCE(MAX(regexp_replace(id, ${"^" + format.prefix + "-(WEB-)?"}, '')::bigint),0) AS value
      FROM ${Prisma.raw(format.table)} WHERE id ~ ${"^" + format.prefix + "-(WEB-)?[0-9]+$"}
    ), previous_counters AS (
      SELECT COALESCE(MAX(value),0) AS value FROM sequence_counters
      WHERE name IN (${Prisma.join([format.counter, ...format.legacy])})
    )
    INSERT INTO sequence_counters(name,value)
    SELECT ${format.counter},GREATEST(highest_id.value,previous_counters.value)+1
    FROM highest_id,previous_counters
    ON CONFLICT(name) DO UPDATE SET value=GREATEST(sequence_counters.value,EXCLUDED.value-1)+1
    RETURNING value
  `);
  const next = reserved?.value;
  if (!Number.isSafeInteger(next) || next > 2147483647)
    throw new Error("Urutan ID sudah mencapai batas.");
  return format.prefix + "-" + String(next).padStart(5, "0");
}
