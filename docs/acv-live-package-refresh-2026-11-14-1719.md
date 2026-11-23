# Air Canada Vacations live package refresh — 2026-11-14 17:16–17:19 UTC

## Website query

Ran `scripts/check-package-location-ui.mjs` through the local website and durable worker. A disposable SQLite database was used; the temporary app/worker stack was stopped after the check and its database, WAL and SHM files were removed.

- Provider location lookups returned YHZ at `17:16:47.479Z` and Barcelona city/airport choices at `17:17:14.223Z`.
- The website selected Halifax Stanfield (YHZ), Barcelona, Spain (CITY), and the provider-suggested Barcelona airport (BCN).
- Query: 2027-04-15 to 2027-04-25, one adult, one child at the supplied actual departure age 7, one room, minimum 4 stars, maximum 2 stops per direction, 20-result limit.
- The submitted website payload preserved the exact child age, locations, dates, room count, stop cap and result limit.
- The provider search completed at `2026-11-14T17:19:38.270Z`: 19 supported estimated observations from 20 inspected panels, no extra page opened, and additional listings remained beyond the searched page budget. No card was excluded by star, budget or stop filters.
- Displayed estimates ranged from CAD 3,235.95 to CAD 5,890.72. The lowest displayed property was Exe Barbera Parc. Cards described 4-star, room-only, non-refundable rates and stated “Taxes & fees incl.” Flight summaries showed one stop in each direction.

## Limits

These are current provider-listed estimates for the requested party, not checkout-confirmed package prices. The provider page warns that local charges may apply. The result cards identify the hotel city but do not verify exact street address, room equivalence, full mandatory-charge treatment, child fare acceptance at checkout, or final availability. Only 20 panels were inspected and further listings remained unsearched. No account, CAPTCHA, checkout, reservation or purchase was involved. The evidence demonstrates the website-to-worker flow for one query; it does not establish broad package coverage or persistent availability.

## Reproduction

```sh
TRAVEL_CHECK_URL=http://127.0.0.1:3000 \
TRAVEL_PACKAGE_DATE=2027-04-15 \
TRAVEL_PACKAGE_RETURN=2027-04-25 \
TRAVEL_PACKAGE_CHILD_AGE=7 \
TRAVEL_PACKAGE_MAX_STOPS=2 \
TRAVEL_PACKAGE_MAX_RESULTS=20 \
node scripts/check-package-location-ui.mjs
```

The run completed successfully on the live website. The disposable development stack was stopped afterward; ports 3000 and 3001 were clear. No source code changed for this check.
