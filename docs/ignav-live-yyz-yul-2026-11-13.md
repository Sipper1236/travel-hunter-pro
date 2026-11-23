# Live Ignav YYZ–YUL one-way verification — 2026-11-13

## Exact request

- Route: YYZ → YUL, Canadian domestic.
- Departure: 2026-12-15; one-way.
- Party: 1 adult, 0 children; no age was supplied or inferred.
- Cabin: economy; requested provider: Ignav only; currency: CAD.
- Filters: no price, stop, duration, airline, country, or layover restriction.
- Submitted at 2026-11-13 19:09 UTC through the local owner-bound `/api/search/jobs` endpoint. The local worker executed the job. No API key, owner token, job capability, or raw provider capture was written to this note.

## Observed result

The job completed with Ignav source status `ok`: **20 received, 20 accepted, 0 rejected** by the current shared flight-offer validator. The first sorted offer was CAD 169, YYZ–YUL nonstop on WestJet flight WS 916, departing 10:00 and arriving 11:30 local on Dec 15. Its provider observation timestamp was `2026-11-13T19:09:15.269563Z`. Other accepted observations included Porter and Air Canada. Segment airport and flight identities were present in the normalized result.

This demonstrates one exact-date, one-way, one-adult economy query through the local job API, durable worker, configured live Ignav adapter, shared validator, and result status.

## Additional live website-to-worker check

At approximately 2026-11-13 19:11 UTC, Chromium submitted a second Canadian query in the actual website: YYZ → YUL, 2026-12-16, one-way, economy, one adult, zero children, Ignav only. The page showed **23 observed prices**; the source row reported `Ignav / search: ok · 23 usable of 23 returned`. The first card showed CAD 169 for WestJet, YYZ → YUL nonstop, 10:00–11:30 local. Browser errors: 0. Off-origin browser requests: 0. This demonstrates the live UI → local job API → worker → Ignav → validated result → rendered offer path for this query shape. It is a second request on a different departure date, not a repeated query or a regional scan.

## Limits

These were provider observations, not refreshed seller quotes or confirmed availability. Baggage, mandatory charges, fare conditions, passenger eligibility, and checkout price were not verified. No seller handoff was opened; nothing was booked or reserved. The sample covers one airport pair, two departure dates, one cabin, one party shape, and one provider. It is not a lowest fare guarantee, regional result, exhaustive search, or proof of current bookability.

The local service returned to health `ok` after completion with queue depth 0, one live worker, zero expired leases/deadlines, and nine stale historical worker records. The site remains loopback-only.
