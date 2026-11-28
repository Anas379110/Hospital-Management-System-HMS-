# Render connection rate limit identity

Opt-in only: HMS_PUBLIC_DEMO=true and HMS_RATE_LIMIT_IDENTITY=render-cloudflare.
Do not enable on any other hosting path without requalifying its edge contract.
Express trust proxy remains unchanged. No XFF position or trusted hop count.
A single syntactically valid CF-Connecting-IP becomes the connection bucket.
Absent, duplicate or invalid values share one global conservative fallback bucket.
The fallback deliberately does not depend on socket address or forwarded headers.
IPv6 equivalents are canonicalized and grouped by /64 before key hashing to
limit rotation within a delegated network. Different /64s remain separate. Larger /56 or /48 delegations can still rotate
across /64s; the 100-workspace cap and expiry are separate backstops.
IPv4-mapped addresses collapse to the IPv4 key. Unknown configuration fails startup.
Nest throttler retains its existing per-route limits and TTL. No new identity logs.
This is not a user identity, distributed abuse defense or durable quota. NAT and
Workers can share buckets; process restarts reset the in-memory counters.

## Contract and limits, verified 2026-11-27

https://developers.cloudflare.com/fundamentals/reference/http-headers/
CF-Connecting-IP is the connecting client seen by Cloudflare, delivered to origin.
Cloudflare recommends it over the appendable XFF chain. Same-zone Worker subrequests
can reflect Worker-altered x-real-ip; cross-zone Workers share a fixed Worker IP.
Pseudo IPv4 may replace the address. These are provider limitations, not per-person
separation promises. We do not own or modify the provider Cloudflare zone.

https://render.com/articles/how-render-handles-ddos-attacks
Render documents all inbound traffic as going through Cloudflare.
https://render.com/docs/web-services
The application listening port is not directly reachable from the internet.
https://render.com/docs/private-network
https://render.com/docs/free
Free web services do not receive private network inbound traffic.
Origin bypass is excluded by documented deployment contract, not direct measurement.

## Hosted evidence before this change

One network, one diagnostic process/window: CF and True-Client-IP agreed with the
provider-appended client slot. Forged XFF moved its first slot, not CF or TrueClient.
Forged TrueClient reached app 200 and was overwritten. Forged CF received edge 403,
which is NOT an origin overwrite measurement. Two different network clients have
NOT been measured. Diagnostic values were short-lived keyed digests, no raw IPs.
Local fixture separation, duplicate/case/IPv6 tests are not hosted network proof.
The owner chose this conditional approach over global bootstrap plus signed session
on 2026-11-27 after hearing the second-network limitation. Keep these limits visible.
