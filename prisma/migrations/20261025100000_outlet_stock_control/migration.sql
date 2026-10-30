-- CreateTable
CREATE TABLE "outlet_stocks" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "value" DECIMAL(18,4),
    "lastCountQuantity" DECIMAL(18,3) NOT NULL,
    "lastCountDifference" DECIMAL(18,3),
    "lastCountAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_stock_orders" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "requesterName" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(2000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "sentById" TEXT,
    "receivedById" TEXT,
    "sentKey" TEXT,
    "receivedKey" TEXT,
    "cancelledKey" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "shipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "outlet_stock_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_stock_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "value" DECIMAL(18,4),

    CONSTRAINT "outlet_stock_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_stock_events" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantityBefore" DECIMAL(18,3),
    "quantityAfter" DECIMAL(18,3) NOT NULL,
    "valueBefore" DECIMAL(18,4),
    "valueAfter" DECIMAL(18,4),
    "notes" VARCHAR(2000) NOT NULL,
    "actorId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_stock_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outlet_stocks_itemId_idx" ON "outlet_stocks"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stocks_outletId_itemId_unit_key" ON "outlet_stocks"("outletId", "itemId", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_orders_requestKey_key" ON "outlet_stock_orders"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_orders_sentKey_key" ON "outlet_stock_orders"("sentKey");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_orders_receivedKey_key" ON "outlet_stock_orders"("receivedKey");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_orders_cancelledKey_key" ON "outlet_stock_orders"("cancelledKey");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_orders_shipmentId_key" ON "outlet_stock_orders"("shipmentId");

-- CreateIndex
CREATE INDEX "outlet_stock_orders_outletId_status_createdAt_idx" ON "outlet_stock_orders"("outletId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "outlet_stock_orders_status_createdAt_idx" ON "outlet_stock_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "outlet_stock_orders_createdById_idx" ON "outlet_stock_orders"("createdById");

-- CreateIndex
CREATE INDEX "outlet_stock_orders_sentById_idx" ON "outlet_stock_orders"("sentById");

-- CreateIndex
CREATE INDEX "outlet_stock_orders_receivedById_idx" ON "outlet_stock_orders"("receivedById");

-- CreateIndex
CREATE INDEX "outlet_stock_orders_cancelledById_idx" ON "outlet_stock_orders"("cancelledById");

-- CreateIndex
CREATE INDEX "outlet_stock_order_lines_itemId_idx" ON "outlet_stock_order_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_order_lines_orderId_itemId_unit_key" ON "outlet_stock_order_lines"("orderId", "itemId", "unit");

-- CreateIndex
CREATE INDEX "outlet_stock_events_outletId_itemId_createdAt_idx" ON "outlet_stock_events"("outletId", "itemId", "createdAt");

-- CreateIndex
CREATE INDEX "outlet_stock_events_itemId_idx" ON "outlet_stock_events"("itemId");

-- CreateIndex
CREATE INDEX "outlet_stock_events_actorId_idx" ON "outlet_stock_events"("actorId");

-- CreateIndex
CREATE INDEX "outlet_stock_events_orderId_idx" ON "outlet_stock_events"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_events_requestKey_itemId_key" ON "outlet_stock_events"("requestKey", "itemId");

-- AddForeignKey
ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_orders" ADD CONSTRAINT "outlet_stock_orders_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_orders" ADD CONSTRAINT "outlet_stock_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_orders" ADD CONSTRAINT "outlet_stock_orders_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_orders" ADD CONSTRAINT "outlet_stock_orders_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_orders" ADD CONSTRAINT "outlet_stock_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_orders" ADD CONSTRAINT "outlet_stock_orders_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_order_lines" ADD CONSTRAINT "outlet_stock_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "outlet_stock_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_order_lines" ADD CONSTRAINT "outlet_stock_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_events_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_events_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "outlet_stock_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_nonnegative" CHECK (quantity >= 0 AND (value IS NULL OR value >= 0) AND "lastCountQuantity" >= 0 AND version >= 0);
ALTER TABLE "outlet_stock_order_lines" ADD CONSTRAINT "outlet_stock_lines_positive" CHECK (quantity > 0 AND (value IS NULL OR value >= 0));
ALTER TABLE "outlet_stock_orders" ADD CONSTRAINT "outlet_stock_order_status" CHECK (status IN ('REQUESTED','SENT','RECEIVED','CANCELLED') AND version >= 0);
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_event_quantities" CHECK (("quantityBefore" IS NULL OR "quantityBefore" >= 0) AND "quantityAfter" >= 0 AND ("valueBefore" IS NULL OR "valueBefore" >= 0) AND ("valueAfter" IS NULL OR "valueAfter" >= 0));
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_event_kind" CHECK (kind IN ('OPENING','COUNT','USE','LOSS','RECEIVE'));
ALTER TABLE "outlet_stocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outlet_stock_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outlet_stock_order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outlet_stock_events" ENABLE ROW LEVEL SECURITY;
