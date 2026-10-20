ALTER TABLE "outlet_operations" ADD COLUMN "expenseAmount" INTEGER, ADD COLUMN "expenseNotes" TEXT;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_expenseAmount_check" CHECK ("expenseAmount" IS NULL OR "expenseAmount" >= 0);
