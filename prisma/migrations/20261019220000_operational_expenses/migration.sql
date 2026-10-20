
CREATE TABLE "operational_expenses" (
 "id" TEXT PRIMARY KEY, "postingKey" VARCHAR(36) NOT NULL UNIQUE, "requestHash" VARCHAR(64) NOT NULL,
 "date" DATE NOT NULL, "expenseAccountId" TEXT NOT NULL REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
 "expenseCode" VARCHAR(30) NOT NULL, "expenseName" VARCHAR(120) NOT NULL, "category" VARCHAR(120) NOT NULL,
 "purpose" VARCHAR(180) NOT NULL, "amount" INTEGER NOT NULL, "paymentMethod" VARCHAR(4) NOT NULL, "status" VARCHAR(6) NOT NULL,
 "paymentAccountId" TEXT REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
 "paymentCode" VARCHAR(30), "paymentName" VARCHAR(120), "paidAt" DATE,
 "notes" VARCHAR(2000) NOT NULL DEFAULT '',
 "journalTransactionId" TEXT UNIQUE REFERENCES "journal_transactions"("id") ON DELETE RESTRICT,
 "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "paidById" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "operational_expense_amount" CHECK ("amount" BETWEEN 1 AND 1000000000),
 CONSTRAINT "operational_expense_method" CHECK ("paymentMethod" IN ('CASH','BANK')),
 CONSTRAINT "operational_expense_status" CHECK ("status" IN ('PAID','UNPAID')),
 CONSTRAINT "operational_expense_paid_fields" CHECK (("status"='UNPAID' AND "paidAt" IS NULL AND "journalTransactionId" IS NULL AND "paidById" IS NULL) OR ("status"='PAID' AND "paidAt" IS NOT NULL AND "journalTransactionId" IS NOT NULL AND "paymentAccountId" IS NOT NULL AND "paidById" IS NOT NULL AND "paidAt">="date")),
 CONSTRAINT "operational_expense_distinct_accounts" CHECK ("paymentAccountId" IS NULL OR "paymentAccountId"<>"expenseAccountId")
);
CREATE INDEX "operational_expenses_date_status_idx" ON "operational_expenses"("date","status");
