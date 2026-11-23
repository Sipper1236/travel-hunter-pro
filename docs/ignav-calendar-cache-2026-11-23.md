# Ignav fare-calendar cache coverage — 2026-11-23

## Change

Calendar jobs now pass the shared SQLite job store to the calendar provider dispatcher. The dispatcher forwards that cache to each exact provider search, allowing Ignav's existing cache policy to reuse a fresh, complete, exact-query result across calendar jobs and independent worker connections.

Cache eligibility remains deliberately narrow: count parties only; exact route, date, trip, passenger counts/ages, cabin, filters, market, currency and account scope; CAD only; complete valid offers; and an unexpired observation. Cache hits preserve the original provider observation timestamps. Empty, stale, invalid, mismatched, identified-traveler and infant results are not cached.

## Regression evidence

`tests/calendar-search.test.mjs` exercises the public `searchFareCalendar` path with a disposable persistent SQLite store. The first calendar request populates the cache. After closing that store, a second independent store connection runs the same query and verifies:

- exactly one provider invocation across both searches;
- the fare's original `observedAt` is unchanged;
- the calendar source coverage reports `cacheStatus: hit`.

The regression failed before wiring because the second calendar search invoked the provider again. After wiring, focused calendar/provider suites pass **71/71**, full `npm test` passes **679/679**, and `npm run build` passes after retrying past Next.js 16.4.3's security reminder. No live provider query was made; there is no measured provider latency improvement or live quote evidence in this change.

## Files

- `lib/calendar-search.mjs` forwards the cache to provider search adapters.
- `scripts/flight-job-runner.mjs` supplies the persistent shared job store to calendar jobs.
- `tests/calendar-search.test.mjs` covers reuse across independent persistent store connections.

This extends Ignav cache coverage to the calendar worker path. It does not establish cache behavior for other providers or close the broader reverse-endpoint implementation and `work.md` §17 requirements.
