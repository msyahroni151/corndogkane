-- CreateEnum
CREATE TYPE "MoneyKind" AS ENUM ('LOAN', 'REPAYMENT', 'BONUS_EARNED', 'BONUS_WITHDRAWAL');

-- CreateEnum
CREATE TYPE "MoneyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "money_entries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "MoneyKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "status" "MoneyStatus" NOT NULL DEFAULT 'PENDING',
    "sourceId" TEXT,
    "createdById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "money_entries_employeeId_status_date_idx" ON "money_entries"("employeeId", "status", "date");

-- CreateIndex
CREATE INDEX "money_entries_sourceId_status_idx" ON "money_entries"("sourceId", "status");

-- AddForeignKey
ALTER TABLE "money_entries" ADD CONSTRAINT "money_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_entries" ADD CONSTRAINT "money_entries_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "money_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_entries" ADD CONSTRAINT "money_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_entries" ADD CONSTRAINT "money_entries_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
