-- Single concurrent build per migration, no transaction wrapper.
CREATE INDEX CONCURRENTLY audit_logs_workspace_created_at_idx ON audit_logs(workspace_id,created_at DESC);
