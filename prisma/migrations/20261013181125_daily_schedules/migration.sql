-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('KERJA', 'LIBUR', 'STANBY');

-- CreateEnum
CREATE TYPE "WarehouseShift" AS ENUM ('S1', 'S2', 'FULL');

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "employeeName" TEXT NOT NULL,
    "role" "OperationalRole" NOT NULL,
    "areaName" TEXT,
    "areaColor" TEXT,
    "outletId" TEXT,
    "outletName" TEXT,
    "location" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'KERJA',
    "shift" "WarehouseShift",
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedules_date_status_idx" ON "schedules"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_employeeId_date_key" ON "schedules"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "placements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
