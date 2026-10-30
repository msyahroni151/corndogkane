ALTER TABLE "outlet_stock_events" ADD COLUMN     "stockReturnId" TEXT;

CREATE TABLE "stock_returns" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "requesterName" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(2000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_return_lines" (
    "id" TEXT NOT NULL,
    "stockReturnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "value" DECIMAL(18,4),
    "receivedQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "receivedValue" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "stock_return_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_return_actions" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "stockReturnId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "notes" VARCHAR(2000) NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_return_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_return_receipt_lines" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "valueSource" TEXT NOT NULL,

    CONSTRAINT "stock_return_receipt_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_returns_requestKey_key" ON "stock_returns"("requestKey");

CREATE INDEX "stock_returns_outletId_status_createdAt_idx" ON "stock_returns"("outletId", "status", "createdAt");

CREATE INDEX "stock_returns_status_createdAt_idx" ON "stock_returns"("status", "createdAt");

CREATE INDEX "stock_return_lines_itemId_idx" ON "stock_return_lines"("itemId");

CREATE UNIQUE INDEX "stock_return_lines_stockReturnId_itemId_key" ON "stock_return_lines"("stockReturnId", "itemId");

CREATE UNIQUE INDEX "stock_return_actions_requestKey_key" ON "stock_return_actions"("requestKey");

CREATE INDEX "stock_return_actions_stockReturnId_createdAt_idx" ON "stock_return_actions"("stockReturnId", "createdAt");

CREATE UNIQUE INDEX "stock_return_receipt_lines_batchId_key" ON "stock_return_receipt_lines"("batchId");

CREATE INDEX "stock_return_receipt_lines_lineId_idx" ON "stock_return_receipt_lines"("lineId");

CREATE INDEX "stock_return_receipt_lines_actionId_idx" ON "stock_return_receipt_lines"("actionId");

ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_events_stockReturnId_fkey" FOREIGN KEY ("stockReturnId") REFERENCES "stock_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_return_lines" ADD CONSTRAINT "stock_return_lines_stockReturnId_fkey" FOREIGN KEY ("stockReturnId") REFERENCES "stock_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_return_lines" ADD CONSTRAINT "stock_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_return_actions" ADD CONSTRAINT "stock_return_actions_stockReturnId_fkey" FOREIGN KEY ("stockReturnId") REFERENCES "stock_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_return_actions" ADD CONSTRAINT "stock_return_actions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_return_receipt_lines" ADD CONSTRAINT "stock_return_receipt_lines_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "stock_return_actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_return_receipt_lines" ADD CONSTRAINT "stock_return_receipt_lines_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "stock_return_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_return_receipt_lines" ADD CONSTRAINT "stock_return_receipt_lines_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_status_check" CHECK (status IN ('REQUESTED','APPROVED','SENT','PARTIAL','RECEIVED','CANCELLED','REJECTED') AND version >= 0);
ALTER TABLE "stock_return_lines" ADD CONSTRAINT "stock_return_line_amounts_check" CHECK (quantity > 0 AND quantity <= 1000000000 AND "receivedQuantity" >= 0 AND "receivedQuantity" <= quantity AND (value IS NULL OR value >= 0) AND "receivedValue" >= 0);
ALTER TABLE "stock_return_actions" ADD CONSTRAINT "stock_return_action_kind_check" CHECK (kind IN ('CREATE','APPROVE','SEND','RECEIVE','CANCEL','REJECT'));
ALTER TABLE "stock_return_receipt_lines" ADD CONSTRAINT "stock_return_receipt_amounts_check" CHECK (quantity > 0 AND value >= 0 AND "valueSource" IN ('CARRIED','MANUAL'));
ALTER TABLE "outlet_stock_events" DROP CONSTRAINT "outlet_stock_event_kind";
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_event_kind" CHECK (kind IN ('OPENING','COUNT','USE','LOSS','RECEIVE','RETURN_SEND','RETURN_RECEIVE'));
CREATE INDEX "outlet_stock_events_stockReturnId_idx" ON "outlet_stock_events"("stockReturnId");
ALTER TABLE "stock_returns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_return_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_return_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_return_receipt_lines" ENABLE ROW LEVEL SECURITY;
