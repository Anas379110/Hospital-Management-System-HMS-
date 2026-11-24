CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_time_unique
ON appointments (doctor_id, scheduled_at)
WHERE status != 'cancelled';
