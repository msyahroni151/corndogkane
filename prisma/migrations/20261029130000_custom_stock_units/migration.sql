ALTER TABLE inventory_items DROP CONSTRAINT inventory_item_unit_check;
ALTER TABLE inventory_items ADD CONSTRAINT inventory_item_unit_check CHECK ("baseUnit" ~ '^[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*$' AND length("baseUnit") <= 24);
ALTER TABLE inventory_batches DROP CONSTRAINT inventory_batch_unit_check;
ALTER TABLE inventory_batches ADD CONSTRAINT inventory_batch_unit_check CHECK ("baseUnit" ~ '^[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*$' AND length("baseUnit") <= 24);
ALTER TABLE inventory_recipes DROP CONSTRAINT inventory_recipe_positive_check;
ALTER TABLE inventory_recipes ADD CONSTRAINT inventory_recipe_positive_check CHECK (quantity > 0 AND "baseUnit" ~ '^[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*$' AND length("baseUnit") <= 24);
ALTER TABLE goods_receipt_lines DROP CONSTRAINT "goods_receipt_lines_baseUnit_check";
ALTER TABLE goods_receipt_lines ADD CONSTRAINT "goods_receipt_lines_baseUnit_check" CHECK ("baseUnit" ~ '^[A-Z][A-Z0-9]*(?:[ -][A-Z0-9]+)*$' AND length("baseUnit") <= 24);
