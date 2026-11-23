# Region resolver recheck — 2026-11-13 22:16 UTC

## Scope and method

Sequentially called the production `resolveRegion()` path for all 28 geographic labels listed in `work.md`. This was a resolver-only audit: no flight providers, fare calendars, seller pages, or booking endpoints were called. The resolver used cached directory snapshots: OurAirports saved `2026-11-12T22:39:46.579Z` and Wikidata/M49-related snapshots saved between `2026-11-09T01:40:29.020Z` and `2026-11-09T02:40:11.471Z`. These snapshots were within their configured freshness windows; this is not a fresh live directory/M49 download.

All 28 calls resolved. Counts below distinguish the returned candidate list (capped at 100) from additional known candidates returned by the bounded directories. `more=true` means the result is not exhaustive. Airport resolution does not imply any provider searched those airports.

| Work.md label | Returned | Additional known | More |
|---|---:|---:|:---:|
| North America | 100 | 2,600 | yes |
| United States | 100 | 1,757 | yes |
| Canada | 100 | 361 | yes |
| Greenland & St. Pierre | 15 | 0 | no |
| Latin America & The Caribbean | 100 | 1,053 | yes |
| Central America & Mexico | 100 | 132 | yes |
| South America | 100 | 677 | yes |
| The Caribbean | 100 | 45 | yes |
| Europe | 100 | 743 | yes |
| Western Europe | 100 | 128 | yes |
| Eastern Europe | 100 | 213 | yes |
| Northern Europe / Scandinavia | 100 | 221 | yes |
| Southern Europe / Mediterranean | 100 | 113 | yes |
| Middle East | 100 | 195 | yes |
| Gulf States | 59 | 0 | no |
| Levant & Beyond | 100 | 25 | yes |
| Africa | 100 | 851 | yes |
| North Africa | 100 | 41 | yes |
| Sub-Saharan Africa | 100 | 710 | yes |
| Southern Africa | 100 | 19 | yes |
| Asia | 100 | 1,462 | yes |
| East Asia | 100 | 333 | yes |
| Southeast Asia | 100 | 383 | yes |
| South Asia | 100 | 297 | yes |
| Central Asia | 55 | 0 | no |
| Oceania / South Pacific | 100 | 841 | yes |
| Australia & New Zealand | 100 | 346 | yes |
| Pacific Islands | 100 | 400 | yes |

## Geographic conventions and limits

- Europe uses the versioned UNSD M49 country set, then an airport-level approximate box of 25°W–45°E and 34°N–72°N. In this snapshot it omitted 261 known airports outside that box and had zero airports with unknown coordinates.
- The resolver reports and excludes the three highest passenger-ranked candidates before returning Europe candidates: LHR, CDG, and MAD. It does not call the remaining list a worldwide or exhaustive airport ranking.
- North America, Latin America & The Caribbean, and other overlapping labels retain their declared M49 memberships. “Scandinavia” maps to the documented Nordic-region convention; “Mediterranean” maps to the 21 Barcelona Convention state parties as a country-level proxy. These definitions differ from other common uses and are disclosed in the policy metadata.
- Country-membership regions can include out-of-subregion airports for transcontinental countries. Only Europe currently applies airport-level coordinate exclusion. Directory omissions, the 100-airport exposed list, upstream row/country caps, and downstream 4–20 airport search limits remain coverage limits.
- The result includes additional-known-airport counts; it does not enumerate every Cartesian airport pair omitted by a future two-region fare search. Calendar results separately identify the selected route pairs and budget exclusions, but this resolver check does not verify every pair or fare source.

## Result

This recheck confirms current cached resolver behavior, not fresh supplier or geographic-source completeness. All 28 named policies remain resolvable and their candidate counts match the prior audit. Region resolution is **Partial** under `work.md`: no fare source was exercised here, most regions exceed the exposed-list cap, and overlapping/transcontinental conventions remain application-defined approximations where documented.
