ALTER TABLE "payrolls" ADD COLUMN "settlementDeduction" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "settlementPayments" JSONB;
CREATE TABLE "settlement_reviews" (
 "id" TEXT PRIMARY KEY, "operationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
 "employeeName" TEXT NOT NULL, "outletName" TEXT NOT NULL, "date" DATE NOT NULL,
 "expectedCash" INTEGER NOT NULL, "receivedCash" INTEGER NOT NULL, "amount" INTEGER NOT NULL,
 "sourceVersion" TEXT NOT NULL, "status" "MoneyStatus" NOT NULL, "notes" TEXT NOT NULL,
 "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "settlement_reviews_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "outlet_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "settlement_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "settlement_reviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "settlement_reviews_amount_check" CHECK ("receivedCash">=0 AND "status" IN ('APPROVED','REJECTED') AND "amount"=CASE WHEN "status"='APPROVED' THEN GREATEST("expectedCash"-"receivedCash",0) ELSE 0 END)
);
CREATE INDEX "settlement_reviews_operationId_createdAt_idx" ON "settlement_reviews"("operationId","createdAt");
CREATE INDEX "settlement_reviews_employeeId_status_date_idx" ON "settlement_reviews"("employeeId","status","date");
CREATE UNIQUE INDEX "settlement_reviews_one_approval" ON "settlement_reviews"("operationId") WHERE "status"='APPROVED';
CREATE TABLE "settlement_deductions" (
 "id" TEXT PRIMARY KEY, "reviewId" TEXT NOT NULL, "payrollId" TEXT NOT NULL, "amount" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "settlement_deductions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "settlement_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "settlement_deductions_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "settlement_deductions_amount_check" CHECK ("amount">0)
);
CREATE UNIQUE INDEX "settlement_deductions_payrollId_reviewId_key" ON "settlement_deductions"("payrollId","reviewId");
CREATE INDEX "settlement_deductions_reviewId_idx" ON "settlement_deductions"("reviewId");
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_settlement_deduction_check" CHECK ("settlementDeduction">=0);
