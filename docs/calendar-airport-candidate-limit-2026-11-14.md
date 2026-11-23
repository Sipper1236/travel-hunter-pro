# Calendar airport-candidate limit validation — 2026-11-14

## Change

The calendar API previously accepted pre-resolved airport lists longer than `airportLimit`. The browser normally trims selected lists to the limit, but direct validated requests could exceed it while the stored query still reported a smaller limit. `validateCalendarQuery` now rejects the query if either origin or destination candidate list exceeds the selected per-location limit. It returns a clear validation error before dispatching provider work.

## Reproduction and verification

- Added the regression at the public `validateCalendarQuery` boundary. Before the fix, `airportLimit: 1` with two origin candidates did not throw. Afterward, both origin overflow and destination overflow reject; two candidates with a limit of two remain supported.
- Focused calendar query/endpoint tests passed **46/46**, including the 20-by-20 case where the selected limit is 20 and the provider request budget independently trims exact pairs. The endpoint regression checks both origin and destination overflow.
- Direct calendar-route check with two origin candidates and `airportLimit: 1` returned HTTP 400 and created no job.
- `npm test`: **562/562 passed**.
- `TRAVEL_NEXT_DIST_DIR=.next-calendar-airport-limit-build npm run build`: passed on Next.js 16.4.3.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3001 npm run check:calendar-ranges` and the same check with `TRAVEL_CHECK_REGIONS=1`: both passed against the isolated production build; capability/job calls were intercepted, so no provider search ran. The first run exposed a Playwright timing race in the check itself; it now waits for the intercepted start response before reading the route counter.
- Existing site health at `http://127.0.0.1:3000` was `ok` at `2026-11-14T01:27:51.303Z`, queue depth 0, one live worker, zero expired leases/deadlines. The temporary port-3001 server was stopped after the check.

## Scope limit

This aligns the API's candidate-list validation with the UI's configured limit. It does not improve airport-directory completeness, search more airport pairs, verify fares, or change the existing provider/date request budget. Geographic and live calendar acceptance remains Partial.
