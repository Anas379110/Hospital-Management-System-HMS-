-- Isolated demo only. No cleanup is run by this migration or web requests.
CREATE TABLE hms_cleanup_state (
 id integer PRIMARY KEY CHECK (id=1),
 last_success_at timestamptz
);
INSERT INTO hms_cleanup_state(id) VALUES(1);
REVOKE ALL ON hms_cleanup_state FROM PUBLIC;
CREATE FUNCTION hms_demo_cleanup_fresh() RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT last_success_at > pg_postmaster_start_time()
 AND last_success_at > clock_timestamp()-interval '90 minutes'
 AND last_success_at <= clock_timestamp() FROM public.hms_cleanup_state WHERE id=1),false)
$$;
REVOKE ALL ON FUNCTION hms_demo_cleanup_fresh() FROM PUBLIC;
CREATE OR REPLACE FUNCTION hms_cleanup_expired_workspaces() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE deleted_count bigint;
BEGIN
 DELETE FROM demo_workspaces WHERE expires_at <= clock_timestamp();
 GET DIAGNOSTICS deleted_count=ROW_COUNT;
 UPDATE public.hms_cleanup_state SET last_success_at=clock_timestamp() WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cleanup state missing'; END IF;
 RETURN deleted_count;
END $$;
CREATE OR REPLACE FUNCTION hms_create_demo_workspace(w text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE role_name text; uid text; reception_id text; department_id text := gen_random_uuid()::text;
BEGIN
 IF NOT public.hms_demo_cleanup_fresh() THEN RAISE EXCEPTION 'Demo cleanup pending' USING ERRCODE='P0001'; END IF;
 IF w !~ '^[a-f0-9-]{36}$' THEN RAISE EXCEPTION 'Invalid workspace'; END IF;
 -- Bound anonymous allocation and serialize cap checks.
 PERFORM pg_advisory_xact_lock(18472932);
 IF NOT public.hms_demo_cleanup_fresh() THEN RAISE EXCEPTION 'Demo cleanup pending' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM demo_workspaces WHERE expires_at>clock_timestamp()) >= 100 THEN RAISE EXCEPTION 'Demo capacity reached'; END IF;
 INSERT INTO demo_workspaces(id) VALUES(w);
 PERFORM set_config('hms.workspace_id',w,true);
 FOREACH role_name IN ARRAY ARRAY['admin','receptionist','doctor','nurse','manager','pharmacist','lab_tech','billing_clerk'] LOOP
  uid := gen_random_uuid()::text;
  IF role_name='receptionist' THEN reception_id:=uid; END IF;
  INSERT INTO users(id,username,password_hash,full_name,role,updated_at)
   VALUES(uid,'fictional_' || role_name,'disabled-no-password-login','Fictional ' || role_name,role_name::"Role",clock_timestamp());
 END LOOP;
 INSERT INTO patients(id,mrn,full_name,date_of_birth,gender,phone,created_by,updated_at)
 VALUES(gen_random_uuid()::text,'HMS-000001','Fictional Demo Patient','2000-01-01','male','0000000000',reception_id,clock_timestamp());
 INSERT INTO departments(id,name_ar,name_en,total_beds) VALUES(department_id,'قسم وهمي','Fictional Department',2);
 INSERT INTO beds(id,department_id,bed_number,updated_at) VALUES(gen_random_uuid()::text,department_id,'DEMO-01',clock_timestamp()),(gen_random_uuid()::text,department_id,'DEMO-02',clock_timestamp());
 INSERT INTO medications(id,name,unit,current_stock,reorder_threshold,updated_at) VALUES(gen_random_uuid()::text,'Fictional medicine','tablet',50,10,clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION hms_create_demo_workspace(text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION hms_touch_demo_workspace(w text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.hms_demo_cleanup_fresh() THEN RAISE EXCEPTION 'Demo cleanup pending' USING ERRCODE='P0001'; END IF;
 IF w IS DISTINCT FROM nullif(current_setting('hms.workspace_id',true),'') THEN RETURN false; END IF;
 UPDATE demo_workspaces SET last_active_at=clock_timestamp(),expires_at=clock_timestamp()+interval '24 hours'
 WHERE id=w AND expires_at>clock_timestamp();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION hms_touch_demo_workspace(text) FROM PUBLIC;
