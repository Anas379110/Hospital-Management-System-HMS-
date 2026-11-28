// Shared transaction primitive. No CLI, connection creation, credential or live
// approval handling. Caller must separately prove authority/target/backup first.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
const migrationName = '20261128005000_department_waitlist';
const hash = value => createHash('sha256').update(value).digest('hex');
const pins = {
 migration: 'dae1aaa83bfaa9c87dec396ec692ad5d6347f99923a797bfda8b550de8980a8f',
 grants: '524a43d1c8d65c462f1b45557afd867c3acee602e9b02b87a379facdd8e19874',
};
export async function applyValidatedWaitlistUpgrade(client, backendRoot, structuralAuditSql) {
  const migration = readFileSync(backendRoot + '/prisma/migrations/' + migrationName + '/migration.sql', 'utf8');
  const grants = readFileSync(backendRoot + '/prisma/demo/waitlist-grants.sql', 'utf8');
  assert.equal(hash(migration), pins.migration); assert.equal(hash(grants), pins.grants);
  // Advisory transaction lock matches Prisma Migrate's PostgreSQL lock key.
  // Nonblocking: stop rather than race another migration or wait indefinitely.
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'");
    const lock = (await client.query('SELECT pg_try_advisory_xact_lock(72707369) locked')).rows[0];
    assert.equal(lock.locked, true, 'Another migration holds the advisory lock');
    const identity = (await client.query("SELECT current_user,pg_has_role(current_user,'hms_migration','USAGE') inherited")).rows[0];
    assert.equal(identity.current_user, 'postgres'); assert.equal(identity.inherited, true);
    const history = (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;
    const expected = readdirSync(backendRoot + '/prisma/migrations').filter(name => /^\d/.test(name) && name < migrationName).sort();
    assert.deepEqual(history.map(row => row.migration_name), expected, 'Unexpected or duplicate migration ledger');
    for (const row of history) {
      assert.ok(row.finished_at && !row.rolled_back_at, 'Unfinished migration');
      assert.equal(row.checksum, hash(readFileSync(backendRoot + '/prisma/migrations/' + row.migration_name + '/migration.sql')), 'Existing migration checksum drift');
    }
    assert.equal((await client.query("SELECT to_regclass('public.waitlist_requests') relation")).rows[0].relation, null, 'Table already exists');
    await client.query(migration);
    await client.query(grants);
    const id = randomUUID();
    await client.query('INSERT INTO _prisma_migrations(id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES($1,$2,clock_timestamp(),$3,NULL,NULL,clock_timestamp(),1)', [id, pins.migration, migrationName]);
    // Audit inside the same transaction: failure rolls back table, grants and ledger.
    await client.query(structuralAuditSql);
    const ledger = (await client.query('SELECT id,checksum,migration_name,applied_steps_count,finished_at IS NOT NULL finished,rolled_back_at IS NULL not_rolled_back FROM _prisma_migrations WHERE id=$1', [id])).rows[0];
    assert.equal(ledger.checksum, pins.migration); assert.equal(ledger.applied_steps_count, 1); assert.equal(ledger.finished, true); assert.equal(ledger.not_rolled_back, true);
    await client.query('COMMIT');
    return { migrationName, checksum: pins.migration, ledgerId: id, atomicTableGrantsLedger: true };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
