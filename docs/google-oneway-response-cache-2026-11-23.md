# Google native exact-query response caches — 2026-11-23

## Change

Added exact-query durable caches for validated Google native one-way and count-party round-trip results in `lib/google-response-cache.mjs`, connected through the existing `searchSource` dispatcher. One-way caching applies to its supported one-adult, economy shape; round-trip caching applies only to exact count parties accepted by `googleRoundTripParty`. Both work when Google is selected alone and within all-source fan-out. Identified travelers are never eligible for round-trip caching.

The cache key hashes the provider/version and Canada/CAD locale together with exact airport route, dates, count party and ages, cabin, and normalized filters. It stores no raw query or traveler identity. A result is reusable only while all offers remain fresh and match the canonical request. One-way results must retain the exact generated Google results URL; round-trip results must retain a valid Google booking URL, matching fare category echoes, and the exact selected-flight identity derived from both directions. Both paths must pass the complete-itinerary validator. Empty, stale, malformed, tampered, or mismatched responses are not cached. A hit preserves the original `observedAt` and marks the Google source row `cacheStatus: hit`. Maximum lifetime is 60 seconds for one-way and 30 seconds for round-trip, each capped by offer freshness.

## Verification

- Live guarded check: one exact YYZ→LHR one-way query for 2027-02-12, one adult/economy, returned 10 validated Google offers in **5,083 ms**. An immediate identical request through the same in-memory SQLite provider store returned 10 offers with `cacheStatus: hit` in **3 ms**. The second operation reused the first observation; it did not make another Google request. No prices, flight identifiers, or response payloads were recorded. These are two samples from one query, not a p95 or a provider-latency guarantee.
- A bounded live YYZ→LHR return query (2027-03-10 through 2027-03-17, one adult/economy) ended `invalid_response` after **6,399 ms** with zero validated offers. It was not retried. This is an adapter evidence failure, not evidence that no flights were available; no round-trip cache entry was produced.
- Round-trip count-party cache behavior is fixture/store-tested for exact dates and child ages, query changes, tampered itinerary identity, empty/stale responses and identified-party exclusion. No live round-trip cache-hit timing was measured.
- `node --test tests/google-response-cache.test.mjs tests/providers.test.mjs`: **23 passed, 0 failed**.
- `npm test`: **693 passed, 0 failed**.
- `npm run build`: passed on retry. The first attempt compiled and generated routes, then stopped at Next.js 16.4.3's security-upgrade reminder; the retry completed and retained the advisory warning.
- `npm audit --audit-level=low`: one moderate Next.js advisory; npm recommends a forced update to 16.4.6, outside the declared dependency range. No dependency change was made.
- `git diff --check`: clean before documentation updates.

## Limits

These caches do not make the underlying unofficial Google web-app RPC public, establish unattended-use permission, refresh seller availability, or broaden party/cabin/trip support. They do not cache price-only calendar observations. The live timing covers only a one-way exact route/date/query; it does not establish round-trip cache speed, source stability or p95. Existing provider-policy, source-stability, seller-refresh and `work.md` §17 gates remain open.
