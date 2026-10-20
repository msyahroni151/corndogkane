import type { Prisma } from "@/generated/prisma/client";
import { assetInvalid } from "@/lib/fixed-assets";
/** Allocate and persist the code inside the same transaction as the asset and its history. */
export async function allocateAssetCode(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"fixed-asset-code"},0))`;
  const [row] = await tx.$queryRaw<
    { highest: string }[]
  >`SELECT COALESCE(MAX(substring(code from 5)::numeric),0)::text AS highest FROM fixed_assets WHERE code ~ '^AST-[0-9]+$'`;
  const counter = await tx.sequenceCounter.findUnique({ where: { name: "fixed-asset-code" } });
  const highest = BigInt(row.highest),
    reserved = BigInt(counter?.value ?? 0),
    next = (highest > reserved ? highest : reserved) + BigInt(1);
  if (next > BigInt(2147483647))
    assetInvalid("Nomor urut aset sudah mencapai batas. Hubungi pengelola aplikasi.");
  await tx.sequenceCounter.upsert({
    where: { name: "fixed-asset-code" },
    create: { name: "fixed-asset-code", value: Number(next) },
    update: { value: Number(next) },
  });
  return "AST-" + next.toString().padStart(5, "0");
}
