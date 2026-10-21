CREATE TABLE "inventory_items" (
 "id" TEXT PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
 "packagingUnit" TEXT NOT NULL DEFAULT 'PCS', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "goods_receipts" (
 "id" TEXT PRIMARY KEY, "postingKey" TEXT NOT NULL UNIQUE, "requestHash" TEXT NOT NULL,
 "date" DATE NOT NULL, "supplierId" TEXT REFERENCES "partners"("id") ON DELETE RESTRICT,
 "supplierName" TEXT, "paymentMethod" TEXT NOT NULL CHECK ("paymentMethod" IN ('TUNAI','TRANSFER','HUTANG','COD')),
 "paid" BOOLEAN NOT NULL, "porterFee" INTEGER NOT NULL DEFAULT 0 CHECK ("porterFee">=0),
 "total" INTEGER NOT NULL CHECK ("total">=0 AND "total"<=1000000000), "notes" TEXT,
 "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "goods_receipts_date_paid_idx" ON "goods_receipts"("date","paid");
CREATE INDEX "goods_receipts_supplierId_idx" ON "goods_receipts"("supplierId");
CREATE TABLE "goods_receipt_lines" (
 "id" TEXT PRIMARY KEY, "receiptId" TEXT NOT NULL REFERENCES "goods_receipts"("id") ON DELETE RESTRICT,
 "itemId" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT, "itemName" TEXT NOT NULL,
 "packCount" DECIMAL(18,3) NOT NULL CHECK ("packCount">0), "packagingUnit" TEXT NOT NULL,
 "quantityPerPack" DECIMAL(18,3) NOT NULL CHECK ("quantityPerPack">0), "inputUnit" TEXT NOT NULL,
 "quantity" DECIMAL(18,3) NOT NULL CHECK ("quantity">0),
 "baseUnit" TEXT NOT NULL CHECK ("baseUnit" IN ('PCS','GRAM','ML')), "amount" INTEGER NOT NULL CHECK ("amount">=0));
CREATE INDEX "goods_receipt_lines_itemId_baseUnit_idx" ON "goods_receipt_lines"("itemId","baseUnit");
CREATE INDEX "goods_receipt_lines_receiptId_idx" ON "goods_receipt_lines"("receiptId");
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0001', 'MOZARELLA', 'Mozarella', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0002', 'MIX', 'Mix', 'PCS');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0003', 'SOSIS', 'Sosis', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0004', 'BENG-BENG', 'Beng-beng', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0005', 'TEPUNG TERIGU', 'Tepung Terigu', 'KARUNG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0006', 'KENTANG', 'Kentang', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0007', 'TEPUNG PANIR', 'Tepung Panir', 'KARUNG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0008', 'CRUMBLE', 'Crumble', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0009', 'MIE', 'Mie', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0010', 'GLAZE COKLAT', 'Glaze Coklat', 'PILE 5 KG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0011', 'GLAZE TIRAMISU', 'Glaze Tiramisu', 'PILE 5 KG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0012', 'GLAZE GREENTEA', 'Glaze Greentea', 'PILE 5 KG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0013', 'GLAZE VANILLA', 'Glaze Vanilla', 'PILE 5 KG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0014', 'GLAZE STRAWBERRY', 'Glaze Strawberry', 'PILE 5 KG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0015', 'GLAZE TARO', 'Glaze Taro', 'PILE 5 KG');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0016', 'CUP', 'Cup', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0017', 'TUTUP CUP', 'Tutup Cup', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0018', 'KRESEK KECIL', 'Kresek Kecil', 'IKET');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0019', 'KRESEK SEDANG', 'Kresek Sedang', 'IKET');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0020', 'KRESEK BESAR', 'Kresek Besar', 'IKET');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0021', 'DUS', 'Dus', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0022', 'MINYAK', 'Minyak', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0023', 'TISU', 'Tisu', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0024', 'CLING', 'Cling', 'POUCH');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0025', 'HANDGLOVE', 'Handglove', 'PACK');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0026', 'SAOS CABE', 'Saos Cabe', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0027', 'SAOS TOMAT', 'Saos Tomat', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0028', 'SAOS LAVA', 'Saos Lava', 'POUCH');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0029', 'SAOS MAYONAISE', 'Saos Mayonaise', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0030', 'SAOS KEJU', 'Saos Keju', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0031', 'ZIPLOCK', 'Ziplock', 'PCS');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0032', 'TUSUK SATE', 'Tusuk Sate', 'KARTON');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0033', 'CORNFLAKES', 'Cornflakes', 'PCS');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0034', 'NORI', 'Nori', 'PACK');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0035', 'KATSUOBUSHI', 'Katsuobushi', 'PACK');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0036', 'CHILI POWDER', 'Chili Powder', 'PACK');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0037', 'LAP TANGAN', 'Lap Tangan', 'PCS');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0038', 'LAP MEJA', 'Lap Meja', 'PCS');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0039', 'ES BATU', 'Es Batu', 'PCS');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0040', 'KORAN', 'Koran', 'PCS');
INSERT INTO "inventory_items" ("id","key","name","packagingUnit") VALUES ('ITEM-0041', 'PARMIFAN', 'Parmifan', 'PACK');
