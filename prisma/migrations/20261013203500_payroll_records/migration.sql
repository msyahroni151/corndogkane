-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "money_entries" ADD COLUMN     "payrollId" TEXT,
ADD COLUMN     "postingKey" TEXT;

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "dailyRate" INTEGER NOT NULL,
    "backupRate" INTEGER NOT NULL,
    "paidUnits" DOUBLE PRECISION NOT NULL,
    "standbyDays" INTEGER NOT NULL,
    "basePay" INTEGER NOT NULL,
    "backupPay" INTEGER NOT NULL,
    "standbyPay" INTEGER NOT NULL,
    "warehouseBonus" INTEGER NOT NULL,
    "bonusPaid" INTEGER NOT NULL,
    "lateDeduction" INTEGER NOT NULL,
    "loanDeduction" INTEGER NOT NULL,
    "otherDeduction" INTEGER NOT NULL,
    "netPay" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "sales" JSONB NOT NULL,
    "loanPayments" JSONB NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payrolls_employeeId_startDate_endDate_status_idx" ON "payrolls"("employeeId", "startDate", "endDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "money_entries_postingKey_key" ON "money_entries"("postingKey");

-- AddForeignKey
ALTER TABLE "money_entries" ADD CONSTRAINT "money_entries_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
