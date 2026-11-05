CREATE TABLE "security_events" (
 "id" TEXT NOT NULL,
 "userId" TEXT,
 "action" VARCHAR(80) NOT NULL,
 "outcome" VARCHAR(20) NOT NULL,
 "ipHash" VARCHAR(64),
 "metadata" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "security_events_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");
ALTER TABLE "security_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "security_events" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON TABLE "security_events" FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
  REVOKE ALL ON TABLE "security_events" FROM authenticated;
 END IF;
END $$;
