
CREATE TABLE "fixed_assets" (
 "id" TEXT PRIMARY KEY,
 "code" VARCHAR(40) NOT NULL,
 "name" VARCHAR(160) NOT NULL,
 "categoryAccountId" TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "categoryCode" VARCHAR(30) NOT NULL,
 "categoryName" VARCHAR(120) NOT NULL,
 "brandModel" VARCHAR(160) NOT NULL DEFAULT '',
 "serialNumber" VARCHAR(100) NOT NULL DEFAULT '',
 "registrationType" VARCHAR(8) NOT NULL CHECK ("registrationType" IN ('EXISTING','NEW')),
 "acquiredAt" DATE,
 "inUseAt" DATE,
 "acquisitionCost" BIGINT CHECK ("acquisitionCost" IS NULL OR "acquisitionCost" BETWEEN 0 AND 999999999999),
 "invoiceNumber" VARCHAR(100) NOT NULL DEFAULT '',
 "evidenceUrl" VARCHAR(1000) NOT NULL DEFAULT '',
 "locationType" VARCHAR(6) NOT NULL CHECK ("locationType" IN ('KANTOR','OUTLET')),
 "outletId" TEXT REFERENCES outlets(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "locationName" VARCHAR(160) NOT NULL,
 "locationDetail" VARCHAR(160) NOT NULL DEFAULT '',
 "responsibleName" VARCHAR(160) NOT NULL DEFAULT '',
 "condition" VARCHAR(15) NOT NULL CHECK ("condition" IN ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
 "status" VARCHAR(12) NOT NULL CHECK ("status" IN ('DIGUNAKAN','DISIMPAN','PERBAIKAN','NONAKTIF','DIJUAL')),
 "notes" VARCHAR(2000) NOT NULL DEFAULT '',
 "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "updatedById" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT fixed_assets_location_check CHECK (("locationType"='KANTOR' AND "outletId" IS NULL) OR ("locationType"='OUTLET' AND "outletId" IS NOT NULL)),
 CONSTRAINT fixed_assets_dates_check CHECK ("acquiredAt" IS NULL OR "inUseAt" IS NULL OR "inUseAt">="acquiredAt")
);
CREATE UNIQUE INDEX fixed_assets_code_key ON fixed_assets(code);
CREATE INDEX "fixed_assets_locationType_outletId_status_idx" ON fixed_assets("locationType","outletId",status);
CREATE TABLE asset_events (
 id TEXT PRIMARY KEY,
 "assetId" TEXT NOT NULL REFERENCES fixed_assets(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 type VARCHAR(10) NOT NULL CHECK (type IN ('CREATED','UPDATED','MOVED')),
 "requestKey" UUID NOT NULL,
 "requestHash" VARCHAR(64) NOT NULL,
 before JSONB,
 after JSONB NOT NULL,
 notes VARCHAR(1000) NOT NULL DEFAULT '',
 "actorId" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "asset_events_requestKey_key" ON asset_events("requestKey");
CREATE INDEX "asset_events_assetId_createdAt_idx" ON asset_events("assetId","createdAt");
