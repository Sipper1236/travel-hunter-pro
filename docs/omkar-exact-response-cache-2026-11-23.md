# Omkar exact-response cache — 2026-11-23

## Change

Added an exact-query SQLite cache to the ordinary `searchProviders` path for Expedia via Omkar. It is limited to one-adult, one-way searches and binds the exact airports, date, cabin, filters, selected airport labels, Canada/CAD market, and a hash of the configured Omkar account key. Maximum lifetime is 30 seconds and is capped by the offer's freshness deadline. Hits preserve the original observation timestamp.

Only nonempty complete CAD itinerary offers with exact source/query evidence and current quote freshness can be reused. Price-only observations, mixed priced/price-only results, empty results, stale or malformed results, round trips, children, identified parties, and unsupported passenger fields bypass the cache. Invalid persisted matches are deleted before a fresh provider call.

## Verification

- The provider-seam regression was red before the change: an identical second `searchProviders` query invoked the adapter again. It now makes one adapter call and returns the exact fresh offer from cache.
- Focused cache suite: **4 passed, 0 failed**, including changed-filter/airport/cache-key cases, original timestamp retention, and price-only/stale/unsupported bypass.
- An actual durable flight-job regression runs two separate worker child processes against the same SQLite job store. A test-only transport fixture supplies one validated offer; the second job reports `cacheStatus: hit`, preserves the original `observedAt`, and the fixture log confirms exactly one upstream request.
- Durable worker suite: **1 passed, 0 failed**. `npm test`: **698 passed, 0 failed**.
- `npm run build`: passed after retrying the Next.js 16.4.3 security reminder.
- The worker fixture is test-only and no production result uses synthetic fares. No live Omkar response was cached or queried for this change. The latest bounded live wrapper response lacked explicit CAD and offset-aware times, so it yielded no cacheable complete offer. This establishes fixture-backed worker/cache behavior only, not live speedup or Omkar quote reliability.

## Remaining work

Confirm the wrapper's terms, quota and schema before any further live query. Do not infer a CAD fare or segment instants from the prior response. The 30-second cache does not establish seller availability or final checkout price; endpoint scope, live cache-hit evidence, and broader reverse-endpoint acceptance remain open.
