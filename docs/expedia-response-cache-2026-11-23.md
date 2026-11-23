# Expedia Travel Redirect exact-query cache — 2026-11-23

## Implementation

Normal Expedia partner listings searches can reuse a successful, positive, fresh exact-query result from the durable provider cache for up to 30 seconds, capped by the earliest offer freshness deadline. Identity binds route, exact dates/trip, count party and child ages, cabin, filters, Canada/CAD, and a hash of both effective partner credentials. The raw credentials are not written into the cache key or result.

Reads revalidate the normalized query, successful Expedia source counts, complete CAD itinerary and quote freshness, exact offer/selection evidence, split-ticket state, and an HTTPS Expedia seller URL. Invalid entries are removed and the partner is queried again. Empty/price-only/stale/mixed-invalid results and identified parties are not cached. Seller refresh still calls the provider directly to reprice the exact selected flights; the response cache does not satisfy refresh.

## Verification

- `tests/expedia.test.mjs` and `tests/providers.test.mjs`: **25/25 passed**.
- Regressions cover reuse with preserved `observedAt`, exact filter and credential isolation, and eviction of a tampered non-Expedia seller URL.
- Full `npm test`: **703/703 passed**.
- `npm run build`: **passed**. Next.js emitted its existing security reminder after the successful build.
- `npm audit --audit-level=low`: **one moderate Next.js advisory remains**; the suggested forced fix is outside the current declared dependency range and was not applied.
- `git diff --check`: **passed**.
- Fixture only. Expedia partner credentials are not configured locally; no live response or speedup is claimed.
