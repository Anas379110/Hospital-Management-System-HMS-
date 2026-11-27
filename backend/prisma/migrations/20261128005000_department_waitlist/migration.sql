-- LOCAL CANDIDATE ONLY. Live schema/grants require a separate reviewed owner gate.
-- No existing data rewrite. No automatic admission or inferred clinical priority.
CREATE TABLE waitlist_requests (
 workspace_id text NOT NULL DEFAULT current_setting('hms.workspace_id',true),
 id text PRIMARY KEY,
 patient_id text NOT NULL,
 department_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 requested_by text NOT NULL,
 requested_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closed_by text,
 closed_at timestamp(3),
 admission_id text,
 CONSTRAINT waitlist_status_check CHECK (status IN ('pending','cancelled','admitted')),
 CONSTRAINT waitlist_closure_check CHECK (
  (status='pending' AND closed_by IS NULL AND closed_at IS NULL AND admission_id IS NULL)
  OR (status='cancelled' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND admission_id IS NULL)
  OR (status='admitted' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND admission_id IS NOT NULL)
 ),
 CONSTRAINT waitlist_workspace_fk FOREIGN KEY(workspace_id) REFERENCES demo_workspaces(id) ON DELETE CASCADE,
 CONSTRAINT waitlist_patient_workspace_fk FOREIGN KEY(workspace_id,patient_id) REFERENCES patients(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT waitlist_department_workspace_fk FOREIGN KEY(workspace_id,department_id) REFERENCES departments(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT waitlist_requester_workspace_fk FOREIGN KEY(workspace_id,requested_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT waitlist_closer_workspace_fk FOREIGN KEY(workspace_id,closed_by) REFERENCES users(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT waitlist_admission_workspace_fk FOREIGN KEY(workspace_id,admission_id) REFERENCES admissions(workspace_id,id) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX waitlist_fifo_idx ON waitlist_requests(workspace_id,department_id,status,requested_at,id);
CREATE UNIQUE INDEX waitlist_one_pending_patient_department ON waitlist_requests(workspace_id,patient_id,department_id) WHERE status='pending';
ALTER TABLE waitlist_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON waitlist_requests USING (
 workspace_id=nullif(current_setting('hms.workspace_id',true),'')
 AND EXISTS(SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at>clock_timestamp())
) WITH CHECK (
 workspace_id=nullif(current_setting('hms.workspace_id',true),'')
 AND EXISTS(SELECT 1 FROM demo_workspaces w WHERE w.id=workspace_id AND w.expires_at>clock_timestamp())
);
-- Deliberately no automatic role grants or ownership changes here. Separate reviewed
-- installation/upgrade grant delta supplies runtime SELECT/INSERT/UPDATE only.
