# Ignav live adapter check — 2026-11-23

## Request and result

- Route: YHZ→LAX
- Departure: 2027-01-15, one-way
- Party/cabin/market: one adult, economy, Canada
- Scope: one read-only direct adapter call using the configured Ignav credential
- Result: `ok`; 58 rows received, 25 accepted, 33 rejected
- Adapter elapsed time: 7,438 ms
- Observation time: 2026-11-23T04:40:23.735874Z

The request output was deliberately limited to status, counts, elapsed time, and observation time. No credentials, raw response, identifiers, passenger data, or prices were recorded.

## What this establishes

The configured Ignav endpoint responded successfully to this exact query, and the adapter accepted 25 normalized rows under its current validation rules. The result is a direct adapter check, not a durable search job or website-rendering check. It does not establish itinerary completeness, current seller availability, price freshness, tax/baggage inclusion, or reliability for other routes, dates, party shapes, or filters.

## Durable worker follow-up

The same bounded query was then submitted to an isolated local production server using a disposable SQLite database and an owner-bound job token. The job endpoint returned HTTP 202; the worker completed in 3,056 ms, persisted progress, and reported Ignav `ok` with 25 accepted offers. Output was limited to status, elapsed time and aggregate counts. The job result did not expose whether it reused cached data, so this verifies the production HTTP-to-durable-worker integration and result persistence but does not prove that this second run made a fresh provider request. No browser was used, so website rendering remains unverified.

## Next verification

Inspect cache provenance on the completed job and, when permitted, run a browser-visible query against the existing local stack to verify that persisted Ignav results render progressively. Keep any cache-hit result distinct from a fresh provider response. Record source-specific latency and coverage without printing fare details or secrets.
