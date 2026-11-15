import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { parseSalesCsv, type SalesCsvRow } from "@/lib/outlet-sales-csv";
import { getPrisma } from "@/lib/db";
import {
  canImportOutletCrew,
  operationalPayments,
  operationalProducts,
  snapshotItems,
} from "@/lib/outlet-operations";
import { InputError, saveOutletOperation } from "@/lib/outlet-operation-write";
import { BonusSyncError } from "@/lib/outlet-bonus-ledger";
import { SaleError } from "@/lib/sale-input";
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
  updateExisting?: boolean;
};
export async function prepareSalesImport(
  db: LookupDb,
  csv: string,
  options: HistoricalImportOptions = {},
) {
  const parsed = parseSalesCsv(csv, options.updateExisting),
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
        select: {
          id: true,
          outletId: true,
          date: true,
          updatedAt: true,
          crewId: true,
          trainingCrewName: true,
          doughUsed: true,
          expenseAmount: true,
          expenseNotes: true,
          cashReceived: true,
          items: true,
          qris: true,
          gofood: true,
          grabfood: true,
          shopeefood: true,
          salesSource: true,
          salesPending: true,
          _count: { select: { sales: true } },
        },
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
  const existingByDay = new Map(
    existing.map((r) => [r.outletId + "|" + r.date.toISOString().slice(0, 10), r]),
  );
  const dailyStatuses = new Map(
    closures.map((r) => [r.outletId + "|" + r.date.toISOString().slice(0, 10), r]),
  );
  const fresh: ResolvedSalesCsvRow[] = [];
  const revisions: { row: ResolvedSalesCsvRow; version: string; crewId: string }[] = [];
  const preview = rows
    .map((row) => {
      const identity = row.outletId + "|" + row.date;
      const prior = existingByDay.get(identity);
      const daily = dailyStatuses.get(identity);
      let status = "Dilewati: sudah tercatat";
      if (!prior && !(daily && (daily.closed || row.operationalStatus === "TUTUP"))) {
        fresh.push(row);
        status = "Baru";
      } else if (options.updateExisting) {
        if (daily?.closed || row.operationalStatus === "TUTUP") {
          status = "Dilewati: status tutup";
        } else if (
          prior &&
          (prior._count.sales || prior.salesPending || prior.salesSource !== "MANUAL")
        ) {
          status = "Dilewati: terhubung ke POS atau rekonsiliasi";
        } else if (prior) {
          const items = snapshotItems(prior.items);
          const unchanged =
            row.crewId === prior.crewId &&
            row.trainingCrewName === prior.trainingCrewName &&
            row.doughUsed === prior.doughUsed &&
            row.expenseAmount === prior.expenseAmount &&
            row.expenseNotes === prior.expenseNotes &&
            row.cashReceived === prior.cashReceived &&
            operationalPayments.every(({ key }) => row[key] === prior[key]) &&
            operationalProducts.every(
              ({ key }) =>
                row.quantities[key] === items[key].quantity &&
                row.unitPrices[key] === items[key].unitPrice,
            );
          if (unchanged) status = "Dilewati: tidak ada perubahan";
          else {
            revisions.push({ row, version: prior.updatedAt.toISOString(), crewId: prior.crewId });
            status = "Akan diperbarui";
          }
        }
      }
      return {
        row: row.row,
        date: row.date,
        outlet: row.outletName,
        crew: row.crewName,
        operationalStatus: row.operationalStatus,
        total: row.totalGross,
        status,
      };
    })
    .concat(parsed.nonManual)
    .sort((a, b) => a.row - b.row);
  return {
    rows,
    fresh,
    errors: errors.sort((a, b) => a.row - b.row),
    revisions,
    skipped: preview.length - fresh.length - revisions.length,
    preview,
    version: options.updateExisting
      ? createHash("sha256")
          .update(JSON.stringify([csv, fresh, revisions, preview]))
          .digest("hex")
      : undefined,
  };
}
export async function importSalesCsv(
  csv: string,
  userId: string,
  options: HistoricalImportOptions = {},
  previewVersion?: string,
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
      if (options.updateExisting && (!previewVersion || current.version !== previewVersion))
        throw new InputError(
          "Data berubah sejak pratinjau. Klik Periksa CSV lagi sebelum impor.",
          409,
        );
      const employees = [
        ...new Set(
          [
            ...current.fresh.map((row) => row.crewId),
            ...current.revisions.flatMap(({ row, crewId }) => [row.crewId, crewId]),
          ].filter(Boolean),
        ),
      ].sort();
      if (employees.length)
        await tx.$executeRaw`SELECT id FROM employees WHERE id IN (${Prisma.join(employees)}) ORDER BY id FOR UPDATE`;
      await writeSalesImportBatch(tx, current.fresh, userId, options);
      for (const { row, version } of current.revisions) {
        try {
          await saveOutletOperation({ ...row, version }, userId, tx, {
            ...options,
            allowInactiveCrew: true,
            reviseManualCsv: true,
          });
        } catch (error) {
          if (
            error instanceof InputError ||
            error instanceof BonusSyncError ||
            error instanceof SaleError
          )
            throw new InputError(
              `Baris ${row.row} (${row.outletName}, ${row.date}): ${error.message}`,
              409,
            );
          throw error;
        }
      }
      return {
        imported: current.fresh.length,
        updated: current.revisions.length,
        skipped: current.skipped,
      };
    },
    { timeout: 120000, maxWait: 10000 },
  );
}
