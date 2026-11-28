-- Run after the explicit owner/grant normalization and before public traffic.
-- Fail closed. This inspects every public relation/function/type, not a prefix.
DO $$
DECLARE x record; r text; priv text; expected boolean; allowed boolean;
 tenant_tables text[] := ARRAY['users','patients','appointments','encounters','prescriptions','medications','test_orders','invoices','invoice_items','payments','departments','beds','admissions','audit_logs','waitlist_requests'];
BEGIN
 IF current_user<>'postgres' OR NOT coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false) THEN RAISE EXCEPTION 'Audit requires owner identity and TLS'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND a.attacl IS NOT NULL) THEN RAISE EXCEPTION 'Unexpected column ACL'; END IF;
 FOR x IN SELECT c.oid,c.relname,c.relkind,c.relowner,c.relacl FROM pg_class c WHERE c.relnamespace='public'::regnamespace LOOP
  IF pg_get_userbyid(x.relowner)<>'hms_migration' THEN RAISE EXCEPTION 'Unexpected public relation owner: %',x.relname; END IF;
  IF x.relkind='r' AND x.relname<>ALL(tenant_tables) AND x.relname NOT IN ('demo_workspaces','_prisma_migrations','hms_cleanup_state') THEN RAISE EXCEPTION 'Unexpected public table: %',x.relname; END IF;
  IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault(CASE WHEN x.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,x.relowner))) a WHERE a.grantee=0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))) THEN RAISE EXCEPTION 'Public relation exposure: %',x.relname; END IF;
  IF x.relkind='r' THEN
   FOREACH r IN ARRAY ARRAY['hms_runtime','hms_cleanup'] LOOP
    FOREACH priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
     expected := r='hms_runtime' AND ((x.relname=ANY(tenant_tables) AND priv IN ('SELECT','INSERT','UPDATE','DELETE') AND NOT(x.relname='audit_logs' AND priv IN ('UPDATE','DELETE')) AND NOT(x.relname='waitlist_requests' AND priv='DELETE')) OR (x.relname='demo_workspaces' AND priv='SELECT'));
     allowed := has_table_privilege(r,x.oid,priv);
     IF allowed IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Table privilege drift: %.% %',r,x.relname,priv; END IF;
    END LOOP;
   END LOOP;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_tables WHERE schemaname='public')<>18 THEN RAISE EXCEPTION 'Unexpected table set'; END IF;
 FOR x IN SELECT p.* FROM pg_proc p WHERE p.pronamespace='public'::regnamespace LOOP
  IF pg_get_userbyid(x.proowner)<>'hms_migration' OR x.proname NOT IN ('hms_create_demo_workspace','hms_touch_demo_workspace','hms_cleanup_expired_workspaces','hms_demo_cleanup_fresh') OR NOT x.prosecdef OR x.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN RAISE EXCEPTION 'Public function drift: %',x.proname; END IF;
  IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a WHERE a.grantee=0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))) THEN RAISE EXCEPTION 'Public function exposure: %',x.proname; END IF;
  FOREACH r IN ARRAY ARRAY['hms_runtime','hms_cleanup'] LOOP
   expected := (r='hms_cleanup' AND x.proname='hms_cleanup_expired_workspaces') OR (r='hms_runtime' AND x.proname IN ('hms_create_demo_workspace','hms_touch_demo_workspace','hms_demo_cleanup_fresh'));
   IF has_function_privilege(r,x.oid,'EXECUTE') IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Function execute drift'; END IF;
  END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace)<>4 THEN RAISE EXCEPTION 'Unexpected function set'; END IF;
 FOR x IN SELECT t.* FROM pg_type t WHERE t.typnamespace='public'::regnamespace LOOP
  IF pg_get_userbyid(x.typowner)<>'hms_migration' THEN RAISE EXCEPTION 'Public type ownership drift: %',x.typname; END IF;
  IF x.typtype='e' THEN
   IF x.typname NOT IN ('AppointmentStatus','BedStatus','Gender','InvoiceStatus','PaymentMethod','PrescriptionStatus','Role','TestOrderStatus','TestType') THEN RAISE EXCEPTION 'Unexpected enum: %',x.typname; END IF;
  ELSIF x.typtype='c' THEN
   IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=x.typrelid AND c.relnamespace='public'::regnamespace AND c.relkind='r' AND (c.relname=ANY(tenant_tables) OR c.relname IN ('demo_workspaces','_prisma_migrations','hms_cleanup_state'))) THEN RAISE EXCEPTION 'Unexpected composite type: %',x.typname; END IF;
  ELSIF x.typelem<>0 THEN
   IF NOT EXISTS(SELECT 1 FROM pg_type t WHERE t.oid=x.typelem AND t.typarray=x.oid AND t.typnamespace='public'::regnamespace AND t.typtype IN ('e','c')) THEN RAISE EXCEPTION 'Unexpected array type'; END IF;
  ELSE RAISE EXCEPTION 'Unexpected public type: %',x.typname;
  END IF;
  -- PostgreSQL generated arrays/row types cannot have independent type grants.
  IF (x.typtype='e' OR x.typacl IS NOT NULL) AND EXISTS(SELECT 1 FROM aclexplode(coalesce(x.typacl,acldefault('T',x.typowner))) a WHERE a.grantee=0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','hms_cleanup'))) THEN RAISE EXCEPTION 'Public type exposure: %',x.typname; END IF;
 END LOOP;
 FOREACH r IN ARRAY ARRAY['hms_runtime','hms_cleanup','anon','authenticated','service_role'] LOOP
  IF has_schema_privilege(r,'cron','USAGE') OR has_schema_privilege(r,'extensions','USAGE') OR has_schema_privilege(r,'public','CREATE') THEN RAISE EXCEPTION 'Schema privilege drift: %',r; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname IN ('hms_runtime','hms_cleanup')) THEN RAISE EXCEPTION 'Service role membership drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_publication_tables WHERE schemaname='public') THEN RAISE EXCEPTION 'Public relation publication drift'; END IF;
 IF (SELECT count(*) FROM cron.job)<>2 OR (SELECT count(*) FROM cron.job WHERE jobname IN ('hms-hourly-expiry-cleanup','hms-cron-history-prune'))<>2 THEN RAISE EXCEPTION 'Unexpected scheduler job set'; END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='hms-cron-history-prune' AND (schedule<>'15 0 * * *' OR command<>$command$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '24 hours';$command$ OR username<>'postgres' OR NOT active)) THEN RAISE EXCEPTION 'Scheduler history drift'; END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='hms-hourly-expiry-cleanup' AND (schedule<>'0 * * * *' OR command<>$cleanup$DO $owner$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Scheduler owner identity required'; END IF; END $owner$; SET ROLE hms_cleanup; DO $guard$ BEGIN IF current_user <> 'hms_cleanup' OR (session_user<>'postgres' AND NOT coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false)) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) OR has_schema_privilege(current_user,'public','CREATE') OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND (has_table_privilege(current_user,oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR pg_has_role(relowner,'USAGE'))) OR has_function_privilege(current_user,'public.hms_create_demo_workspace(text)','EXECUTE') OR has_function_privilege(current_user,'public.hms_touch_demo_workspace(text)','EXECUTE') THEN RAISE EXCEPTION 'Restricted cleanup identity and TLS required'; END IF; END $guard$; SELECT public.hms_cleanup_expired_workspaces(); RESET ROLE;$cleanup$ OR username<>'postgres' OR NOT active)) THEN RAISE EXCEPTION 'Cleanup scheduler drift'; END IF;
END $$;
