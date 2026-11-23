# Air Canada Vacations adult multi-room allocation disclosure — 2026-11-13

## Behavior

The package widget accepts adult-only multi-room searches. The application validates that the provider listing URL retained the requested aggregate adult count, room count, dates, destination, currency evidence, and any supported child/infant fields. The widget does not expose which adults are assigned to each room.

Normalized offers now carry `occupancyEvidence`. For a multi-room request, `perRoomAllocation` is `not_exposed_by_widget`; for one room it is `single_room_request`. The result UI surfaces this distinction and asks the traveler to confirm room assignments with Air Canada Vacations. The aggregate package price is not described as verified for a particular room allocation. Child/infant searches remain constrained to the provider-observed one-room flow; the implementation does not split or combine separate package searches.

## Reproducible checks

- `node --test tests/vacation-normalize.test.mjs tests/vacation-form.test.mjs tests/vacation-search.test.mjs` — 23/23 passed, including exact aggregate occupancy matching and rejection of mismatched adult/room URL parameters.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:package-infant-guidance` — passed against the current loopback production site. Controlled fixture UI displayed the adult-only 2-adult/2-room allocation caveat as a visible `role=status`, kept the unsupported two-room child request from reaching the job API, and retained the browser-only DOB behavior. Provider calls: 0; controlled job calls: 6.
- Fresh current-tree verification: `npm test` passed 556/556; `TRAVEL_NEXT_DIST_DIR=.next-current-acv-allocation-build npm run build` passed on Next.js 16.4.3; `npm audit --audit-level=low` reported zero vulnerabilities.
- Loopback root returned HTTP 200. A same-origin health POST at `2026-11-13T23:16:47.834Z` returned `ok`, queue depth 0, one live worker, zero expired leases and deadlines, nine stale historical worker records, and eight stopped records. This describes only that observation time.

These are implementation and controlled-browser checks, not a new live ACV package search. No current per-room assignment, room equivalence, live availability, child fare acceptance, complete fee total, seller quote, or checkout price was verified. P6 and the `work.md` vacation-package acceptance criterion remain Partial.
