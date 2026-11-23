# Flight + Hotel party reset on flight change — 2026-11-13

## Finding

The hotel form kept its `rooms` and per-room age allocations in component state when a different flight was selected. A second effect also reloaded those values from the previously completed hotel job while a new flight was selected. This allowed the next hotel request to inherit room occupancy from an earlier flight's search. The previous hotel result could also be combined visually with a newly selected flight.

## Change

- Key hotel-form state to the selected itinerary/query identity. A flight change resets the room count to one and clears all room assignments.
- Only hydrate saved room allocations when hotel search is used standalone, not while a flight is selected.
- Hide a prior hotel result while it belongs to a different selected flight and show a message that a fresh stay search is needed.
- Added `npm run check:hotel-flight-switch`, a Chromium regression that intercepts all provider and job traffic. It submits a two-room/two-adult hotel query on YYZ–FRA, selects YYZ–BCN, and confirms the new form has one room/no allocations and the old result is identified as stale.

## Verification

- Browser regression: passed; old submitted request retained exact room ages `[39]` and `[37]`; after flight switch, one room and zero allocation fieldsets; stale-result notice visible; zero page errors. All provider/job traffic was intercepted.
- `npm test`: 546/546 passed.
- `TRAVEL_NEXT_DIST_DIR=.next-flight-reset-build npm run build`: passed.
- `npm audit`: 0 vulnerabilities.
- Local website: HTTP 200. Same-origin `/api/health`: `ok`, queue depth 0, one available live worker, zero expired leases/deadlines.

## Limits and next action

This browser check proves client-side state isolation for the tested flight-switch flow; it does not establish live hotel prices, partner API access, availability, room inventory or comparable total costs. P4 and `work.md` §17 remain partial. Continue with live-source and exact-occupancy requirements where authorized access exists; keep unavailable credentials and seller verification explicitly open.

## Running hotel job follow-up — 2026-11-13

The flight-switch browser scenario now also starts a deliberately unfinished hotel search for a selected flight, switches to a third flight, and verifies the UI says the job is still searching for the previous flight and leaves its Cancel search control available. This avoids implying that an in-progress old job belongs to the newly selected itinerary. The check intercepted provider/job requests and reported zero page errors. Full `npm test` passed 547/547; isolated `TRAVEL_NEXT_DIST_DIR=.next-hotel-flight-running-build npm run build` passed; `npm audit` found zero vulnerabilities. The build output was moved to `/tmp`. Local root and same-origin health both returned HTTP 200; health status was `ok`, queue depth 0, and expired leases/deadlines 0. No live hotel search was made. This is additional UI disclosure/state evidence only; it does not make the old job transferable to the new flight or establish P4 live inventory/fees/seller acceptance.


## Hotel provider failure and room coverage states — 2026-11-13 04:45 UTC

Hotel provider errors had been labeled `unavailable`, which could be read as an inventory finding. Updated result reporting to preserve known provider statuses (`rate_limited`, `temporarily_unavailable`, and others), use `error` for untyped failures, and mark every planned room after an early stop as `not_searched`. Coverage now separates failed and not-attempted room searches. Official-site and combined-source catches retain provider status too; the existing hotel UI displays these source statuses directly.

Verification: focused hotel/search/comparator tests 27/27; full `npm test` 550/550; isolated production build passed; `npm audit --audit-level=low` reported zero vulnerabilities. No external hotel query was made. This closes an error-reporting gap only; it does not prove hotel inventory, simultaneous room availability, comparable room types, complete taxes/fees or seller checkout totals.


## Selected-flight party matching — 2026-11-13 04:57 UTC

The Flight + Hotel form now refuses to start when its submitted guest count differs from the selected flight party. For identified DOB travelers, it additionally requires exact adult/child categories and ages at hotel check-in, including adult ages assigned across rooms. For count-only flight queries, it validates the total party count and uses the exact check-in ages entered by the user; it does not infer birthdays. The controlled browser regression tried three adults against a two-adult selected flight, observed the validation message, and confirmed no hotel job request was sent. It then submitted a valid two-room party.

`TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:hotel-flight-switch` passed with the mismatch blocked, flight-change room reset and stale-running-job disclosure verified. `... npm run check:hotel-occupancy` passed with two room assignments (adults 35 and 39; child age 7), displayed room observations CAD 120.00 and CAD 180.00 (combined CAD 300.00), and simultaneous availability still marked unverified. Both checks intercepted provider/job requests and had zero page errors. Full `npm test` passed 550/550; isolated build and zero-vulnerability audit passed. These are fixture/UI and validation results only, not live inventory, room-equivalence, fee or seller evidence.

## Check-in age reset and exact identified occupancy — 2026-11-13 05:16 UTC

The production browser test now exercises both count-only and DOB-identified selected flights. A three-guest count mismatch is blocked for a two-adult flight. For an identified party of adults aged 39 and 37 plus a child aged 7 at hotel check-in, assigning the child as age 8 is blocked before a hotel request; changing it to age 7 starts the search with exact room allocations. The browser confirms the hotel job receives room ages but no traveler DOB. When the selected flight changes from that child party to an adult-only count party, the prior hotel's `7` is cleared instead of being restored from the old job. Flight-switch reset and prior-running-job disclosure remain covered.

Final current-tree verification: `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:hotel-flight-switch` and `... npm run check:hotel-occupancy` passed with provider/job traffic intercepted and zero browser errors; `npm test` 550/550; isolated production build passed; `npm audit --audit-level=low` found zero vulnerabilities. All displayed prices came from fixtures. No live provider request or seller check was made.
