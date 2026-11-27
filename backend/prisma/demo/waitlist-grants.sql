-- LOCAL CANDIDATE ONLY, not applied to live. Owner executes only after exact approval.
-- Existing installation assumed roles; do not create or expand role capabilities.
ALTER TABLE public.waitlist_requests OWNER TO hms_migration;
REVOKE ALL ON public.waitlist_requests FROM PUBLIC,hms_runtime,hms_cleanup,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.waitlist_requests TO hms_runtime;
