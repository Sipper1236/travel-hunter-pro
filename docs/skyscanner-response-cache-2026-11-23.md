# Skyscanner exact-query response cache — 2026-11-23

## Implementation

The normal provider dispatcher now supplies its durable SQLite response cache to the Skyscanner adapter. Successful, completed, nonempty results may be reused for at most 30 seconds; expiry is reduced to the earliest offer freshness deadline. The cache key hashes the effective API key and includes the exact Canadian route, dates/trip type, count party and child ages, cabin, filters, and poll budget/interval.

Cache reads validate the normalized query, successful source row and offer counts, polling accounting, session and itinerary identifiers, each exact itinerary, and quote freshness. Invalid cached results are evicted and a new search is made. Partial and empty results, identified parties and unsupported inputs do not cache. Cache hits preserve original timestamps and session/itinerary identifiers. This is a local reuse policy; it does not establish provider freshness or seller availability.

## Verification

- Focused `tests/skyscanner.test.mjs` and `tests/providers.test.mjs` cover exact reuse, original timestamp/session preservation, effective-account and date isolation, tampered-route eviction, partial-result bypass, and identified-traveler exclusion.
- Focused tests: **33/33 passed**. Full `npm test`: **701/701 passed**.
- `npm run build`: passed on retry after Next.js 16.4.3's security reminder. `npm audit --audit-level=low` reports one moderate Next.js advisory; the suggested forced 16.4.6 update is outside the declared dependency range and was not applied.
- `git diff --check`: passed.
- Fixture tests only; no Skyscanner provider request was made.
- `SKYSCANNER_API_KEY` is not configured in this environment. Partner entitlement, live response stability, provider quota, session-token lifetime and measured latency remain unverified.
