CREATE OR REPLACE FUNCTION public.security_alert_on_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE alert_title TEXT; alert_severity TEXT; alert_fingerprint TEXT;
BEGIN
 IF NEW.action IN ('LOGIN_THROTTLED','ACCESS_CHANGE_DENIED','MFA_FAILED','MFA_RECOVERY_USED','ROLE_SAVED','ACCOUNT_PASSWORD_SET','MFA_ENROLLED','BACKUP_FAILED') THEN
  alert_title := CASE NEW.action WHEN 'LOGIN_THROTTLED' THEN 'Percobaan login dibatasi' WHEN 'ACCESS_CHANGE_DENIED' THEN 'Perubahan hak akses ditolak'
   WHEN 'MFA_FAILED' THEN 'Verifikasi dua langkah gagal' WHEN 'MFA_RECOVERY_USED' THEN 'Kode pemulihan akun digunakan'
   WHEN 'ROLE_SAVED' THEN 'Hak akses role diperbarui' WHEN 'ACCOUNT_PASSWORD_SET' THEN 'Password akun diatur ulang'
   WHEN 'BACKUP_FAILED' THEN 'Backup atau uji pemulihan gagal' ELSE 'Verifikasi dua langkah diaktifkan' END;
  alert_severity := CASE WHEN NEW.action IN ('MFA_RECOVERY_USED','BACKUP_FAILED') THEN 'CRITICAL' WHEN NEW.outcome='DENIED' THEN 'WARNING' ELSE 'INFO' END;
  alert_fingerprint := NEW.action || ':' || coalesce(NEW."userId",NEW."ipHash",'system') || ':' || floor(extract(epoch from NEW."createdAt")/900)::text;
  INSERT INTO public.security_alerts (id,fingerprint,title,message,severity,"createdAt","updatedAt")
   VALUES ('ALERT-'||NEW.id,alert_fingerprint,alert_title,'Periksa riwayat keamanan dan pastikan aktivitas ini dikenali.',alert_severity,NEW."createdAt",NEW."createdAt")
   ON CONFLICT (fingerprint) DO UPDATE SET occurrences=public.security_alerts.occurrences+1,"updatedAt"=EXCLUDED."updatedAt","acknowledgedAt"=NULL,"acknowledgedById"=NULL;
 END IF;
 RETURN NEW;
END $$;
