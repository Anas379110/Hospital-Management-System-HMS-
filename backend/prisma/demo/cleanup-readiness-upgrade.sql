-- Exact existing isolated demo upgrade only, AFTER the new migration.
-- Owner executes while qualification gate stays on and public traffic is off.
BEGIN;
ALTER TABLE public.hms_cleanup_state OWNER TO hms_migration;
ALTER FUNCTION public.hms_demo_cleanup_fresh() OWNER TO hms_migration;
REVOKE ALL ON public.hms_cleanup_state FROM PUBLIC,hms_runtime,hms_cleanup,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hms_demo_cleanup_fresh() FROM PUBLIC,hms_runtime,hms_cleanup,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hms_demo_cleanup_fresh() TO hms_runtime;
COMMIT;
-- Then use the already authorized cleanup-only identity for real cleanup.
-- Do not fabricate a heartbeat, skip the structural audit or disable the gate.
