-- Extend the existing kind constraint without reclassifying any stored record.
BEGIN;
ALTER TABLE "inventory_items" DROP CONSTRAINT "inventory_item_kind_check";
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_item_kind_check" CHECK (kind IN ('RAW','PRODUCT','SUB','FINISHED'));
COMMIT;
