import { attachDatabasePool } from '@neon/functions';
import { Pool } from 'pg';
import { createCleanupHandler } from './handler';
// Supply the dedicated cleanup login, never Neon default owner DATABASE_URL.
if (!process.env.HMS_CLEANUP_DATABASE_URL) throw new Error('Restricted cleanup database URL required');
const pool = new Pool({ connectionString: process.env.HMS_CLEANUP_DATABASE_URL, max: 1 });
attachDatabasePool(pool);
export default createCleanupHandler(async () => {
  await pool.query('SELECT hms_cleanup_expired_workspaces()');
});
