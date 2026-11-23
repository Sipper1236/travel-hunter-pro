# Google native one-way response cache — 2026-11-23

## Change

Added an exact-query durable cache for validated Google native one-way results in `lib/google-response-cache.mjs`, connected through the existing `searchSource` dispatcher. It applies to the same one-adult, economy, one-way shape that the native results-page adapter supports and works both when Google is selected alone and within all-source fan-out.

The cache key hashes the provider/version and Canada/CAD locale together with exact airport route, departure date, supported trip/party/cabin, and normalized filters. It stores no raw query or traveler identity. A result is reusable only while all offers remain fresh, match the canonical request, retain the exact generated Google results URL, and pass the normal complete-itinerary validator. Empty, stale, malformed, tampered, or mismatched responses are not cached. A hit preserves the original `observedAt` and marks the Google source row `cacheStatus: hit`. The maximum cache lifetime is 60 seconds and is capped by each offer's existing quote-freshness deadline.

## Verification

- Live guarded check: one exact YYZ→LHR one-way query for 2027-02-12, one adult/economy, returned 10 validated Google offers in **5,083 ms**. An immediate identical request through the same in-memory SQLite provider store returned 10 offers with `cacheStatus: hit` in **3 ms**. The second operation reused the first observation; it did not make another Google request. No prices, flight identifiers, or response payloads were recorded. These are two samples from one query, not a p95 or a provider-latency guarantee.
- `node --test tests/google-response-cache.test.mjs tests/providers.test.mjs`: **20 passed, 0 failed**.
- `npm test`: **690 passed, 0 failed**.
- `npm run build`: passed on retry. The first attempt compiled and generated routes, then stopped at Next.js 16.4.3's security-upgrade reminder; the retry completed and retained the advisory warning.
- `git diff --check`: clean before documentation updates.

## Limits

This cache does not make the underlying unofficial Google web-app RPC public, establish unattended-use permission, refresh seller availability, or broaden party/cabin/trip support. It does not cache Google round trips or price-only calendar observations. The live timing is one exact route/date/query sample and does not establish source stability or p95. Existing provider-policy, source-stability, seller-refresh and `work.md` §17 gates remain open.
