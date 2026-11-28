-- Run after structural audit, including every resume while traffic stays disabled.
-- The exact current command must have succeeded in the last 90 minutes.
SELECT j.jobname,r.end_time AS last_success,
 coalesce(r.status='succeeded' AND r.end_time>=now()-interval '90 minutes',false) AS healthy
FROM cron.job j
LEFT JOIN LATERAL (
 SELECT d.status,d.end_time FROM cron.job_run_details d
 WHERE d.jobid=j.jobid AND d.command=j.command
 ORDER BY d.start_time DESC LIMIT 1
) r ON true
WHERE j.jobname='hms-hourly-expiry-cleanup';
