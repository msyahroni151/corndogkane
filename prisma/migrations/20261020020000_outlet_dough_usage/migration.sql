ALTER TABLE "outlet_operations" ADD COLUMN "doughUsed" INTEGER;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_dough_used_check" CHECK ("doughUsed" IS NULL OR "doughUsed" BETWEEN 0 AND 10000);
