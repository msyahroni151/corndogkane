import "server-only";
import type { Prisma } from "@/generated/prisma/client";
export async function revokeAuthentication(
  tx: Prisma.TransactionClient,
  where: Prisma.UserWhereInput,
) {
  await tx.session.deleteMany({ where: { user: where } });
  await tx.mfaChallenge.deleteMany({ where: { user: where } });
}
