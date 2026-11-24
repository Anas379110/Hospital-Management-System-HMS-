import { PrismaClient } from '@prisma/client';

// Read-only deployment precheck. Does not migrate, cancel, delete or edit records.
const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRaw`
    SELECT count(*)::int AS conflicting_slots
    FROM (
      SELECT doctor_id, scheduled_at
      FROM appointments
      WHERE status != 'cancelled'
      GROUP BY doctor_id, scheduled_at
      HAVING count(*) > 1
    ) duplicates
  `;
  const count = Number(rows[0]?.conflicting_slots ?? 0);
  if (count > 0) {
    console.error(`STOP: ${count} active appointment slots contain duplicates. Authorized staff must resolve them before applying the slot-guard migration. No records were changed.`);
    process.exitCode = 1;
  } else {
    console.log('No duplicate active appointment slots found. This read-only check does not approve or apply a migration.');
  }
} catch {
  // Never print the connection URL, credentials or patient/appointment identifiers.
  console.error('Precheck could not verify appointment slots. Stop before migration and check database access with the administrator. No records were changed.');
  process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
