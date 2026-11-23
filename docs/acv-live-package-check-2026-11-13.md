# Air Canada Vacations live package check — 2026-11-13 21:12–21:15 UTC

## Query path

Ran `scripts/check-package-location-ui.mjs` against the already-running loopback website at `http://127.0.0.1:3000`; the existing worker completed the real Air Canada Vacations widget search. No application or worker restart was needed.

- Origin: provider suggestion `Halifax Stanfield Intl. Airport (YHZ)` (`AIRPORTGROUP`)
- Destination: exact provider city suggestion `Barcelona, Spain` (`CITY`), paired with provider-suggested flight arrival airport `Barcelona Airport (BCN)` (`AIRPORTGROUP`)
- Dates: 2027-04-15 through 2027-04-25
- Party: one adult and one child, age 7 on departure, one room
- Filters/budget: minimum four stars; maximum two stops per direction; 20-result page cap; no group price cap
- Provider suggestion responses: one YHZ option and 12 destination choices, observed at `2026-11-13T21:12:53.850Z` and `2026-11-13T21:13:09.471Z`

The website submitted the exact selected labels, BCN arrival airport, child age, dates and filters to the package job. The provider flow completed and the site rendered **20 supported observations from 20 inspected flight panels**, with zero excluded by the selected hotel class/budget and zero excluded by the stop filter. The page stated more listings remained beyond the selected cap. The displayed flight summaries showed economy and one stop each direction.

Examples of the observed estimated group totals included Exe Barbera Parc at CAD 3,235.54, Exe Campus at CAD 3,274.84, and H10 Art Gallery at CAD 5,890.92. The observations were timestamped `2026-11-13T21:14:01.128Z`. These are not refreshed checkout totals or a recommendation.

## Limits

The ACV result cards describe the package amounts as estimated and taxes/fees included, but the application still warns local charges may apply. The public flow's child-party/one-room limit remains; this query does not solve multi-room child packages. The result does not prove exact child-fare acceptance, current inventory at checkout, exact hotel address, room equivalence, every mandatory/local charge, refundable alternatives, the 40-card expanded page, or seller checkout price. No account was created, no challenge was bypassed, and no checkout, booking, reservation, or purchase was attempted.

After the search, a same-origin local `POST /api/health` returned HTTP 200 with status `ok`, queue depth 0, one live worker, zero expired leases/deadlines, and nine stale historical workers. This is local operational status only.

This refresh demonstrates one current real website → owner-bound job → worker → ACV widget → rendered-result flow with exact provider-selected locations and a child party. It advances P6 but does not complete `work.md` §17. The previous one-room live check from 2026-11-12 remains in [the prior note](acv-live-package-check-2026-11-12.md).

Regression verification after the live check: `node --test tests/vacation-form.test.mjs tests/vacation-search.test.mjs tests/vacation-normalize.test.mjs tests/vacation-suggestions.test.mjs` passed **28/28**. These tests verify query validation, source marker handling, occupancy/filter preservation, parsing, and bounded UI behavior; they do not prove current seller availability or checkout totals.
