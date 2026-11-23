# Reservit exact-query hotel response cache — 2026-11-23

## Implementation

Official hotel searches now use the durable provider-response cache for exact positive Reservit observations. The key hashes the complete normalized hotel query, including the verified destination, stay dates, adult ages, child ages, room count and assignments, selected property URL, and search limits. A hit bypasses property discovery, official-page reads, and Best Price requests. The 30-second maximum is capped by each quoted offer's freshness deadline.

Only complete scans with positive offers, successful observed/no-match source rows, and a result accepted by the existing hotel worker validator are stored. Cached results are revalidated against the exact query, property/destination evidence, CAD amount, occupancy, room allocation, and freshness. Failed or partial scans, empty results, invalid results, and stale room quotes are not cached. A hit keeps the original observation timestamps and marks source rows `cacheStatus: hit`.

## Verification

- `tests/official-hotels.test.mjs`, `tests/hotel-worker-result.test.mjs`, and `tests/official-hotel-worker.test.mjs`: **23/23 passed**.
- Durable-store regressions confirm a same-query hit makes no second discovery, official-page read, or rate request; changing an adult's age misses; the original `observedAt` is preserved. A second actual worker process reuses the SQLite entry, even though destination-resolution evidence receives a new observation timestamp.
- Fixture evidence only. No live Reservit response or speedup is claimed.
- Full `npm test`: **704/704 passed**. `npm run build`: **passed on retry after the Next.js security reminder**. `npm audit --audit-level=low`: one moderate Next.js advisory remains. `git diff --check`: passed.

## Limits

This cache accelerates repeated identical searches; it does not make property inventory simultaneous, establish checkout availability, add taxes/fees, or change the direct booking handoff. Current hotel source and property/engine authorization limits remain in the implementation map.
