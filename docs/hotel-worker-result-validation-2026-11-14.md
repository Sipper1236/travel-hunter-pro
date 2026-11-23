# Hotel worker result validation — 2026-11-14

## Change

Hotel child-worker results are now checked before they are sent to the durable worker for persistence. The validator revalidates the submitted stay query and rejects offers whose dates, night count, room/adult counts, explicitly supplied adult ages, child ages, or room assignments differ. Priced offers must carry an explicit positive CAD total, current observation timestamps, minimum-star evidence, and verified destination/property evidence tied to the returned canonical city. Booking.com product totals must reconcile to the displayed total and the requested room allocations. Separately searched rooms must each carry a fresh CAD quote for the correct assigned ages, and their sum must match the displayed total. Empty results remain valid so source outages or no-match outcomes are not turned into fabricated inventory.

This boundary does not establish seller availability, simultaneous room inventory, room-category equivalence, final checkout totals, cancellation terms, or mandatory fee treatment. Those remain source-dependent and require seller rechecks. Vacation-package worker results are still not covered by this validator.

## Verification

- Red/green unit tests cover acceptance of a valid current Booking.com Demand observation, date/child-age mismatch, unverified property, stale price, product-total mismatch, and valid empty results.
- `tests/hotel-worker-result.test.mjs` plus the actual official durable worker test: 8/8 passed after integration.
- Full `npm test`: 584/584 passed (85.2 seconds).
- `TRAVEL_NEXT_DIST_DIR=.next-hotel-worker-result npm run build`: passed on Next.js 16.4.3.
- `npm audit --audit-level=low`: zero vulnerabilities.
- Fresh-build Chromium `check:hotel-occupancy` and `check:hotel-room-handoff` passed on loopback port 3001. Job/provider requests were intercepted; zero browser errors. The multi-room UI displayed fixture totals CAD 300 (CAD 120 + CAD 180) while disclosing simultaneous availability was unverified. The temporary server was stopped; the user's existing port-3000 service was not changed.
- The official Reservit durable-worker fixture passed through the new result guard. No live hotel supplier query was made.

## Remaining hotel work

P4 is still Partial. Multi-room browser quotes may not echo individual ages, separate searches do not prove simultaneous inventory, and official-site quotes can have unitemized tax/fee treatment or no room/rate category. Flight + Hotel child/multi-room eligibility, exact destination/property matching across additional real sources, all-in comparable totals, current seller availability, and ACV multi-room child support need further source-specific work and live evidence. No synthetic fare/offer was used in production.
