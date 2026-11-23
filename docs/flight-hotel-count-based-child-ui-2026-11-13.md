# Flight + Hotel count-based child flow — 2026-11-13 21:53 UTC

## Change

The flight result UI now exposes **+ Hotel** for a count-based round-trip party when all declared children have valid, explicitly entered departure ages (2–17). Adult count and total party inputs are also checked before showing the action. This makes the existing hotel form usable for families that do not provide dates of birth; the hotel form still requires actual ages at check-in and does not invent birthdays. The existing comparator validates hotel party size, submitted check-in ages, room assignments, destination/property identity, stay dates, CAD amounts and freshness before producing a subtotal. DOB-identified parties continue to require exact ages derived for the hotel check-in date.

The controlled fixture now contains segment-level flight identifiers, matching local timestamps, UTC instants, and contiguous route evidence, so the flight result represents the app's current complete-offer shape.

## Verification

- `node --test tests/flight-hotel.test.mjs tests/official-hotels.test.mjs tests/booking.test.mjs tests/booking-browser.test.mjs` — 30/30 passed.
- `TRAVEL_NEXT_DIST_DIR=.next-flight-hotel-count-children-build npm run build` — passed.
- `npm audit --audit-level=low` — zero vulnerabilities.
- `npm run check:flight-hotel-demand` against the rebuilt loopback production app — passed. The browser intercepted every provider/job response and asserted the count-based child party (one adult plus age 7, with no traveler DOB object) could search two explicit hotel rooms and display the fixture-only CAD 1,530 subtotal / CAD 510 per traveler. Room products and expected total were observed together in the controlled response; simultaneous availability remains unverified. Browser errors: 0; unexpected external requests: 0.

This is fixture-backed UI/comparison evidence, not live hotel availability, seller acceptance, room equivalence, a complete fee total, or checkout pricing. Booking.com Demand partner credentials are not configured. No live hotel search, account creation, checkout, reservation, or purchase occurred. The first full-suite attempt ran alongside the production build and timed out one unrelated `tests/flight-default-worker.test.mjs` case at its 10-second deadline (552/553). That test passed alone in 3.7 seconds. A second full `npm test` run with no build contention passed 553/553 in 122.9 seconds. The cleaned controlled UI check was rerun after removing temporary diagnostics and passed again.

At 22:04 UTC, the controlled UI check passed again after its fixture's declared journey duration was corrected to agree with its UTC segment chronology. It again reported the CAD 1,530 fixture subtotal, zero provider calls, zero unexpected external requests, and zero browser errors.
