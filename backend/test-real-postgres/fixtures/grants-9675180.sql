-- Dedicated EMPTY HMS demo only, after migrations. Owner/admin executes once.
-- Create hms_runtime/hms_cleanup LOGIN credentials separately through secure vault.
-- This file never sets passwords or grants the web login migration authority.
CREATE ROLE hms_migration NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
GRANT USAGE,CREATE ON SCHEMA public TO hms_migration;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I OWNER TO hms_migration',t.tablename);
 END LOOP;
END $$;
ALTER FUNCTION hms_create_demo_workspace(text) OWNER TO hms_migration;
ALTER FUNCTION hms_touch_demo_workspace(text) OWNER TO hms_migration;
ALTER FUNCTION hms_cleanup_expired_workspaces() OWNER TO hms_migration;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,hms_runtime,hms_cleanup;
GRANT USAGE ON SCHEMA public TO hms_runtime,hms_cleanup;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO hms_runtime;
REVOKE ALL ON demo_workspaces FROM hms_runtime;
GRANT SELECT ON demo_workspaces TO hms_runtime;
REVOKE UPDATE,DELETE,TRUNCATE ON audit_logs FROM hms_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM hms_cleanup;
REVOKE ALL ON FUNCTION hms_cleanup_expired_workspaces() FROM PUBLIC,hms_runtime;
GRANT EXECUTE ON FUNCTION hms_create_demo_workspace(text),hms_touch_demo_workspace(text) TO hms_runtime;
GRANT EXECUTE ON FUNCTION hms_cleanup_expired_workspaces() TO hms_cleanup;
