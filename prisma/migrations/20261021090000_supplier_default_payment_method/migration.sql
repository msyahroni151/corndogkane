ALTER TABLE "partners" ADD COLUMN "defaultPaymentMethod" TEXT NOT NULL DEFAULT 'TUNAI';
ALTER TABLE "partners" ADD CONSTRAINT "partners_default_payment_method_check" CHECK ("defaultPaymentMethod" IN ('TUNAI', 'TRANSFER', 'COD'));
