-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'SETENGAH_HARI', 'IZIN', 'SAKIT', 'ALPA');

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'HADIR',
    "checkInMinutes" INTEGER,
    "checkOutMinutes" INTEGER,
    "checkInNextDay" BOOLEAN NOT NULL DEFAULT false,
    "checkOutNextDay" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_scheduleId_key" ON "attendance"("scheduleId");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
