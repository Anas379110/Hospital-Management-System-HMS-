-- Preflight duplicate active allocations before applying to an existing database.
-- The migration intentionally fails rather than deleting or selecting patient records.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_time_unique
ON appointments (doctor_id, scheduled_at)
WHERE status != 'cancelled';

CREATE UNIQUE INDEX admissions_one_active_per_bed
ON admissions (bed_id)
WHERE discharged_at IS NULL;
