
CREATE TABLE "financial_accounts" (
 "id" TEXT PRIMARY KEY, "code" VARCHAR(30) NOT NULL UNIQUE, "name" VARCHAR(120) NOT NULL, "kind" VARCHAR(20) NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "financial_accounts_kind" CHECK ("kind" IN ('ASET','KEWAJIBAN','MODAL','PENDAPATAN','BEBAN'))
);
CREATE TABLE "journal_transactions" (
 "id" TEXT PRIMARY KEY, "postingKey" VARCHAR(36) NOT NULL UNIQUE, "date" DATE NOT NULL,
 "sourceAccountId" TEXT NOT NULL REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
 "targetAccountId" TEXT NOT NULL REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
 "sourceCode" VARCHAR(30) NOT NULL, "sourceName" VARCHAR(120) NOT NULL,
 "targetCode" VARCHAR(30) NOT NULL, "targetName" VARCHAR(120) NOT NULL,
 "sourceSide" VARCHAR(6) NOT NULL, "amount" INTEGER NOT NULL, "notes" VARCHAR(2000) NOT NULL,
 "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "journal_amount_positive" CHECK ("amount" BETWEEN 1 AND 1000000000),
 CONSTRAINT "journal_different_accounts" CHECK ("sourceAccountId" <> "targetAccountId"),
 CONSTRAINT "journal_source_side" CHECK ("sourceSide" IN ('DEBIT','CREDIT'))
);
CREATE INDEX "journal_transactions_date_createdAt_idx" ON "journal_transactions"("date","createdAt");
CREATE INDEX "journal_transactions_sourceAccountId_date_idx" ON "journal_transactions"("sourceAccountId","date");
CREATE INDEX "journal_transactions_targetAccountId_date_idx" ON "journal_transactions"("targetAccountId","date");
