# Calendar worker result validation — 2026-11-14

## Change

Calendar jobs now validate their final result in the child worker immediately before it is sent for durable storage. The guard checks that:

- the result has an offset-aware observation timestamp, a valid exact route-pair list, and the complete departure/return date grid from its query;
- planned/checked/failed/unsupported/not-scanned counters reconcile with the bounded route/date plan and request budget;
- every non-null price is positive CAD and matches a fresh, validated offer on the same route and dates; and
- each returned offer passes the shared flight provenance, freshness, cabin, segment, and chronology checks.

An invalid calendar result becomes a sanitized worker error instead of a completed priced result.

## Verification

- `node --test tests/calendar-worker-result.test.mjs tests/calendar-worker.test.mjs`: **11/11 passed**, including the valid-result path through actual durable child workers and malformed amount, route, date-grid, and coverage cases.
- `npm test`: **566/566 passed**.
- `TRAVEL_NEXT_DIST_DIR=.next-calendar-worker-schema-build npm run build`: passed on Next.js 16.4.3.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- Rebuilt production Chromium `check:calendar-streaming` displayed fixture observations CAD 500 and CAD 510 during execution and CAD 400 at completion; two status polls, provider calls intercepted, zero browser errors.
- Rebuilt production Chromium `check:calendar-ranges` passed with region-selected locations; provider/job calls were intercepted.
- No live fare request was made for these checks. The existing loopback application remains on port 3000; the isolated port-3001 server was stopped after verification.

## Still open

This hardens the calendar result boundary only. Central strict result schemas for flight, comparison, hotel, and vacation-package workers remain unimplemented, and source-specific timezone/chronology evidence still needs a complete cross-provider audit. Calendar regional airport omissions, live provider availability, seller availability, baggage, fees, and checkout totals also remain outside this check. The broad P0/P11 acceptance remains Partial.
