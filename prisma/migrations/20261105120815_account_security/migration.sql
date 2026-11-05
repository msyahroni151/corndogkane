ALTER TABLE "sessions" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
ALTER TABLE "access_roles" ADD COLUMN "mfaRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "mfa_credentials" (
 "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "secretCipher" BYTEA NOT NULL,"lastCounter" INTEGER NOT NULL DEFAULT -1,"recoveryHashes" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "mfa_challenges" (
 "tokenHash" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "setupCipher" BYTEA,"recoveryCipher" BYTEA,"attempts" INTEGER NOT NULL DEFAULT 0,"verifiedAt" TIMESTAMP(3),
 "expiresAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "mfa_challenges_expiresAt_idx" ON "mfa_challenges"("expiresAt");
CREATE TABLE "security_alerts" (
 "id" TEXT PRIMARY KEY,"fingerprint" TEXT NOT NULL UNIQUE,"title" TEXT NOT NULL,"message" TEXT NOT NULL,"severity" TEXT NOT NULL,
 "occurrences" INTEGER NOT NULL DEFAULT 1,"acknowledgedAt" TIMESTAMP(3),
 "acknowledgedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "security_alerts_acknowledgedAt_createdAt_idx" ON "security_alerts"("acknowledgedAt","createdAt");
CREATE TABLE "security_backup_runs" (
 "id" TEXT PRIMARY KEY,"target" TEXT NOT NULL,"status" TEXT NOT NULL,"sha256" TEXT,"restoredAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"finishedAt" TIMESTAMP(3));
CREATE INDEX "security_backup_runs_target_createdAt_idx" ON "security_backup_runs"("target","createdAt");
CREATE TABLE "security_settings" (
 "id" TEXT PRIMARY KEY DEFAULT 'default',"photoRetentionDays" INTEGER NOT NULL DEFAULT 180,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "security_settings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;
DO $$ DECLARE t TEXT; r TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['mfa_credentials','mfa_challenges','security_alerts','security_backup_runs','security_settings'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',t,r);
  END LOOP;
 END LOOP;
END $$;
CREATE FUNCTION public.security_alert_on_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE title TEXT; severity TEXT; fingerprint TEXT;
BEGIN
 IF NEW.action IN ('LOGIN_THROTTLED','ACCESS_CHANGE_DENIED','MFA_FAILED','MFA_RECOVERY_USED','ROLE_SAVED','ACCOUNT_PASSWORD_SET','MFA_ENROLLED','BACKUP_FAILED') THEN
  title := CASE NEW.action WHEN 'LOGIN_THROTTLED' THEN 'Percobaan login dibatasi' WHEN 'ACCESS_CHANGE_DENIED' THEN 'Perubahan hak akses ditolak'
   WHEN 'MFA_FAILED' THEN 'Verifikasi dua langkah gagal' WHEN 'MFA_RECOVERY_USED' THEN 'Kode pemulihan akun digunakan'
   WHEN 'ROLE_SAVED' THEN 'Hak akses role diperbarui' WHEN 'ACCOUNT_PASSWORD_SET' THEN 'Password akun diatur ulang'
   WHEN 'BACKUP_FAILED' THEN 'Backup atau uji pemulihan gagal' ELSE 'Verifikasi dua langkah diaktifkan' END;
  severity := CASE WHEN NEW.action IN ('MFA_RECOVERY_USED','BACKUP_FAILED') THEN 'CRITICAL' WHEN NEW.outcome='DENIED' THEN 'WARNING' ELSE 'INFO' END;
  fingerprint := NEW.action || ':' || coalesce(NEW."userId",NEW."ipHash",'system') || ':' || floor(extract(epoch from NEW."createdAt")/900)::text;
  INSERT INTO public.security_alerts (id,fingerprint,title,message,severity,"createdAt","updatedAt")
   VALUES ('ALERT-'||NEW.id,fingerprint,title,'Periksa riwayat keamanan dan pastikan aktivitas ini dikenali.',severity,NEW."createdAt",NEW."createdAt")
   ON CONFLICT (fingerprint) DO UPDATE SET occurrences=public.security_alerts.occurrences+1,"updatedAt"=EXCLUDED."updatedAt","acknowledgedAt"=NULL,"acknowledgedById"=NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.security_alert_on_event() FROM PUBLIC;
CREATE TRIGGER security_alert_after_event AFTER INSERT ON public.security_events FOR EACH ROW EXECUTE FUNCTION public.security_alert_on_event();
