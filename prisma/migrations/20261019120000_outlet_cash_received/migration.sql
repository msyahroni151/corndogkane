ALTER TABLE "outlet_operations" ADD COLUMN "cashReceived" INTEGER;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_cash_received_nonnegative" CHECK ("cashReceived" IS NULL OR "cashReceived" >= 0);
ALTER TABLE "outlet_operations" ADD COLUMN "bonusAmount" INTEGER, ADD COLUMN "bonusDailyRate" INTEGER;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_bonus_nonnegative" CHECK (("bonusAmount" IS NULL OR "bonusAmount" >= 0) AND ("bonusDailyRate" IS NULL OR "bonusDailyRate" >= 0));
