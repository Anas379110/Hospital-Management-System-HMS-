-- New fictional-demo database only. Do not apply to populated legacy or real data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM patients) THEN
    RAISE EXCEPTION 'Workspace migration requires an empty dedicated fictional demo database';
  END IF;
END $$;
CREATE TABLE demo_workspaces (
 id text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_active_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '24 hours')
);
REVOKE ALL ON demo_workspaces FROM PUBLIC;
ALTER TABLE demo_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_metadata_scope ON demo_workspaces FOR SELECT USING
(id = nullif(current_setting('hms.workspace_id',true),''));

ALTER TABLE users ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE users ADD CONSTRAINT users_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE users ADD CONSTRAINT users_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX users_workspace_idx ON users(workspace_id);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON users USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE patients ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE patients ADD CONSTRAINT patients_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE patients ADD CONSTRAINT patients_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX patients_workspace_idx ON patients(workspace_id);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON patients USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE appointments ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE appointments ADD CONSTRAINT appointments_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD CONSTRAINT appointments_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX appointments_workspace_idx ON appointments(workspace_id);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON appointments USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE encounters ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE encounters ADD CONSTRAINT encounters_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE encounters ADD CONSTRAINT encounters_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX encounters_workspace_idx ON encounters(workspace_id);
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON encounters USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE prescriptions ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX prescriptions_workspace_idx ON prescriptions(workspace_id);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON prescriptions USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE medications ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE medications ADD CONSTRAINT medications_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE medications ADD CONSTRAINT medications_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX medications_workspace_idx ON medications(workspace_id);
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON medications USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE test_orders ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE test_orders ADD CONSTRAINT test_orders_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE test_orders ADD CONSTRAINT test_orders_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX test_orders_workspace_idx ON test_orders(workspace_id);
ALTER TABLE test_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON test_orders USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE invoices ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE invoices ADD CONSTRAINT invoices_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD CONSTRAINT invoices_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX invoices_workspace_idx ON invoices(workspace_id);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON invoices USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE invoice_items ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX invoice_items_workspace_idx ON invoice_items(workspace_id);
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON invoice_items USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE payments ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE payments ADD CONSTRAINT payments_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE payments ADD CONSTRAINT payments_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX payments_workspace_idx ON payments(workspace_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON payments USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE departments ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE departments ADD CONSTRAINT departments_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE departments ADD CONSTRAINT departments_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX departments_workspace_idx ON departments(workspace_id);
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON departments USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE beds ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE beds ADD CONSTRAINT beds_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE beds ADD CONSTRAINT beds_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX beds_workspace_idx ON beds(workspace_id);
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON beds USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE admissions ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE admissions ADD CONSTRAINT admissions_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE admissions ADD CONSTRAINT admissions_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX admissions_workspace_idx ON admissions(workspace_id);
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON admissions USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE audit_logs ADD COLUMN workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id', true);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_workspace_fk FOREIGN KEY (workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_workspace_id_key UNIQUE (workspace_id,id);
CREATE INDEX audit_logs_workspace_idx ON audit_logs(workspace_id);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON audit_logs USING (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
) WITH CHECK (
 workspace_id = nullif(current_setting('hms.workspace_id', true),'')
 AND EXISTS (SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at > clock_timestamp())
);

ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_created_by_fkey;
ALTER TABLE patients ADD CONSTRAINT patients_created_by_workspace_fkey FOREIGN KEY(workspace_id,created_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_patient_id_workspace_fkey FOREIGN KEY(workspace_id,patient_id) REFERENCES patients(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_id_workspace_fkey FOREIGN KEY(workspace_id,doctor_id) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_department_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_department_id_workspace_fkey FOREIGN KEY(workspace_id,department_id) REFERENCES departments(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE encounters DROP CONSTRAINT IF EXISTS encounters_patient_id_fkey;
ALTER TABLE encounters ADD CONSTRAINT encounters_patient_id_workspace_fkey FOREIGN KEY(workspace_id,patient_id) REFERENCES patients(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE encounters DROP CONSTRAINT IF EXISTS encounters_doctor_id_fkey;
ALTER TABLE encounters ADD CONSTRAINT encounters_doctor_id_workspace_fkey FOREIGN KEY(workspace_id,doctor_id) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE encounters DROP CONSTRAINT IF EXISTS encounters_appointment_id_fkey;
ALTER TABLE encounters ADD CONSTRAINT encounters_appointment_id_workspace_fkey FOREIGN KEY(workspace_id,appointment_id) REFERENCES appointments(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_encounter_id_fkey;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_encounter_id_workspace_fkey FOREIGN KEY(workspace_id,encounter_id) REFERENCES encounters(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_medication_id_fkey;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_medication_id_workspace_fkey FOREIGN KEY(workspace_id,medication_id) REFERENCES medications(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_dispensed_by_fkey;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_dispensed_by_workspace_fkey FOREIGN KEY(workspace_id,dispensed_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE test_orders DROP CONSTRAINT IF EXISTS test_orders_patient_id_fkey;
ALTER TABLE test_orders ADD CONSTRAINT test_orders_patient_id_workspace_fkey FOREIGN KEY(workspace_id,patient_id) REFERENCES patients(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE test_orders DROP CONSTRAINT IF EXISTS test_orders_encounter_id_fkey;
ALTER TABLE test_orders ADD CONSTRAINT test_orders_encounter_id_workspace_fkey FOREIGN KEY(workspace_id,encounter_id) REFERENCES encounters(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE test_orders DROP CONSTRAINT IF EXISTS test_orders_ordered_by_fkey;
ALTER TABLE test_orders ADD CONSTRAINT test_orders_ordered_by_workspace_fkey FOREIGN KEY(workspace_id,ordered_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE test_orders DROP CONSTRAINT IF EXISTS test_orders_completed_by_fkey;
ALTER TABLE test_orders ADD CONSTRAINT test_orders_completed_by_workspace_fkey FOREIGN KEY(workspace_id,completed_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_patient_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_patient_id_workspace_fkey FOREIGN KEY(workspace_id,patient_id) REFERENCES patients(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_admission_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_admission_id_workspace_fkey FOREIGN KEY(workspace_id,admission_id) REFERENCES admissions(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_workspace_fkey FOREIGN KEY(workspace_id,created_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_invoice_id_workspace_fkey FOREIGN KEY(workspace_id,invoice_id) REFERENCES invoices(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_invoice_id_workspace_fkey FOREIGN KEY(workspace_id,invoice_id) REFERENCES invoices(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_recorded_by_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_recorded_by_workspace_fkey FOREIGN KEY(workspace_id,recorded_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE beds DROP CONSTRAINT IF EXISTS beds_department_id_fkey;
ALTER TABLE beds ADD CONSTRAINT beds_department_id_workspace_fkey FOREIGN KEY(workspace_id,department_id) REFERENCES departments(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE admissions DROP CONSTRAINT IF EXISTS admissions_patient_id_fkey;
ALTER TABLE admissions ADD CONSTRAINT admissions_patient_id_workspace_fkey FOREIGN KEY(workspace_id,patient_id) REFERENCES patients(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE admissions DROP CONSTRAINT IF EXISTS admissions_bed_id_fkey;
ALTER TABLE admissions ADD CONSTRAINT admissions_bed_id_workspace_fkey FOREIGN KEY(workspace_id,bed_id) REFERENCES beds(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE admissions DROP CONSTRAINT IF EXISTS admissions_admitted_by_fkey;
ALTER TABLE admissions ADD CONSTRAINT admissions_admitted_by_workspace_fkey FOREIGN KEY(workspace_id,admitted_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_workspace_fkey FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
DROP INDEX IF EXISTS users_username_key;
DROP INDEX IF EXISTS patients_mrn_key;
DROP INDEX IF EXISTS medications_name_key;
CREATE UNIQUE INDEX users_workspace_id_username_key ON users(workspace_id,username);
CREATE UNIQUE INDEX patients_workspace_id_mrn_key ON patients(workspace_id,mrn);
CREATE UNIQUE INDEX medications_workspace_id_name_key ON medications(workspace_id,name);

-- A bootstrap capability, not a reusable privileged login. The runtime must
-- receive EXECUTE only on this function and SELECT (not DML) on workspaces.
CREATE FUNCTION hms_create_demo_workspace(w text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE role_name text; uid text; reception_id text; department_id text := gen_random_uuid()::text;
BEGIN
 IF w !~ '^[a-f0-9-]{36}$' THEN RAISE EXCEPTION 'Invalid workspace'; END IF;
 -- Bound anonymous allocation and serialize cap checks.
 PERFORM pg_advisory_xact_lock(18472932);
 DELETE FROM demo_workspaces WHERE expires_at <= clock_timestamp();
 IF (SELECT count(*) FROM demo_workspaces) >= 100 THEN RAISE EXCEPTION 'Demo capacity reached'; END IF;
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
CREATE FUNCTION hms_touch_demo_workspace(w text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF w IS DISTINCT FROM nullif(current_setting('hms.workspace_id',true),'') THEN RETURN false; END IF;
 UPDATE demo_workspaces SET last_active_at=clock_timestamp(),expires_at=clock_timestamp()+interval '24 hours'
 WHERE id=w AND expires_at>clock_timestamp();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION hms_touch_demo_workspace(text) FROM PUBLIC;

CREATE FUNCTION hms_cleanup_expired_workspaces() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE deleted_count bigint;
BEGIN
 DELETE FROM demo_workspaces WHERE expires_at <= clock_timestamp();
 GET DIAGNOSTICS deleted_count=ROW_COUNT;
 RETURN deleted_count;
END $$;
REVOKE ALL ON FUNCTION hms_cleanup_expired_workspaces() FROM PUBLIC;
