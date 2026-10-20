CREATE TABLE "outlet_operations" (
 "id" TEXT NOT NULL, "outletId" TEXT NOT NULL, "outletName" TEXT NOT NULL,
 "date" DATE NOT NULL, "crewId" TEXT NOT NULL, "crewName" TEXT NOT NULL,
 "trainingCrewId" TEXT, "trainingCrewName" TEXT, "items" JSONB NOT NULL,
 "totalGross" INTEGER NOT NULL, "qris" INTEGER NOT NULL DEFAULT 0,
 "gofood" INTEGER NOT NULL DEFAULT 0, "grabfood" INTEGER NOT NULL DEFAULT 0,
 "shopeefood" INTEGER NOT NULL DEFAULT 0, "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "outlet_operations_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "outlet_operations_amounts_check" CHECK ("totalGross">=0 AND "qris">=0 AND "gofood">=0 AND "grabfood">=0 AND "shopeefood">=0),
 CONSTRAINT "outlet_operations_crews_check" CHECK ("trainingCrewId" IS NULL OR "trainingCrewId" <> "crewId")
);
CREATE UNIQUE INDEX "outlet_operations_outletId_date_key" ON "outlet_operations"("outletId","date");
CREATE INDEX "outlet_operations_date_idx" ON "outlet_operations"("date");
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_trainingCrewId_fkey" FOREIGN KEY ("trainingCrewId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
