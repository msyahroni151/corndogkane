import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { parseSalesCsv, type SalesCsvRow } from "@/lib/outlet-sales-csv";
import { getPrisma } from "@/lib/db";
import { canImportOutletCrew } from "@/lib/outlet-operations";
import { InputError } from "@/lib/outlet-operation-write";
import { writeSalesImportBatch } from "@/lib/outlet-sales-csv-write";
export type ResolvedSalesCsvRow = SalesCsvRow & {
  outletId: string;
  crewId: string;
  outletName: string;
  crewName: string;
};
type LookupDb = PrismaClient | Prisma.TransactionClient;
const key = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleUpperCase("id-ID");
function match<T extends { id: string }>(
  items: T[],
  value: string,
  code: (item: T) => string | null,
  name: (item: T) => string,
  label: string,
  field: "name" | "code" | "legacy" = "legacy",
): T {
  const exact = field === "legacy" ? items.find((item) => item.id === value) : undefined;
  if (exact) return exact;
  const reference = key(value);
  const codes = field === "name" ? [] : items.filter((item) => key(code(item) ?? "") === reference);
  const found =
    field === "code" || codes.length
      ? codes
      : items.filter((item) => key(name(item)) === reference);
  if (found.length !== 1)
    throw Error(
      found.length
        ? label + " ambigu. Gunakan ID atau kode dari Referensi Outlet & Crew."
        : label + " tidak ditemukan atau tidak memenuhi syarat: " + value + ".",
    );
  return found[0];
}
export type HistoricalImportOptions = {
  historicalCrewIds?: ReadonlySet<string>;
  historicalOutletIds?: ReadonlySet<string>;
};
export async function prepareSalesImport(
  db: LookupDb,
  csv: string,
  options: HistoricalImportOptions = {},
) {
  const parsed = parseSalesCsv(csv),
    errors = [...parsed.errors];
  const [outlets, employees] = await Promise.all([
    db.outlet.findMany({
      where: {
        OR: [
          { active: true, closed: false, area: { active: true } },
          { id: { in: [...(options.historicalOutletIds || [])] } },
        ],
      },
      select: { id: true, name: true, nameCode: true },
    }),
    db.employee.findMany({
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        active: true,
        department: true,
        position: true,
      },
    }),
  ]);
  const crew = employees.filter(
      (employee) =>
        canImportOutletCrew(employee) ||
        (!!employee.employeeCode?.trim() && options.historicalCrewIds?.has(employee.id)),
    ),
    rows: ResolvedSalesCsvRow[] = [],
    seen = new Set<string>();
  for (const row of parsed.rows)
    try {
      const outlet = match(
          outlets,
          row.outlet,
          (o) => o.nameCode,
          (o) => o.name,
          "Outlet",
          row.outletByName ? "name" : "legacy",
        ),
        employee =
          row.operationalStatus === "TUTUP"
            ? null
            : match(
                crew,
                row.crew,
                (e) => e.employeeCode,
                (e) => e.fullName,
                "Crew",
                row.crewByCode ? "code" : "legacy",
              );
      const identity = outlet.id + "|" + row.date;
      if (seen.has(identity)) throw Error("Outlet dan tanggal berulang di dalam file.");
      seen.add(identity);
      rows.push({
        ...row,
        outletId: outlet.id,
        crewId: employee?.id || "",
        outletName: outlet.name,
        crewName: employee
          ? (employee.employeeCode || employee.fullName) + (employee.active ? "" : " (nonaktif)")
          : "Tidak bertugas",
      });
    } catch (error) {
      errors.push({
        row: row.row,
        message: error instanceof Error ? error.message : "Referensi tidak valid.",
      });
    }
  const existing = rows.length
    ? await db.outletOperation.findMany({
        where: {
          OR: rows.map((row) => ({
            outletId: row.outletId,
            date: new Date(row.date + "T00:00:00Z"),
          })),
        },
        select: { outletId: true, date: true },
      })
    : [];
  const closures = rows.length
    ? await db.outletDailyStatus.findMany({
        where: {
          OR: rows.map((row) => ({
            outletId: row.outletId,
            date: new Date(row.date + "T00:00:00Z"),
          })),
        },
        select: { outletId: true, date: true, closed: true },
      })
    : [];
  const occupied = new Set(
    existing.map((r) => r.outletId + "|" + r.date.toISOString().slice(0, 10)),
  );
  const dailyStatuses = new Map(
    closures.map((r) => [r.outletId + "|" + r.date.toISOString().slice(0, 10), r]),
  );
  for (const row of rows) {
    const identity = row.outletId + "|" + row.date;
    const daily = dailyStatuses.get(identity);
    // Reimporting an old file must never close a day an admin has explicitly reopened.
    if (daily && (daily.closed || row.operationalStatus === "TUTUP")) occupied.add(identity);
  }
  const fresh = rows.filter((row) => !occupied.has(row.outletId + "|" + row.date));
  return {
    rows,
    fresh,
    errors: errors.sort((a, b) => a.row - b.row),
    skipped: rows.length - fresh.length,
    preview: rows.map((row) => ({
      row: row.row,
      date: row.date,
      outlet: row.outletName,
      crew: row.crewName,
      operationalStatus: row.operationalStatus,
      total: row.totalGross,
      status: occupied.has(row.outletId + "|" + row.date) ? "Dilewati: sudah tercatat" : "Baru",
    })),
  };
}
export async function importSalesCsv(
  csv: string,
  userId: string,
  options: HistoricalImportOptions = {},
) {
  return getPrisma().$transaction(
    async (tx) => {
      const plan = await prepareSalesImport(tx, csv, options);
      if (plan.errors.length)
        throw new InputError("CSV masih memiliki kesalahan. Periksa pratinjau sebelum impor.");
      // Match the manual/POS writer's lock; an import can never overwrite a concurrent save.
      const identities = plan.rows.map((row) => row.outletId + "|" + row.date).sort();
      if (identities.length)
        await tx.$executeRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(lock_key,0))
          FROM (SELECT lock_key FROM (VALUES ${Prisma.join(identities.map((id) => Prisma.sql`(${id})`))}) AS keys(lock_key) ORDER BY lock_key) AS ordered_locks
        `);
      const current = await prepareSalesImport(tx, csv, options);
      if (current.errors.length)
        throw new InputError("Referensi berubah saat impor. Periksa pratinjau kembali.");
      const employees = [...new Set(current.fresh.map((row) => row.crewId).filter(Boolean))].sort();
      if (employees.length)
        await tx.$executeRaw`SELECT id FROM employees WHERE id IN (${Prisma.join(employees)}) ORDER BY id FOR UPDATE`;
      await writeSalesImportBatch(tx, current.fresh, userId, options);
      return { imported: current.fresh.length, skipped: current.skipped };
    },
    { timeout: 120000, maxWait: 10000 },
  );
}
