import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { parseCivilDate } from "@/lib/placements";
export class ProductionPlanError extends Error {}
export type PlanInput = {
  id?: string;
  version?: string;
  postingKey: string;
  itemId: string;
  date: string;
  quantity: string;
  notes: string;
};
export async function saveProductionPlan(db: PrismaClient, actorId: string, input: PlanInput) {
  const date = parseCivilDate(input.date);
  let quantity: Prisma.Decimal;
  try {
    quantity = new Prisma.Decimal(input.quantity);
  } catch {
    throw new ProductionPlanError("Jumlah rencana tidak valid.");
  }
  if (
    !quantity.isFinite() ||
    quantity.lte(0) ||
    quantity.gt(1000000000) ||
    quantity.decimalPlaces() > 3
  )
    throw new ProductionPlanError("Jumlah harus positif, maksimal tiga angka desimal.");
  if (
    input.notes.length > 2000 ||
    !input.itemId ||
    (!input.id && !/^[a-f0-9-]{36}$/i.test(input.postingKey))
  )
    throw new ProductionPlanError("Data rencana belum lengkap.");
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        actorId,
        itemId: input.itemId,
        date: input.date,
        quantity: quantity.toString(),
        notes: input.notes,
      }),
    )
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"production-plans"}))`;
      if (!input.id) {
        const old = await tx.productionPlan.findUnique({ where: { postingKey: input.postingKey } });
        if (old) {
          if (old.requestHash !== hash)
            throw new ProductionPlanError("Kunci rencana sudah digunakan untuk data lain.");
          return old;
        }
      }
      const item = await tx.inventoryItem.findUnique({
        where: { id: input.itemId },
        select: { kind: true, active: true },
      });
      if (!item?.active || !["SUB", "FINISHED"].includes(item.kind))
        throw new ProductionPlanError(
          "Pilih bahan setengah jadi atau bahan jadi gudang yang aktif.",
        );
      if (input.id) {
        const version = new Date(input.version || "");
        if (!Number.isFinite(version.getTime()))
          throw new ProductionPlanError("Versi rencana tidak valid.");
        const changed = await tx.productionPlan.updateMany({
          where: { id: input.id, updatedAt: version, status: "PLANNED" },
          data: { itemId: input.itemId, date, quantity, notes: input.notes, updatedById: actorId },
        });
        if (!changed.count)
          throw new ProductionPlanError(
            "Rencana berubah atau sudah diproses. Buka ulang sebelum mengedit.",
          );
        return tx.productionPlan.findUniqueOrThrow({ where: { id: input.id } });
      }
      return tx.productionPlan.create({
        data: {
          postingKey: input.postingKey,
          requestHash: hash,
          itemId: input.itemId,
          date,
          quantity,
          notes: input.notes,
          createdById: actorId,
          updatedById: actorId,
        },
      });
    },
    { timeout: 20000 },
  );
}
export async function changeProductionPlan(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: string,
  intent: string,
) {
  if (!["START", "CANCEL"].includes(intent) || !Number.isFinite(new Date(version).getTime()))
    throw new ProductionPlanError("Tindakan rencana tidak valid.");
  const result = await db.productionPlan.updateMany({
    where: {
      id,
      updatedAt: new Date(version),
      status: { in: intent === "START" ? ["PLANNED"] : ["PLANNED", "IN_PROGRESS"] },
    },
    data: { status: intent === "START" ? "IN_PROGRESS" : "CANCELLED", updatedById: actorId },
  });
  if (!result.count)
    throw new ProductionPlanError("Rencana sudah berubah atau selesai. Muat ulang daftar rencana.");
}
