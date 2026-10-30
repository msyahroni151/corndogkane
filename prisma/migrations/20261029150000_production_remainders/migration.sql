CREATE TABLE "production_remainders" (
 "id" TEXT PRIMARY KEY,
 "sourceBatchId" TEXT NOT NULL REFERENCES "inventory_batches"("id") ON DELETE RESTRICT,
 "stockBatchId" TEXT NOT NULL UNIQUE REFERENCES "inventory_batches"("id") ON DELETE RESTRICT,
 "operationId" TEXT NOT NULL REFERENCES "inventory_operations"("id") ON DELETE RESTRICT,
 "date" DATE NOT NULL,
 "location" TEXT NOT NULL,
 "notes" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "production_remainder_distinct_batches" CHECK ("sourceBatchId" <> "stockBatchId")
);
CREATE INDEX "production_remainders_sourceBatchId_idx" ON "production_remainders"("sourceBatchId");
CREATE INDEX "production_remainders_operationId_idx" ON "production_remainders"("operationId");
CREATE INDEX "production_remainders_date_idx" ON "production_remainders"("date");
