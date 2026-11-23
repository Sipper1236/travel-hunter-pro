# Booking.com Demand conditional-charge disclosure — 2026-11-13

## Finding and change

The Booking.com hotel adapter previously substituted an empty total when the response omitted the `conditional` charge category and no product-level conditional array was available. That could label fee details as supplied even though the response had not supplied them. It also rejected a hotel observation when a conditional charge had a `null` amount, although such a charge is excluded from the search total and may be disclosed as unknown.

The adapter now distinguishes three cases: positive priced conditional charges, an explicit empty conditional-charge list, and unavailable or incalculable conditional amounts. Unknown conditional fees no longer invalidate an otherwise supported search observation, but the result explicitly says conditional/incalculable charges may apply and their complete amounts were not supplied. Missing or invalid included/excluded charge totals still fail closed. No conditional fee is added to the expected total.

The result now also preserves the provider's charge IDs, calculation modes, conditional-condition IDs, and `chargeable_online` values when present. It does not invent human-readable charge names or infer that charges marked not chargeable online are necessarily payable at the property. Aggregate numeric values are labeled as aggregate when charge IDs were absent.

This follows Booking.com Demand API guidance: search/availability exposes included, excluded, and conditional categories; conditional charges are outside the returned price totals; incalculable charges can have `null` amounts; search prices are estimates and the final payable total requires an order preview. See [extra-charge calculation](https://developers.booking.com/demand/docs/accommodations/charge-calculation) and [pricing troubleshooting](https://developers.booking.com/demand/docs/accommodations/pricing-troubleshooting).

## Verification

- `node --test tests/booking.test.mjs tests/flight-hotel.test.mjs` — 22/22 passed. Cases cover explicit empty lists, omitted categories, incalculable amounts, priced conditional fees, charge IDs, fee modes, condition IDs, and explicit provider online-collection flags.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:flight-hotel-demand` — passed. The controlled two-room child-party page displays charge IDs/modes/conditions and provider collection flags together with the missing conditional-amount caveat; all provider/job responses were intercepted, with zero browser errors and zero unexpected external requests.
- Latest full verification (2026-11-13 23:34 UTC): `npm test` passed 557/557 (85.8s); `TRAVEL_NEXT_DIST_DIR=.next-current-booking-fees-followup-build npm run build` passed on Next.js 16.4.3; `npm audit --audit-level=low` found zero vulnerabilities. The isolated production server on loopback port 3001 passed `TRAVEL_CHECK_URL=http://127.0.0.1:3001 npm run check:flight-hotel-demand`, then was stopped. The existing app on port 3000 returned root HTTP 200 and same-origin POST health `ok` at 2026-11-13T23:34:39.500Z (queue depth 0, one live worker, zero expired leases/deadlines; nine stale worker records were also reported).

This does not establish live Booking.com Demand inventory, a refreshed quote, order preview, final payable total, seller availability, or member eligibility. Booking.com partner credentials remain unconfigured. The browser result is a fixture, not a production fare or hotel price. P4 and §17 remain Partial.
