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

## First browser attempt — inconclusive

A first headless Chromium attempt used the visible flight form against an isolated local production app and waited up to 90 seconds for the completion announcement. Its harness did not preserve the submitted job ID or inspect final job/card state after that timeout, and cleanup removed the disposable database. That attempt alone was inconclusive; do not treat its locator timeout as a provider failure.

## Follow-up live browser result — 2026-11-23

A corrected headless Chromium run submitted the same exact Ignav-only query through the visible form and captured the owner-bound job state. It completed in 3,108 ms. Ignav returned 58 rows, accepted 0, and rejected 25 for `quote_freshness` and 33 as `unusable`; the UI rendered 0 offer cards and showed its completion announcement without displaying an error. Browser errors: 0; external browser requests: 0; the job used a disposable database and was removed after inspection. This verifies the live empty/stale-result path and confirms that stale rows are withheld. It does not demonstrate positive live offer-card rendering; the separate production-build fixture check below verifies card rendering using fixture data only.

The source row's visible `reason` now translates these two internal rejection codes into user-readable explanations while retaining the original `rejectionReasons` codes/counts for diagnostics. The stale-result test asserts the 15-minute explanation and machine-readable counts.

## Next verification

Repeat a browser-visible query only after respecting source pacing and when fresh Ignav inventory is observed, then verify positive live offer-card rendering. This single 3.1-second job is not p95 evidence.

## Readable rejection summary implementation — 2026-11-23

`lib/ignav.mjs` now maps `quote_freshness` to “stale or expired quote (15-minute freshness limit)” and `unusable` to “row without usable fare or itinerary evidence”. Other reason codes are rendered as words instead of underscore-separated identifiers. The structured `rejectionReasons` object remains unchanged for diagnostics; no fares or source payloads are added to the explanation. Red/green focused regression: `node --test tests/ignav.test.mjs` **24/24**. Full suite: `npm test` **642/642**. `npm run build` stopped once at the Next.js security reminder and succeeded on identical retry. `npm audit --audit-level=low` reports one moderate Next.js 16.4.3 vulnerability; fix 16.4.6 is outside the declared range. No dependency upgrade was applied.

## Production-build fixture rendering check — 2026-11-23

Ran the existing progressive-flight browser check against an isolated local production build. Provider/job responses were intercepted and supplied from test fixtures; no live provider requests or external browser requests were made. The UI rendered the persisted partial result before completion, then the updated final result. Persistence-to-UI took 479 ms across three status polls; browser errors: 0. This verifies positive card rendering with fixtures only; it does not establish positive live rendering or a real-provider latency target.

## Exact-query cache implementation — 2026-11-23

The application now has a durable SQLite cache for exact Ignav flight queries through the ordinary API and durable-worker dispatch. Cache identity binds route/date/trip type, count party and exact child ages, cabin, filters, Canada market/CAD, and a SHA-256 hash of the configured Ignav key as account scope. It stores only nonempty results whose Ignav source is successful and whose every offer passes the normal exact-query, CAD, itinerary, and freshness validators. Cache lifetime is capped at five minutes and each offer's original usable-until time. A hit preserves original observation timestamps and is labeled in the UI. Identified travelers, infants, children without exact ages, invalid/empty results, and stale offers bypass storage. The SQLite cache is limited to 100 entries and 512 KB per result. This policy is specific to Ignav; other providers have no cross-job cache.

Focused tests passed 40/40 and full `npm test` passed 649/649. The production build passed after retrying past Next.js's security reminder. The rebuilt fixture browser check passed in 369 ms and asserted the cached-result label with provider requests intercepted, zero browser errors, and external requests blocked. No live request was made to produce or verify a warm-cache hit. This implementation therefore has reproducible fixture/test evidence only for cache reuse; live warm-hit behavior remains open. Audit continues to report the moderate Next.js 16.4.3 issue noted in the handoff.
