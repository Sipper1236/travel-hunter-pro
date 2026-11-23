# ACV structured package response cache — 2026-11-23

## Implementation

ACV package workers can reuse exact positive responses from the ordinary widget's structured `GET /packages-search/search` operation through the durable SQLite provider cache. Cache identity hashes the fully validated package query: airport and selected location labels, dates, adults, exact child ages, infant count, rooms/allocations, cabin, filters, page limits, and budget.

Only a fresh, positive structured-widget result that passes `packageWorkerResultError` is stored. The 30-second maximum is capped by offer freshness. Cache hits bypass currency-terms fetch, browser launch, widget interaction, and the package request; they preserve original source/offer observations and emit a cache-hit progress event. Empty, stale, invalid, page-load-incomplete, and rendered-DOM fallback results are not cached. Structured coverage such as additional packages beyond the first page stays explicit.

## Verification

- Focused `tests/vacation-normalize.test.mjs`, `tests/package-worker-result.test.mjs`, and `tests/vacation-search.test.mjs`: **41/41 passed**.
- Fixture regression normalizes a provider-shaped package response, validates it with the production worker gate, proves same-query reuse and observation-time preservation, and confirms a changed stop filter has a distinct cache identity.
- Full `npm test`: **705/705 passed**. `npm run build`: **passed after retrying past the Next.js security reminder**. `npm audit --audit-level=low`: one moderate Next.js advisory remains. `git diff --check`: passed.
- Fixture evidence only. No live ACV response or latency improvement is claimed.

## Limits

This is a warm exact-query optimization, not live availability confirmation. Existing widget access-scope and rate-policy evidence, offset-aware complete flight segments, checkout availability, mandatory local fees, and final seller totals remain open. Direct unauthenticated endpoints are not used and widget credentials are not extracted or replayed.
