# Booking.com Demand API multi-room Flight + Hotel subtotal — 2026-11-08

## Change

`lib/booking.mjs` preserves auditable occupancy and total-price evidence from a single Booking.com Demand API result: requested room allocations, provider-returned adult counts and exact child ages per product, per-product totals in CAD cents, the property expected total, and whether that total includes observed non-conditional charges.

`lib/flight-hotel.mjs` accepts a multi-room Booking.com Demand API amount only when provider products match every requested room allocation, child age, and exact product/expected-total sum. Flight and hotel currency, exact destination/property, stay dates, traveler ages, freshness, and cent-precise totals must also match. The comparison labels this as rooms and an expected total **observed together in one response**. It deliberately leaves `simultaneousRoomsVerified` false: an API observation is not a seller recheck or booking confirmation.

A product sum that differs from the property expected total by one cent may be retained as an individual source observation, but its evidence is marked non-exact and it cannot contribute to a Flight + Hotel subtotal.

The Flight + Hotel result text distinguishes this response from separately queried room quotes. It describes the hotel amount as the provider's expected total with observed non-conditional charges and warns that conditional charges can apply. It also says that flight and hotel are separate purchases and current availability is unverified.

## Verification

- `node --test tests/booking.test.mjs tests/flight-hotel.test.mjs tests/hotel-search.test.mjs` — passed 36/36.
- `npm run build` — passed.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:flight-hotel-demand` — passed against a rebuilt loopback production page. The rendered fixture scenario used two rooms (adult ages 37 and 39, child age 7 in room one), showed CAD 1,530 flight-plus-hotel observed subtotal and CAD 510 average per traveler, stated that products were observed together, and kept current availability unverified. All provider traffic was intercepted; zero browser errors.
- `npm test` — passed 512/512 in 79.96 seconds after the one-cent evidence regression.
- `npm audit --audit-level=low` — found zero vulnerabilities.
- `npm run check:local-stack` — passed isolated graceful shutdown, HTTP 200, worker available, queue depth zero, and zero provider searches.

## Live-evidence limit and next action

The local environment has no configured `BOOKING_API_TOKEN` or `BOOKING_AFFILIATE_ID`, so the partner adapter fails closed and no live Demand API hotel observation was collected. The rendered subtotal check uses a test-only intercepted fixture. Obtain authorized partner credentials, then make a bounded, read-only live search for the exact flight destination, dates, party ages, and room allocations. Recheck the selected products and expected total with Booking.com before calling it seller-verified. No account was created, room reserved, or purchase made.

This closes a code-path gap for multi-room child subtotals, not P4 as a whole. Live availability, seller acceptance, room equivalence, conditional charges, complete checkout totals, and comparable property pricing remain open. See [work.md §17](../work.md), [HANDOFF.md](../HANDOFF.md), and [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md).
