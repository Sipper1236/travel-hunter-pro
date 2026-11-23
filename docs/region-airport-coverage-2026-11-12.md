# Named-region airport resolver check — 2026-11-12

## Scope and method

Ran the production `resolveRegion()` path sequentially for all 28 geographic labels named in `work.md`. No flight fare/calendar providers were called. The resolver used its normal two-directory merge and returned successfully for all 28 labels. The region cache reported a fresh OurAirports snapshot saved at `2026-11-12T22:39:46.579Z` and fresh (within the configured seven-day TTL) Wikidata snapshots saved between `2026-11-09T01:40:29.020Z` and `2026-11-09T02:40:11.471Z`. The live UN M49 page also returned HTTP 200; its parser found 248 areas, and all 28 policies selected at least one area with an ISO-alpha2 code.

The counts below are resolver outputs. `Resolved` is capped at 100 displayed airport candidates per region; `known omitted` is the resolver's current `uncheckedAirports` count beyond that displayed cap. These are directory candidates, not proof every location has current scheduled service or fare-provider inventory. Airport-pair search is separately capped by the user setting (4–20 airports per side, default 10). No airfare source, all-provider calendar, or checkout was tested in this check.

| Region | M49 areas | Resolved | Known omitted | More available | Special exclusions |
|---|---:|---:|---:|:---:|---|
| North America | 41 | 100 | 2,600 | yes | — |
| United States | 1 | 100 | 1,757 | yes | US area only; separately coded territories excluded by policy |
| Canada | 1 | 100 | 361 | yes | — |
| Greenland & St. Pierre | 2 | 15 | 0 | no | — |
| Latin America & The Caribbean | 52 | 100 | 1,053 | yes | — |
| Central America & Mexico | 8 | 100 | 132 | yes | — |
| South America | 16 | 100 | 677 | yes | — |
| The Caribbean | 28 | 100 | 45 | yes | — |
| Europe | 51 | 100 | 743 | yes | 3 popularity-ranked airports excluded; 261 airports outside the documented continental coordinate box excluded |
| Western Europe | 9 | 100 | 128 | yes | — |
| Eastern Europe | 10 | 100 | 213 | yes | — |
| Northern Europe / Scandinavia | 16 | 100 | 221 | yes | M49 Northern Europe is broader than narrow Scandinavia |
| Southern Europe / Mediterranean | 16 | 100 | 113 | yes | M49 Southern Europe excludes some non-European Mediterranean states |
| Middle East | 20 | 100 | 195 | yes | M49 Western Asia plus Egypt and Iran; other definitions differ |
| Gulf States | 6 | 59 | 0 | no | Six GCC members |
| Levant & Beyond | 9 | 100 | 25 | yes | Explicit nine-country convention |
| Africa | 60 | 100 | 851 | yes | — |
| North Africa | 7 | 100 | 41 | yes | — |
| Sub-Saharan Africa | 53 | 100 | 710 | yes | — |
| Southern Africa | 5 | 100 | 19 | yes | M49 intermediate region |
| Asia | 50 | 100 | 1,462 | yes | M49 convention includes Türkiye and Iran; excludes Egypt |
| East Asia | 7 | 100 | 333 | yes | — |
| Southeast Asia | 11 | 100 | 383 | yes | — |
| South Asia | 9 | 100 | 297 | yes | — |
| Central Asia | 5 | 55 | 0 | no | — |
| Oceania / South Pacific | 29 | 100 | 841 | yes | M49 Oceania includes Australia and New Zealand |
| Australia & New Zealand | 6 | 100 | 346 | yes | M49 subregion includes additional territories |
| Pacific Islands | 23 | 100 | 400 | yes | Melanesia, Micronesia and Polynesia; excludes Australia/NZ |

## Outcome and limits

All named-region resolver calls succeeded using the snapshots identified above. Europe applied the expected popularity exclusion and coordinate convention. The other regions order measured traffic where available and may include airports outside the user's intended subregion for transcontinental country membership; country-level policies and exceptions are shown in result metadata.

This does not satisfy `work.md` §17 region/calendar acceptance. Search pairs and fare sources were not executed. The 100-airport resolver cap means at least 25 named regions expose omitted airport candidates; most broad regions omit hundreds or more. A completed region-wide calendar would also need to account for source eligibility, date combinations, request budgets, provider failures, and all unsearched airports/pairs. Do not describe the results as exhaustive or as simultaneous inventory.
