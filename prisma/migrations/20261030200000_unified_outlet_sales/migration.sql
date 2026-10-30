ALTER TABLE "outlet_operations" ADD COLUMN     "additionalGross" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hasManual" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manualSales" JSONB,
ADD COLUMN     "posGross" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reconciledRevision" INTEGER,
ADD COLUMN     "salesChoice" TEXT,
ADD COLUMN     "salesPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salesSource" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "stockPending" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "outlet_stock_events" ADD COLUMN     "saleId" TEXT;

CREATE TABLE "sale_transactions" (
    "cashierName" TEXT NOT NULL,
    "crewName" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "postingKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "received" INTEGER NOT NULL,
    "notes" VARCHAR(1000) NOT NULL,
    "costTotal" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_lines" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "recipe" JSONB NOT NULL,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "pendingReason" TEXT,

    CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_decisions" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "notes" VARCHAR(1000) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sale_transactions_postingKey_key" ON "sale_transactions"("postingKey");

CREATE INDEX "sale_transactions_outletId_date_idx" ON "sale_transactions"("outletId", "date");

CREATE INDEX "sale_transactions_operationId_idx" ON "sale_transactions"("operationId");

CREATE INDEX "sale_lines_productId_idx" ON "sale_lines"("productId");

CREATE UNIQUE INDEX "sale_lines_saleId_productId_key" ON "sale_lines"("saleId", "productId");

CREATE INDEX "sales_decisions_operationId_createdAt_idx" ON "sales_decisions"("operationId", "createdAt");

ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_events_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "outlet_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_decisions" ADD CONSTRAINT "sales_decisions_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "outlet_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_decisions" ADD CONSTRAINT "sales_decisions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_operations" ADD CONSTRAINT "outlet_operations_sales_metadata_check" CHECK ("salesRevision">=0 AND "stockPending">=0 AND "posGross">=0 AND "additionalGross">=0 AND "salesSource" IN ('MANUAL','POS','POS_MANUAL_ADD','MANUAL_ADD','REVIEW') AND ("salesChoice" IS NULL OR "salesChoice" IN ('POS','MANUAL')));
ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transaction_values_check" CHECK (total>0 AND total<=1000000000 AND received>=total AND ("costTotal" IS NULL OR "costTotal">=0) AND source IN ('POS','MANUAL_ADD') AND method IN ('TUNAI','QRIS','GoFood','Grab Food','Shopee Food') AND (method='TUNAI' OR received=total));
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_line_values_check" CHECK (quantity BETWEEN 1 AND 100 AND "unitPrice">0 AND total::bigint="unitPrice"::bigint*quantity AND (("stockApplied"=true AND "pendingReason" IS NULL) OR ("stockApplied"=false AND "pendingReason" IN ('NO_RECIPE','BACKDATED'))));
ALTER TABLE "sales_decisions" ADD CONSTRAINT "sales_decision_choice_check" CHECK (choice IN ('POS','MANUAL') AND revision>=0);
ALTER TABLE "outlet_stock_events" DROP CONSTRAINT "outlet_stock_event_kind";
ALTER TABLE "outlet_stock_events" ADD CONSTRAINT "outlet_stock_event_kind" CHECK (kind IN ('OPENING','COUNT','USE','LOSS','RECEIVE','RETURN_SEND','RETURN_RECEIVE','SALE_USE'));
CREATE INDEX "outlet_stock_events_saleId_idx" ON "outlet_stock_events"("saleId");
ALTER TABLE "sale_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_decisions" ENABLE ROW LEVEL SECURITY;
