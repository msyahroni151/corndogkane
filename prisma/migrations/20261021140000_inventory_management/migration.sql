-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "baseUnit" TEXT NOT NULL DEFAULT 'PCS',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Bahan Baku',
ADD COLUMN     "emoji" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'RAW',
ADD COLUMN     "minimumStock" DECIMAL(18,3) NOT NULL DEFAULT 0,
ADD COLUMN     "photo" TEXT,
ADD COLUMN     "sellingPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "standardCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "productionId" TEXT,
    "receivedAt" DATE NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "initialQuantity" DECIMAL(18,3) NOT NULL,
    "remainingQuantity" DECIMAL(18,3) NOT NULL,
    "initialValue" DECIMAL(18,4) NOT NULL,
    "remainingValue" DECIMAL(18,4) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_operations" (
    "id" TEXT NOT NULL,
    "postingKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantityBefore" DECIMAL(18,3) NOT NULL,
    "quantityAfter" DECIMAL(18,3) NOT NULL,
    "valueBefore" DECIMAL(18,4) NOT NULL,
    "valueAfter" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_recipes" (
    "id" TEXT NOT NULL,
    "outputId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "baseUnit" TEXT NOT NULL,

    CONSTRAINT "inventory_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_batches_sourceLineId_key" ON "inventory_batches"("sourceLineId");

