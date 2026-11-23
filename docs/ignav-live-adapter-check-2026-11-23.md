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

The same bounded query was then submitted to an isolated local production server using a disposable SQLite database and an owner-bound job token. The job endpoint returned HTTP 202; the worker completed in 3,056 ms, persisted progress, and reported Ignav `ok` with 25 accepted offers. Output was limited to status, elapsed time and aggregate counts. Current code inspection confirms that a new job starts with an empty route checkpoint, `searchProviders` dispatches the Ignav source, and `searchIgnav` calls the shared HTTP transport; this path does not read a cached flight result. Together with the direct adapter response above, this verifies a fresh provider-backed request through the production HTTP/worker/result-persistence path for this exact query shape. It does not verify browser rendering or p95 latency. No browser was used.

## Next verification

Run a browser-visible query against the local production stack to verify that persisted Ignav results render progressively. Record source-specific latency and coverage without printing fare details or secrets; this single run is not p95 evidence.
