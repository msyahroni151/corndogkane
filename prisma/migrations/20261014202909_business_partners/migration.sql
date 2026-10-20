-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('SUPPLIER', 'CUSTOMER');

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "kind" "PartnerKind" NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "businessType" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "outstandingDebt" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partners_kind_name_idx" ON "partners"("kind", "name");

-- CreateIndex
CREATE INDEX "partners_kind_outstandingDebt_idx" ON "partners"("kind", "outstandingDebt");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
