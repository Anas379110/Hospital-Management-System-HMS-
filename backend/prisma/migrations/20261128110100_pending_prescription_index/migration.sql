-- Single concurrent build per migration. Preserve unchanged RLS/grants.
CREATE INDEX CONCURRENTLY prescriptions_workspace_pending_time_idx ON prescriptions(workspace_id,created_at) WHERE status='pending';
