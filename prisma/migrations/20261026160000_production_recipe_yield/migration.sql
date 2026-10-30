ALTER TABLE "inventory_items" ADD COLUMN "productionYield" DECIMAL(18,3) NOT NULL DEFAULT 1;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_production_yield_check" CHECK ("productionYield" > 0 AND "productionYield" <= 1000000000);
