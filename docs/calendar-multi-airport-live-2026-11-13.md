# YYZ–Europe multi-airport live calendar check — 2026-11-13

## Query and result

- One-way YYZ→Europe, Dec 15 2026, one adult, economy, CAD, source `all`, four candidate destination airports and a 16 provider/date-search budget.
- The resolver selected FRA, FCO, BCN and MUC. It disclosed 839 known omitted candidate airports beyond the displayed limit, the configured top-three traffic-ranked exclusions LHR/CDG/MAD, and 261 airports outside the continental-Europe coordinate boundary.
- All four selected airport pairs were queried. A CAD 516.62 ITA Matrix price observation for YYZ–FRA was recorded at `2026-11-13T00:37:17.550Z`. No complete route/date scan was claimed.
- All 16 budgeted provider/date searches were used. Ignav, Google Flights and ITA Matrix returned responses for all four pairs. Expedia via Omkar failed with HTTP 500 for all four. Expedia Travel Redirect, Skyscanner and Air Canada NDC were not configured. Therefore `fullyScanned:false` and `datesChecked:0`, although all four airport pairs had requests.

## Polling contention and recovery

One live status poll returned HTTP 400 `database is locked` while the worker was writing progress. The durable job subsequently completed. The result was recovered read-only from the local job database; the original owner token was not retained in the one-off monitor, so no further owner-bound poll was attempted. Health briefly reported no live worker during the final write and returned `ok` with one live worker at `2026-11-13T00:40:51Z`.

Inspection found the status path forced a global 24-hour retention delete on every poll, in addition to unconditional expiry-update statements. `job-store.get()` now runs retention cleanup on the existing 60-second throttle, immediately removes the requested job if that exact terminal row has expired, and only updates it when a lease or deadline has actually elapsed. `findFlightOffer()` now uses the retention cutoff in its query and does not force a global sweep.

The new regression failed before the fix and passed after: polling a recent job leaves an unrelated expired row for the throttled cleanup, while directly requesting that expired job still removes it. `node --test tests/job-store.test.mjs` passed 18/18 after the change. Verification after both fixes: `node --test tests/job-store.test.mjs` passed 18/18; focused job/error tests passed 29/29; full `npm test` passed 541/541; isolated production build passed; `npm audit --audit-level=low` found zero vulnerabilities after Hono was updated to 4.13.18.

## Limits

This was one bounded date and four selected airport pairs, not exhaustive Europe coverage. ITA Matrix supplied a price-only observation, not full flight details or seller availability. No baggage, mandatory charges or checkout total were established. The Omkar failures made all-source coverage incomplete. No seller URL, reservation or purchase occurred.


## Final local verification

After the polling and error-response changes, `npm test` passed 541/541, the isolated production build completed successfully, and `npm audit --audit-level=low` found zero vulnerabilities. At `2026-11-13T00:53:34Z`, the local page returned HTTP 200; same-origin health was `ok` with one live worker, an empty queue, and no expired leases or deadlines. The app remains local-only.
