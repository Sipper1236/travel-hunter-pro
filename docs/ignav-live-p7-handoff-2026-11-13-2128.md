# Fresh Ignav seller-handoff response — 2026-11-13 21:28 UTC

## Exact query and website path

The production website at `http://127.0.0.1:3000` submitted one real, Ignav-only YYZ–YUL one-way search for 2026-12-16, economy, one adult. Chromium observed the local job submission; the existing worker completed it. Ignav returned 23 CAD observations, all 23 accepted by the shared validator. The selected lowest fresh matching quote was CAD 169, observed at `2026-11-13T21:28:25.173490Z`; the search result timestamp was `2026-11-13T21:28:25.305Z`.

## Read-only owner-bound handoff

The local owner-bound booking-links endpoint was called once for that stored offer. It returned HTTP 200, `priced_handoff`, and `itineraryMatch: matched`. The handoff's provider-reported verified itinerary price was CAD 169. It listed five provider-priced link entries, with `specificity: unknown`; the seller destination pages were not opened. `coverageStatus: complete` describes mapped link coverage, not seller availability or a completed booking.

The same response reported:

- `sellerAvailabilityStatus: not_checked`
- baggage: `null`
- `mandatoryChargesStatus: not_itemized`
- seller observation timestamp: absent
- booking status: not booked

The displayed CAD 169 is a fresh provider observation and matching provider handoff price, not a seller-confirmed current total. Availability, baggage allowance, mandatory/conditional charges, fare rules and checkout price remain unverified.

Browser errors and off-origin browser requests: zero. Same-origin health afterward returned HTTP 200/`ok`, queue depth 0, one live worker, zero expired leases/deadlines, and nine stale historical worker records. No seller URL, checkout, reservation or purchase was opened or attempted. This is one Canadian airport pair, one date, one adult and one source; it does not establish broad seller coverage or a market minimum.

Additional current production-browser handoff presentation check: `npm run check:booking-links` passed after the live observation. Its controlled matched-price and mismatched-itinerary cases used intercepted fixture responses and blocked external requests; it verified that provider price scope, seller host, availability/booking caveats, mandatory-charge caveat, and seller-link suppression on mismatch are visible, with zero browser errors. This controlled UI check does not expand the live seller evidence above.
