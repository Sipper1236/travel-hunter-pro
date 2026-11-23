# Flight offer segment evidence gate — 2026-11-13 20:31 UTC

## Change

The shared `flightOfferError` gate now rejects a complete flight offer when it has no segment array, an empty/oversized segment list, disconnected or route-mismatched segment endpoints, missing flight/carrier identity, missing segment timestamps, or summary departure/arrival timestamps that disagree with the first/last segment's local timestamps. Provider identity is now mandatory alongside source provenance, traveler scope, fare/cabin, freshness, itinerary, booking-status, and fee fields. Existing route- and query-level checks remain in place.

An actual flight itinerary cannot be inferred from a price, a route pair, a duration, or an empty `via` list. ITA Matrix rows without validated segment details continue to use the separate `priceObservations` path and are not promoted to complete flight offers. Google route-level outputs that omit exact segments are rejected instead of being displayed as complete offers.

For complete Matrix slices, normalization now also retains the provider's original offset-bearing departure and arrival values alongside UTC instants, so the shared gate can compare the visible local date/time to the observed segment stamps without losing the source offset.

The scope is deliberately limited to complete flight offers. Provider-specific chronology/time-zone validation still differs by adapter. Follow-up at 20:58 UTC added mandatory airport-timezone evidence and elapsed-UTC duration checks to ordinary Skyscanner search and refresh; see [the continuation note](skyscanner-timezone-integrity-2026-11-13.md). Other adapter-specific timezone evidence and worker schemas for hotels, packages, seller handoffs, and other result types still need their own complete contracts. These remaining items keep the broad P0 acceptance open.

## Verification

- Regressions cover missing/empty segment arrays, missing provider identity, and retention of Matrix's original offset-bearing segment stamps.
- Focused affected tests: `node --test tests/providers.test.mjs tests/search.test.mjs tests/calendar-search.test.mjs tests/flight-filters.test.mjs tests/quote-freshness.test.mjs tests/ita-matrix.test.mjs` — **103/103 passed**.
- Final full `npm test` — **551/551 passed** in 89.7 seconds.
- An earlier full run during this change had one native Google browser test exceed its 10-second internal deadline under full-suite load (550/551); the same test passed in isolation, and the subsequent complete run passed 551/551.
- `TRAVEL_NEXT_DIST_DIR=.next-strict-flight-offer-build npm run build` — passed.
- `npm audit --audit-level=low` — **0 vulnerabilities**.
- Production Chromium `check:flight-default` — passed; provider/job requests intercepted, zero browser errors, zero app CSP violations.
- Production Chromium `check:matrix-price-observation` — passed; CAD price-only labeling and seller caveats remain visible, zero browser errors; provider calls intercepted.
- The isolated production server used port 3001 and was stopped after checks. No supplier query was run for this change. No booking or reservation was made.
- The existing loopback site on port 3000 was left untouched; at 20:43:36 UTC root returned HTTP 200 and same-origin POST health returned `ok`, queue depth 0, one live worker, zero expired leases/deadlines, and nine stale historical worker records.
- The Skyscanner follow-up also passed a fresh isolated production build and controlled Chromium `check:flight-default` / `check:calendar-source` on port 3001; that temporary server was stopped. A generic health POST to port 3000 returned 403 and is not treated as a health result.

## Acceptance limit

This is test/build/browser evidence for fail-closed behavior, not live proof that all providers return complete and accurate segments. The P0 checklist remains open for full worker-result schemas, remaining source-specific chronology/time-zone gaps, live reproducible coverage, and seller-side verification.
