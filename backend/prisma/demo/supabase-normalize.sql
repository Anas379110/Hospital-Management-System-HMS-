-- Dedicated HMS project only, after reviewed migrations and base grants.sql.
-- postgres must have SET capability on hms_migration; never grant the reverse.
BEGIN;
REVOKE ALL ON public._prisma_migrations FROM hms_runtime,hms_cleanup,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE hms_migration REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE hms_migration REVOKE USAGE ON TYPES FROM PUBLIC;
REVOKE ALL ON SCHEMA cron FROM hms_runtime,hms_cleanup,anon,authenticated,service_role;
REVOKE USAGE ON SCHEMA extensions FROM hms_runtime,hms_cleanup,anon,authenticated,service_role;
DO $$ DECLARE x record; BEGIN
 FOR x IN SELECT typname FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e' LOOP
  EXECUTE format('ALTER TYPE public.%I OWNER TO hms_migration',x.typname);
  EXECUTE format('REVOKE ALL ON TYPE public.%I FROM PUBLIC,anon,authenticated,service_role',x.typname);
  EXECUTE format('GRANT USAGE ON TYPE public.%I TO hms_runtime',x.typname);
 END LOOP;
END $$;
COMMIT;
