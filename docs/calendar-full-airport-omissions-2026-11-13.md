# Fare calendar airport-omission coverage — 2026-11-13 22:27 UTC

## Change

Completed regional calendar results now retain every airport code returned by the location resolver that was not selected. The list includes candidates omitted by the per-location candidate limit and candidates removed later to fit the provider/date request budget. Budget-removed candidates are put back in the resolver's original order. Existing `airportPairsUncheckedByBudget` and `airportPairsNotSearched` continue to identify the exact selected-route pairs omitted by budget or interruption.

Progress updates remain bounded: they include at most the first 20 omitted airport codes and set `uncheckedAirportsSampled` when the list is longer. The count remains the total known omitted airport count. The calendar UI labels a progress list as a sample, shows the full list after completion, and states when a directory/resolver limit may hide additional airport identities. Geographic-boundary airport code lists are labeled as sampled when their count exceeds the returned list.

## Verification

- New regression uses 35 resolved destination candidates, a 4-airport location limit, and a 1-query search budget. It verifies all 34 omitted codes in original order, the three exact route pairs removed by budget, total counts, and a maximum 20-code progress sample.
- `node --test tests/calendar-search.test.mjs`: **44/44 passed**.
- Full `npm test`: **554/554 passed**.
- `TRAVEL_NEXT_DIST_DIR=.next-calendar-coverage-build npm run build`: passed.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- Production Chromium `TRAVEL_CHECK_URL=http://127.0.0.1:3001 npm run check:calendar-streaming`: passed; provider/job traffic was intercepted, all 34 completed omission codes rendered, the running preview was labeled as a sample, page errors were zero.
- The regular production calendar-range UI submission check also passed with provider traffic intercepted. A second optional regional invocation of that existing checker returned `jobCalls: 0`; a separate controlled browser trace on the same build submitted `/api/search/jobs` successfully for a regional query. This checker discrepancy is not used as evidence for full omission rendering; the dedicated streaming browser check and calendar unit regression provide that evidence.

## Limits

This lists all airport identities the resolver actually returned, not airports absent from its directories or hidden by upstream country/row caps. Provider/date coverage remains bounded by selected airports and the request budget. A resolver may report additional candidates without returning their identities; the UI discloses that condition. Calendar minima are not exhaustive worldwide fares or seller-confirmed prices.
