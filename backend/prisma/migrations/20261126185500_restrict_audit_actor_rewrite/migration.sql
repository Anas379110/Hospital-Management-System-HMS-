-- Audit actor identity is immutable. Do not let parent-row updates rewrite history.
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
