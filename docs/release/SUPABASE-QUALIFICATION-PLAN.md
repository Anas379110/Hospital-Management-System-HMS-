# Provider qualification, CI and hosted acceptance

This is a test plan, not deployment evidence. The original showcase and PR4 remain unchanged.

## Independent work before scheduled cleanup proof

Local source staging and portable CI do not depend on a successful hosted cron run. Stage a separate qualification branch based on 9327802f55c2439d27743c72fefe2c6d201b911e. Keep the existing PostgreSQL17/18 workflow. It exercises unit tests, mock HTTP tests, real PostgreSQL concurrency, six functional browser suites, isolated demo tests and legacy function tests. Hosted Supabase audit is a separate live qualification step, not injected into generic PostgreSQL CI, because its role and cron catalogs are provider-specific. No owner secret goes into public CI. Record the new exact commit and the actual remote matrix before adoption. Local staging is not publication or merge.

## Dependencies

Source publication/remote CI is not technically blocked by the 15:00Istanbul scheduled run. Final hosted audit and the scripted resume gate are blocked until an actual success of the current guarded cleanup command exists. The next normal run is 12:00UTC on27November2026. Do not shorten its schedule or insert fake history. No paid service or real project pause is needed.

## Network and client acceptance

1. Deploy only a new isolated Free qualification service after source/authority gates. Keep existing showcase unchanged, no auto-deploy to the old service. Never expose the owner/cleanup URLs to the web process. Run in Frankfurt if available, with one instance and connection_limit2. Configure /api/v1/health as the cheap liveness path. No migration at ordinary web startup.
2. Runtime startup must prove demo mode, strict remote TLS and restricted grants before listening. Capture actual environment behavior, not secrets. Await operational audit/resume evidence before general visitor access. A qualification endpoint must remain controlled until all activation gates pass.
3. Verify actual socket peer and forwarding headers without durable visitor/IP logging. Do not trust arbitrary X-Forwarded-For, a hop-count guess or outbound IP ranges. Inject forged chains and require rate limiting to remain on a stable trusted identity; test two independent clients are not collapsed into a single key. If a stable supported edge identity cannot be established, activation stays blocked.
4. Current Axios client has no configured timeout and no automatic retry. This avoids a short client timer that falsely labels an in-flight mutation as failed, but is not acceptable proof of bounded UX. Measure browser-visible request times and pending-button state through the actual proxy with mixed invoices/items and another real mutation. Check 503/Retry-After, expiry, isolation, DB commit counts and audit counts after pressure. Do not retry mutations automatically. Network interruption can leave a mutation outcome unknown; inspect its resulting record before resubmitting.
5. Test client disconnect during queued and active writes. Capacity stays held until DB work settles, not response close. Confirm counts afterwards. The24pending-transaction and24handler limits are per instance, not cluster capacity. A successful36request test created12invoices and returned24bounded503, not a24write capacity promise.
6. Record actual end-to-end bounds. maxWait30seconds plus execution10seconds are transaction limits, not an HTTP deadline, because guard and domain transactions are sequential. Avoid adding a timer that sends503 while a commit can still finish. If a UX bound requires cancellation, it must cancel or reconcile the transaction, not just abandon the response. Do not close this gate using only direct-ORM or local HTTP numbers.

Current official Render docs say HTTP responses can take up to100minutes: https://render.com/docs/render-vs-vercel-comparison . This is a platform ceiling, not a suitable HMS UX bound or proof of the deployed path. Render terminates inbound TLS then forwards HTTP: https://render.com/docs/web-services . Actual proxy/client behavior and identity still require testing.

## Recovery and ongoing operation

Free project backups are unavailable in the actual dashboard. No export/import or paid restore is used. The scripted resume gate is non-disruptive; its success is not evidence that pause preserves grants/jobs/TLS. Provider persistence across pause remains untested. Access expires at24hours idle, physical deletion awaits cleanup, including after any provider pause. Check latest exact-command scheduled cleanup success at least hourly while enabled and at every resume. Failure/staleness blocks activation and requires investigation. No automated shutdown/monitoring deployment is claimed by this plan.
