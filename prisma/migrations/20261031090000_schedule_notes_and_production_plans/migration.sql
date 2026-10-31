-- Additive only: existing test data and fixed products are retained.
CREATE TABLE "schedule_area_notes" (
 "id" TEXT PRIMARY KEY,"areaId" TEXT NOT NULL,"startDate" DATE NOT NULL,"endDate" DATE NOT NULL,
 "note" VARCHAR(500) NOT NULL DEFAULT '',"updatedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "schedule_area_notes_period_check" CHECK("endDate">="startDate" AND "endDate"-"startDate"<=30),
 CONSTRAINT "schedule_area_notes_areaId_fkey" FOREIGN KEY("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "schedule_area_notes_updatedById_fkey" FOREIGN KEY("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "schedule_area_notes_areaId_startDate_endDate_key" ON "schedule_area_notes"("areaId","startDate","endDate");
CREATE INDEX "schedule_area_notes_startDate_endDate_idx" ON "schedule_area_notes"("startDate","endDate");
CREATE TABLE "production_plans" (
 "id" TEXT PRIMARY KEY,"postingKey" TEXT NOT NULL,"requestHash" TEXT NOT NULL,"itemId" TEXT NOT NULL,"date" DATE NOT NULL,
 "quantity" DECIMAL(18,3) NOT NULL,"notes" VARCHAR(2000) NOT NULL DEFAULT '',"status" TEXT NOT NULL DEFAULT 'PLANNED',
 "operationId" TEXT,"createdById" TEXT NOT NULL,"updatedById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "production_plans_quantity_check" CHECK("quantity">0 AND "quantity"<=1000000000),
 CONSTRAINT "production_plans_status_check" CHECK("status" IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
 CONSTRAINT "production_plans_completion_check" CHECK("status"<>'COMPLETED' OR "operationId" IS NOT NULL),
 CONSTRAINT "production_plans_itemId_fkey" FOREIGN KEY("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "production_plans_operationId_fkey" FOREIGN KEY("operationId") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "production_plans_createdById_fkey" FOREIGN KEY("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "production_plans_updatedById_fkey" FOREIGN KEY("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "production_plans_postingKey_key" ON "production_plans"("postingKey");
CREATE UNIQUE INDEX "production_plans_operationId_key" ON "production_plans"("operationId");
CREATE INDEX "production_plans_date_status_idx" ON "production_plans"("date","status");
ALTER TABLE "schedule_area_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_plans" ENABLE ROW LEVEL SECURITY;
