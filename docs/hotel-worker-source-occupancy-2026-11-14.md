# Hotel worker source and occupancy validation — 2026-11-14

## Change

The durable hotel worker now rejects returned offers that do not match the requested source. Booking.com browser and Demand API observations must carry their distinct provider/source identity; Reservit offers require the verified official-source marker. Booking-source offers must also preserve the requested guest evidence. Demand API product totals must map exactly to requested room allocations and the CAD total. Multi-room sums require fresh per-room quotes, a property key on every quote matching the verified property, ordered room assignments and exact requested adult/child ages. Booking browser quotes also require matching provider-count evidence. Official Reservit room quotes carry their property key and exact supplied age allocations; they do not need Booking.com-specific occupancy evidence.

The empty-result path still permits source-unavailable results only after the worker result's root query is confirmed to preserve the submitted stay constraints. No provider request or synthetic production fare was introduced.

## Reproducible verification

- `node --test tests/hotel-worker-result.test.mjs tests/official-hotels.test.mjs tests/official-hotel-worker.test.mjs tests/hotel-search.test.mjs tests/booking.test.mjs`: passed 49/49.
- `npm test`: passed 594/594, 160.6 seconds.
- `TRAVEL_NEXT_DIST_DIR=.next-hotel-worker-source-occupancy-final npm run build`: passed.
- `npm audit --audit-level=low`: zero vulnerabilities.
- On the temporary loopback server at port 3001, `check:hotel-occupancy` passed with all provider requests intercepted, exact age/room assignments rendered, simultaneous availability labeled unverified, and zero browser errors. `check:hotel-room-handoff` passed with occupancy, age re-entry, and current-rate verification disclosures visible. Temporary server stopped; port 3000 was not changed.

## Remaining P4 limits

These are local fixture and worker-validation results, not live Booking.com or Reservit inventory. Exact child-price eligibility, simultaneous multi-room availability, equivalent room categories, checkout totals, fees, and seller confirmation remain unverified. P4 and work.md §17 remain Partial.

## Priced-offer provider-status integrity — 2026-11-14 16:12 UTC

The durable hotel worker now also requires every priced offer to have a matching provider row with `status: observed`. A Booking.com browser offer cannot be justified by a Demand API or Reservit status row, and a Demand API offer cannot be justified by a browser row. Error, rate-limited, and other non-observed states cannot authorize a displayed price. Regression tests cover omitted, misattributed, rate-limited, and failed source rows. Current source producers were checked: Booking.com browser single/multi-room and Demand API results provide distinct provider rows; Reservit reports observed status for priced offers.

Verification on the current tree: focused hotel/search/official tests passed 50/50; full `npm test` passed 595/595 (125.9s); `TRAVEL_NEXT_DIST_DIR=.next-p4-source-status npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities. Fresh-build `check:hotel-occupancy` and `check:hotel-room-handoff` passed on temporary loopback port 3001 with provider requests intercepted and zero browser errors. The server was stopped afterward. No live hotel query was made. P4 and work.md §17 remain Partial.

## Accepted-source coverage guard — 2026-11-14 16:18 UTC

Matching source identity and an `observed` status alone were not enough: a zero-accepted row, or one accepted room out of a multi-room query, could still appear alongside a price. The validator now requires positive accepted evidence from the actual source. Single-room Booking browser rows need a positive accepted count; separately searched multi-room browser offers need positive same-property acceptance for every room number; Booking Demand API rows need `accepted > 0`; direct official/Reservit rows need positive offer observations. Regressions cover zero accepted offers, a provider mismatch, non-observed statuses, and incomplete/zero-count room coverage.

Verification: focused hotel/search/official tests passed 50/50; full `npm test` passed 595/595 (186.7s while the isolated build ran concurrently); `TRAVEL_NEXT_DIST_DIR=.next-p4-accepted-evidence npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities. Fresh-build `check:hotel-occupancy` and `check:hotel-room-handoff` passed on temporary loopback port 3001 with provider requests intercepted and zero browser errors. After these checks, only a rejection-message wording change and its focused test matcher were adjusted; `node --test tests/hotel-worker-result.test.mjs` passed afterward. No live hotel source was queried. P4 and §17 remain Partial.

## Source-count consistency — 2026-11-14 16:24 UTC

The accepted counts must also be plausible relative to the observations that produced them. Booking browser single-room acceptance cannot exceed observed listings; a combined browser price needs every room's positive same-property count, and that count cannot exceed the room's observed offers; Demand API acceptance cannot exceed its returned property count. Regressions reject a Demand API row claiming two accepted properties from one returned property, along with zero and partial multi-room accepted coverage.

Focused hotel/search/official tests passed 50/50; full `npm test` passed 595/595 (186.5s, concurrently with build); `TRAVEL_NEXT_DIST_DIR=.next-p4-count-bounds npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities. Fresh-build `check:hotel-occupancy` and `check:hotel-room-handoff` passed on temporary port 3001 with provider requests intercepted and zero browser errors; the server was stopped. No live query occurred. P4 and §17 remain Partial.

## Single-room source coverage follow-up

The single-room Booking.com browser path now returns `sourceResults` and a `visible_first_page` coverage object, including observed, accepted, and rejected counts. An empty card set is labeled `no_matching_observation` with wording that does not claim no inventory. The hotel worker refuses empty results that lack valid provider status rows or bounded official discovery coverage. That coverage is schema-checked: OpenStreetMap's candidate limit, 10 km radius, continuation flag and attribution must be present and valid; direct property URLs are bounded to one candidate. The hotel UI now displays source-level observations and same-property accepted counts. A production Chromium fixture first checked both separately searched room rows, then reloaded the page and checked a separate single-room child result with 2 observed, 1 accepted and 1 rejected card. Unique fixture job IDs exercise the actual poll lifecycle across both searches.

Focused hotel worker/search/official-source tests passed 38/38; full `npm test` passed 594/594; `TRAVEL_NEXT_DIST_DIR=.next-p4-empty-coverage npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities; and rebuilt loopback `check:hotel-occupancy` and `check:hotel-room-handoff` passed with provider requests intercepted and zero browser errors. The final occupancy check reported `singleRoom:{firstPageOnly:true,observed:2,accepted:1,rejected:1}` and validated the two-room result too. A previous build attempt hit Btrfs metadata `ENOSPC`; I removed stale isolated Next builds and generated `.next/cache` and `.next/dev`, then the isolated build passed. The existing `.next` server output and source tree were preserved, port 3000 was not serving a process, and temporary port 3001 was stopped. No live source query ran. First-page-only inventory remains incomplete and P4/§17 remain Partial.