-- CreateIndex
CREATE INDEX "inventory_batches_itemId_receivedAt_idx" ON "inventory_batches"("itemId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_operations_postingKey_key" ON "inventory_operations"("postingKey");

-- CreateIndex
CREATE INDEX "inventory_operations_kind_date_idx" ON "inventory_operations"("kind", "date");

-- CreateIndex
CREATE INDEX "inventory_movements_batchId_idx" ON "inventory_movements"("batchId");

-- CreateIndex
CREATE INDEX "inventory_movements_operationId_idx" ON "inventory_movements"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_recipes_outputId_ingredientId_baseUnit_key" ON "inventory_recipes"("outputId", "ingredientId", "baseUnit");

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_sourceLineId_fkey" FOREIGN KEY ("sourceLineId") REFERENCES "goods_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_operations" ADD CONSTRAINT "inventory_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_recipes" ADD CONSTRAINT "inventory_recipes_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_recipes" ADD CONSTRAINT "inventory_recipes_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE inventory_items ADD CONSTRAINT inventory_item_kind_check CHECK (kind IN ('RAW','PRODUCT','SUB'));
ALTER TABLE inventory_items ADD CONSTRAINT inventory_item_unit_check CHECK ("baseUnit" IN ('PCS','GRAM','ML'));
ALTER TABLE inventory_items ADD CONSTRAINT inventory_item_minimum_check CHECK ("minimumStock">=0 AND "sellingPrice">=0 AND "standardCost">=0);
ALTER TABLE inventory_batches ADD CONSTRAINT inventory_batch_nonnegative_check CHECK ("initialQuantity">0 AND "remainingQuantity">=0 AND "initialValue">=0 AND "remainingValue">=0);
ALTER TABLE inventory_batches ADD CONSTRAINT inventory_batch_unit_check CHECK ("baseUnit" IN ('PCS','GRAM','ML'));
ALTER TABLE inventory_recipes ADD CONSTRAINT inventory_recipe_positive_check CHECK (quantity>0 AND "baseUnit" IN ('PCS','GRAM','ML'));
INSERT INTO inventory_batches (id,"itemId","sourceLineId","receivedAt","baseUnit","initialQuantity","remainingQuantity","initialValue","remainingValue","createdAt")
SELECT 'BATCH-'||l.id,l."itemId",l.id,r.date,l."baseUnit",l.quantity,l.quantity,l.amount,l.amount,r."createdAt"
FROM goods_receipt_lines l JOIN goods_receipts r ON r.id=l."receiptId";
UPDATE inventory_items SET category='Saus & Glaze' WHERE name LIKE 'Saos %' OR name LIKE 'Glaze %';
UPDATE inventory_items SET category='Topping' WHERE name IN ('Cornflakes','Katsuobushi','Nori','Chili Powder','Beng-beng','Crumble');
UPDATE inventory_items SET category='Perlengkapan' WHERE name IN ('Cup','Tutup Cup','Kresek Kecil','Kresek Sedang','Kresek Besar','Dus','Tisu','Cling','Handglove','Ziplock','Tusuk Sate','Lap Tangan','Lap Meja','Koran');
INSERT INTO inventory_items (id,key,name,"packagingUnit",kind,category,"baseUnit") VALUES ('SUB-ADONAN-500','ADONAN REPACK 500 GRAM','Adonan Repack 500 gram','PCS','SUB','Adonan','PCS') ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-original','MOZARELLA ORIGINAL','Mozarella Original','PRODUCT','Mozarella','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-crumble','MOZARELLA CRUMBLE','Mozarella Crumble','PRODUCT','Mozarella','PCS',11000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-mie','MOZARELLA MIE','Mozarella Mie','PRODUCT','Mozarella','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-kentang','MOZARELLA KENTANG','Mozarella Kentang','PRODUCT','Mozarella','PCS',13000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-cornflakes','MOZARELLA CORNFLAKES','Mozarella Cornflakes','PRODUCT','Mozarella','PCS',13000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-coklat','MOZARELLA COKLAT','Mozarella Coklat','PRODUCT','Mozarella','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-tiramisu','MOZARELLA TIRAMISU','Mozarella Tiramisu','PRODUCT','Mozarella','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-greentea','MOZARELLA GREENTEA','Mozarella Greentea','PRODUCT','Mozarella','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-vanilla','MOZARELLA VANILLA','Mozarella Vanilla','PRODUCT','Mozarella','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-taro','MOZARELLA TARO','Mozarella Taro','PRODUCT','Mozarella','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mozarella-strawberry','MOZARELLA STRAWBERRY','Mozarella Strawberry','PRODUCT','Mozarella','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mix-original','MIX ORIGINAL','Mix Original','PRODUCT','Mix','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mix-crumble','MIX CRUMBLE','Mix Crumble','PRODUCT','Mix','PCS',11000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mix-mie','MIX MIE','Mix Mie','PRODUCT','Mix','PCS',12000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mix-kentang','MIX KENTANG','Mix Kentang','PRODUCT','Mix','PCS',13000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-mix-cornflakes','MIX CORNFLAKES','Mix Cornflakes','PRODUCT','Mix','PCS',13000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-beng-beng-original','BENG-BENG ORIGINAL','Beng-Beng Original','PRODUCT','Beng-Beng','PCS',8000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-beng-beng-coklat','BENG-BENG COKLAT','Beng-Beng Coklat','PRODUCT','Beng-Beng','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-beng-beng-tiramisu','BENG-BENG TIRAMISU','Beng-Beng Tiramisu','PRODUCT','Beng-Beng','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-beng-beng-greentea','BENG-BENG GREENTEA','Beng-Beng Greentea','PRODUCT','Beng-Beng','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-beng-beng-vanilla','BENG-BENG VANILLA','Beng-Beng Vanilla','PRODUCT','Beng-Beng','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-beng-beng-taro','BENG-BENG TARO','Beng-Beng Taro','PRODUCT','Beng-Beng','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-beng-beng-strawberry','BENG-BENG STRAWBERRY','Beng-Beng Strawberry','PRODUCT','Beng-Beng','PCS',10000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-sosis-original','SOSIS ORIGINAL','Sosis Original','PRODUCT','Sosis','PCS',6000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-sosis-crumble','SOSIS CRUMBLE','Sosis Crumble','PRODUCT','Sosis','PCS',7000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-sosis-mie','SOSIS MIE','Sosis Mie','PRODUCT','Sosis','PCS',8000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-sosis-kentang','SOSIS KENTANG','Sosis Kentang','PRODUCT','Sosis','PCS',9000) ON CONFLICT (key) DO NOTHING;
INSERT INTO inventory_items (id,key,name,kind,category,"baseUnit","sellingPrice") VALUES ('PRODUCT-sosis-cornflakes','SOSIS CORNFLAKES','Sosis Cornflakes','PRODUCT','Sosis','PCS',9000) ON CONFLICT (key) DO NOTHING;
