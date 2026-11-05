-- Operator-only bootstrap; does not contain any password or verifier.
-- Membership is temporary, used only to configure each new role's own password.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='corndog_runtime') THEN CREATE ROLE corndog_runtime LOGIN NOINHERIT NOCREATEDB NOCREATEROLE CONNECTION LIMIT 24; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='corndog_backup') THEN CREATE ROLE corndog_backup LOGIN NOINHERIT NOCREATEDB NOCREATEROLE CONNECTION LIMIT 4; END IF;
END $$;
GRANT corndog_runtime,corndog_backup TO corndog_demo_app WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public TO corndog_runtime,corndog_backup;
GRANT CONNECT ON DATABASE postgres TO corndog_runtime,corndog_backup;
ALTER ROLE corndog_runtime SET statement_timeout TO '60s';
ALTER ROLE corndog_backup SET statement_timeout TO '5min';
-- Apply database-runtime-policies.sql as the table owner before credential setup.
-- After direct credential setup, the operator must execute:
-- REVOKE corndog_runtime,corndog_backup FROM corndog_demo_app;
