-- Single statement, no transaction wrapper. Owner session must set lock_timeout=3s and statement_timeout=60s through connection options.
CREATE INDEX CONCURRENTLY test_orders_workspace_pending_time_idx ON test_orders(workspace_id,ordered_at) WHERE status='pending';
