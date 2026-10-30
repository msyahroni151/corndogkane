UPDATE "inventory_items" SET "category" = 'Persediaan Gudang', "updatedAt" = CURRENT_TIMESTAMP WHERE "kind" IN ('RAW', 'SUB', 'FINISHED') AND "category" <> 'Persediaan Gudang';
