-- Add a separate daily status register; no employee, sales, or stock rows are modified.
CREATE TABLE "outlet_daily_statuses" (
 "id" TEXT NOT NULL,
 "outletId" TEXT NOT NULL,
 "date" DATE NOT NULL,
 "closed" BOOLEAN NOT NULL DEFAULT true,
 "notes" VARCHAR(1000) NOT NULL DEFAULT '',
 "updatedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "outlet_daily_statuses_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "outlet_daily_statuses_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "outlet_daily_statuses_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "outlet_daily_statuses_outletId_date_key" ON "outlet_daily_statuses"("outletId", "date");
CREATE INDEX "outlet_daily_statuses_date_closed_idx" ON "outlet_daily_statuses"("date", "closed");
ALTER TABLE "outlet_daily_statuses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "outlet_daily_statuses" FROM PUBLIC;
DO $$ DECLARE target_role text; BEGIN
 FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=target_role) THEN
   EXECUTE format('REVOKE ALL ON TABLE public.outlet_daily_statuses FROM %I',target_role);
  END IF;
 END LOOP;
END $$;
