-- AlterTable
ALTER TABLE "outlets" ADD COLUMN     "dailyRate" INTEGER,
ADD COLUMN     "operatingHours" JSONB;

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "outletDailyRate" INTEGER;
