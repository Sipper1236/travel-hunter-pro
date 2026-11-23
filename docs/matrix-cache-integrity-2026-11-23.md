# ITA Matrix cache integrity — 2026-11-23

## Change

The SQLite-backed exact-query Matrix cache now applies the same strict checks on reads and writes:

- Cache only nonempty results with complete CAD itinerary offers and no price-only observations.
- Require the ITA Matrix source row to report success and matching accepted/received counts.
- Require the Matrix research URL and each offer's `observedAt` to match the normalized result.
- Re-run `flightOfferError` against the exact route, departure/return dates, and cabin, and check quote freshness.
- Delete an invalid cache row and make a new Matrix request rather than returning stale or malformed data.
- Cap the five-minute cache TTL at the earliest offer freshness deadline.

This avoids suppressing future inventory with cached empty or partial results. It does not assert live seller availability or booking price.

## Verification

- `node --test --test-reporter=dot tests/ita-matrix.test.mjs` — **30/30 passed**.
- Cross-process fixture test confirms a valid response is reused, cache expiry triggers another request, route/page-size and API-key changes isolate entries, and repeated empty/price-only responses each trigger a provider request.
- `git diff --check` — passed.
- No live Matrix request was made for this cache-integrity change.

## Limits

The earlier live cold search took 41,688 ms for one YYZ–LHR one-way query. This change does not improve cold-query latency and provides no p95 measurement. Matrix endpoint access terms, rate limits, response stability, and seller-side availability remain unverified. The five-minute maximum is a local cache policy, not a provider freshness guarantee.
