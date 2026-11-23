# Skyscanner timezone and journey-duration integrity — 2026-11-13 20:58–21:02 UTC

## Change

Ordinary Skyscanner search and itinerary refresh now require airport timezone evidence on the server. The adapter loads the airport-timezone directory before calling Skyscanner and fails closed if either requested endpoint is missing or ambiguous. Every returned segment is converted from its airport-local wall time to UTC by the shared timezone validator, which also checks connection and round-trip chronology. The adapter rejects a leg unless the provider's reported duration equals elapsed UTC minutes from its first departure to its final arrival, including layovers.

The API refresh route no longer forwards a client `requireTimeEvidence` setting. The adapter requires evidence regardless of caller flags, and the shared provider router explicitly enables the requirement. Local string comparisons across different airport time zones were removed; UTC evidence is authoritative, including for date-line arrivals that occur on an earlier local calendar date.

Search and refresh results report raw normalized offers as `received`, validated output as `accepted`, and offers rejected by timezone/duration/shared validation as `rejected`. Malformed source rows discarded while normalizing are not included in these counts.

## Verification

- Red/green regression: tests first reproduced missing timezone evidence and a provider-duration mismatch being accepted; after the change both fail closed.
- Focused adapter/calendar/provider/refresh suite — 79/79 passed.
- `npm test` — 552/552 passed (127.2 seconds).
- `TRAVEL_NEXT_DIST_DIR=.next-skyscanner-timezone-build npm run build` — passed on Next.js 16.4.3.
- `npm audit --audit-level=low` — zero vulnerabilities.
- Fresh isolated production server on loopback port 3001 returned HTTP 200. `check:flight-default` and `check:calendar-source` passed against it in Chromium. Provider/job boundaries were intercepted; no live supplier request was made. Both checks reported zero browser errors; flight-default also reported zero application CSP violations.
- Existing port 3000 was left untouched. A generic POST health probe returned 403 (`Operational status is limited to the local app`); this is not recorded as a health success or failure.

Fixtures verify adapter behavior only. No Skyscanner credential was used, no live fare or refresh was requested, and this does not verify supplier inventory, seller acceptance, current checkout price, baggage, fees, or broad market coverage. The broader `work.md` §17 remains incomplete.
