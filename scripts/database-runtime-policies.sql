-- Explicit allowlist; no extension tables or future table grants.
GRANT USAGE ON SCHEMA public TO corndog_runtime,corndog_backup;
REVOKE CREATE ON SCHEMA public FROM corndog_runtime,corndog_backup;
DO $$ DECLARE rules JSONB := '{"access_roles":["INSERT","SELECT","UPDATE"],"areas":["DELETE","INSERT","SELECT","UPDATE"],"asset_events":["INSERT","SELECT"],"attendance":["INSERT","SELECT","UPDATE"],"employees":["INSERT","SELECT","UPDATE"],"financial_accounts":["INSERT","SELECT","UPDATE"],"fixed_assets":["INSERT","SELECT","UPDATE"],"goods_receipt_lines":["SELECT","UPDATE"],"goods_receipts":["INSERT","SELECT"],"inventory_batches":["INSERT","SELECT","UPDATE"],"inventory_items":["DELETE","INSERT","SELECT","UPDATE"],"inventory_movements":["INSERT","SELECT"],"inventory_operations":["INSERT","SELECT"],"inventory_recipes":["DELETE","INSERT","SELECT"],"journal_transactions":["INSERT","SELECT"],"login_throttles":["DELETE","INSERT","SELECT","UPDATE"],"mfa_challenges":["DELETE","INSERT","SELECT","UPDATE"],"mfa_credentials":["INSERT","SELECT","UPDATE"],"money_entries":["INSERT","SELECT","UPDATE"],"operational_expenses":["INSERT","SELECT","UPDATE"],"outlet_daily_statuses":["INSERT","SELECT","UPDATE"],"outlet_operations":["INSERT","SELECT","UPDATE"],"outlet_stock_events":["INSERT","SELECT"],"outlet_stock_order_lines":["SELECT","UPDATE"],"outlet_stock_orders":["INSERT","SELECT","UPDATE"],"outlet_stocks":["INSERT","SELECT","UPDATE"],"outlets":["INSERT","SELECT","UPDATE"],"partners":["INSERT","SELECT","UPDATE"],"payrolls":["INSERT","SELECT","UPDATE"],"placements":["INSERT","SELECT"],"portal_captures":["INSERT","SELECT","UPDATE"],"portal_challenges":["DELETE","INSERT","SELECT","UPDATE"],"portal_faces":["INSERT","SELECT","UPDATE"],"portal_leaves":["INSERT","SELECT","UPDATE"],"production_plans":["INSERT","SELECT","UPDATE"],"production_remainders":["INSERT","SELECT"],"receipt_templates":["INSERT","SELECT","UPDATE"],"sale_lines":["INSERT","SELECT"],"sale_transactions":["INSERT","SELECT","UPDATE"],"sales_decisions":["INSERT","SELECT"],"schedule_area_notes":["INSERT","SELECT","UPDATE"],"schedules":["DELETE","INSERT","SELECT","UPDATE"],"security_alerts":["INSERT","SELECT","UPDATE"],"security_backup_runs":["SELECT"],"security_events":["INSERT","SELECT"],"security_settings":["INSERT","SELECT","UPDATE"],"sequence_counters":["INSERT","SELECT","UPDATE"],"sessions":["DELETE","INSERT","SELECT"],"settlement_deductions":["INSERT","SELECT"],"settlement_reviews":["INSERT","SELECT"],"stock_return_actions":["INSERT","SELECT"],"stock_return_lines":["INSERT","SELECT","UPDATE"],"stock_return_receipt_lines":["INSERT","SELECT"],"stock_returns":["INSERT","SELECT","UPDATE"],"users":["INSERT","SELECT","UPDATE"]}'::jsonb; entry RECORD; table_name TEXT; role_name TEXT; operation TEXT; allowed TEXT[]; policy_name TEXT; predicate TEXT;
BEGIN
 FOR entry IN SELECT key,value FROM jsonb_each(rules) LOOP
  table_name:=entry.key;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('REVOKE ALL ON public.%I FROM corndog_runtime,corndog_backup',table_name);
  EXECUTE format('DROP POLICY IF EXISTS corndog_runtime_write ON public.%I',table_name);
  FOREACH role_name IN ARRAY ARRAY['corndog_runtime','corndog_backup'] LOOP
   allowed:=CASE WHEN role_name='corndog_runtime' THEN ARRAY(SELECT jsonb_array_elements_text(entry.value)) WHEN table_name='security_backup_runs' THEN ARRAY['SELECT','INSERT','UPDATE'] ELSE ARRAY['SELECT'] END;
   FOREACH operation IN ARRAY allowed LOOP
    IF operation NOT IN ('SELECT','INSERT','UPDATE','DELETE') THEN RAISE EXCEPTION 'Invalid operation'; END IF;
    EXECUTE format('GRANT %s ON public.%I TO %I',operation,table_name,role_name);
    policy_name:=role_name||'_'||lower(operation);
    predicate:=CASE operation WHEN 'INSERT' THEN 'WITH CHECK (true)' WHEN 'UPDATE' THEN 'USING (true) WITH CHECK (true)' ELSE 'USING (true)' END;
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=table_name AND policyname=policy_name) THEN
     EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %I %s',policy_name,table_name,operation,role_name,predicate);
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
END $$;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._prisma_migrations FROM corndog_runtime,corndog_backup;
GRANT SELECT ON public._prisma_migrations TO corndog_backup;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='_prisma_migrations' AND policyname='corndog_backup_metadata_select') THEN CREATE POLICY corndog_backup_metadata_select ON public._prisma_migrations FOR SELECT TO corndog_backup USING(true); END IF; END $$;
GRANT EXECUTE ON FUNCTION public.security_alert_on_event() TO corndog_runtime;
ALTER ROLE corndog_runtime SET statement_timeout TO '60s';
ALTER ROLE corndog_backup SET statement_timeout TO '5min';
ALTER ROLE corndog_runtime SET search_path TO public;
ALTER ROLE corndog_backup SET search_path TO public;
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO corndog_runtime,corndog_backup',current_database()); END $$;
