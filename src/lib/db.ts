import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const modelNames = Object.values(Prisma.ModelName).sort();
// Include pool settings in the cache key so hot reload replaces old connections.
const modelKey = ["pool-v4-joins", ...modelNames].join("|");
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaModelKey?: string;
};

export function getPrisma() {
  const cached = globalForPrisma.prisma;
  const hasCurrentModels =
    cached &&
    modelNames.every((name) => {
      const delegate = name.charAt(0).toLowerCase() + name.slice(1);
      return delegate in cached;
    });
  if (cached && globalForPrisma.prismaModelKey === modelKey && hasCurrentModels) {
    return cached;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const adapter = new PrismaPg({
    connectionString,
    // Bound concurrency for independent dashboard reads; avoid serial queueing across regions.
    max: 10,
    // Local cold starts and memory pressure can delay connection establishment.
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 120_000,
    maxLifetimeSeconds: 900,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  const prisma = new PrismaClient({ adapter });
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaModelKey = modelKey;
  // Hot reload can preserve a client created before new models were generated.
  if (cached) void cached.$disconnect().catch(() => undefined);
  return prisma;
}
