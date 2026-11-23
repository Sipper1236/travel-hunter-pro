# Seller-link price freshness semantics — 2026-11-14

## Change

Ignav's booking-links response can provide an overall `observed_at`, but the current payload does not provide a timestamp for each seller link price. The UI previously labeled a link price “provider-reported verified” without separately stating that the link price itself had no verifiable timestamp. The API now reports:

- `providerResponseFreshnessStatus`: freshness of the overall response timestamp under the app's 15-minute policy (`fresh`, `stale`, or `unknown`).
- `linkedPriceFreshnessStatus: "unknown"`: kept unknown because no timestamp is bound to the individual link price.
- `linkedPriceEvidenceStatus`: retains the provider's `verified`/`unverified` price status without converting it into seller checkout confirmation.

The UI labels both scopes separately. It continues to state that seller availability is unchecked, baggage/mandatory charges are not seller-confirmed, and no reservation or purchase occurs. Unknown RFC 3339 offset `-00:00` is no longer accepted as an observed response timestamp.

## Verification

- Focused `tests/ignav.test.mjs` plus `tests/booking-links-route.test.mjs`: 27/27 passed; `node --check scripts/check-booking-links-ui.mjs` passed.
- Full `npm test`: 591/591 passed (87.3 seconds).
- `TRAVEL_NEXT_DIST_DIR=.next-seller-freshness npm run build`: passed on Next.js 16.4.3.
- `npm audit --audit-level=low`: zero vulnerabilities.
- Fresh-build `check:booking-links` passed on port 3001; provider/jobs were intercepted, external requests blocked, zero browser errors. The temporary server was stopped; existing port 3000 was not changed.
- No live seller endpoint or seller website was queried/opened.

## Remaining seller-verification gap

No per-link timestamp, seller inventory response, baggage allowance/fee quote, mandatory-charge breakdown, or checkout total is available from this handoff payload. These values stay unverified; the updated presentation does not claim current seller inventory or a bookable offer. §17 P7 remains Partial.
