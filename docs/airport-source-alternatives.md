# Airport source alternatives

Checked 2026-11-05. Research only; no production resolver change or fare request.

Use a runtime-downloaded, shared OurAirports cache for airport discovery, joined directly to the existing UN M49 ISO-alpha2 scopes. Keep Wikidata for optional enrichment or names outside the supported scope policies. This removes both country-entity mapping and per-country-batch airport SPARQL requests from named-region searches. This is an implementation recommendation, not a verified replacement adapter.

## Source contract

[OurAirports downloads](https://ourairports.com/data/) provides worldwide airport/country/subdivision CSV files, generated nightly and released to the public domain without an accuracy guarantee. The [official repository](https://github.com/davidmegginson/ourairports-data) explains that GitHub file dates change only when contents change, even though generation is daily. Download the [original airports.csv](https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv), rather than a transformed mirror that might omit useful columns.

The [data dictionary](https://ourairports.com/help/data-dictionary.html) documents stable internal `id`, `ident`, airport `type`, names, latitude/longitude, `continent`, `iso_country`, `iso_region`, municipality, `scheduled_service`, IATA/ICAO codes and source links. A scheduled-service flag is directory evidence, not proof of a particular route, seat or fare. ISO-like values can include unofficial codes such as XK; unmatched codes must be disclosed rather than silently assigned to a country. Municipality means the city served and may differ from the physical municipality.

The documented airport schema has no passenger totals. The current resolver's highest-recorded-passenger ranking cannot be reproduced from OurAirports alone. A reasonable explicit replacement is scheduled-service airports first, then airport size/type, then a deterministic tie-breaker. Label that ordering as a heuristic; do not call it popularity or current traffic. Another option is infrequent optional Wikidata traffic enrichment shared across all regions, with its own timestamp and missing-data disclosure.

## Preserve the geographic policy

The existing `lib/m49-regions.mjs` policies select country/area ISO codes from the [official UNSD M49 table](https://unstats.un.org/unsd/methodology/m49/overview/). Join those codes directly to `iso_country`, preserving separately coded territories, overlaps, and the explicit application conventions for Middle East and Levant & Beyond. Do not replace those scopes with OurAirports' broad continent field: its country assignment need not match M49 or the application's conventions.

Europe currently bypasses M49 in `lib/regions.mjs`: it uses Wikidata country-to-Europe membership, a coordinate box, and requires passenger observations. Switching sources must explicitly version and describe any changed Europe rule. Coordinates can preserve the same approximate box, but M49 Europe membership is a different policy from Wikidata Q46 membership. Neither a country join nor a rectangle resolves all transcontinental boundaries.

## Runtime cache and coverage

Fetch and validate the full dataset once per refresh interval, coalesce concurrent requests, and share it across workers. Use a bounded download, proper CSV parsing, schema/coordinate/code checks, atomic replacement and explicit stale-cache metadata. Cache source URL, retrieval time and a content hash; retain the prior valid snapshot if refresh fails. Region filtering then runs locally and incurs no Wikidata requests. HTTP refusals still need cooldown handling; moving traffic does not create an unlimited service guarantee.

This would be a dynamically fetched source snapshot, not a bundled static airport list or prefilled destination menu. The earlier user instruction rejects prerecorded/bundled place lists; disclose the runtime cache and keep only YHZ prefilled. Never ship airport rows as production fallbacks.

Keep airport/date/provider request budgets, selected-airport lists, known omitted airports and unsearched pairs. Report excluded malformed/closed/non-scheduled rows and unmatched country codes. Absence from this community-maintained dataset is not proof an airport does not exist, and discovery coverage does not prove bookable inventory.

## Evidence and next validation

The original raw CSV was reachable with HTTP 200 during this investigation, and its observed header includes the documented discovery fields but no passenger totals. No adapter was implemented. Before replacement: test region ISO joins and territories, duplicate/missing IATA codes, malformed/quoted CSV, stale refresh and concurrent workers; compare fresh Canada, Europe, Caribbean, Asia and Oceania selections; then exercise the calendar's independent departure/return ranges and omission reporting through the real worker.
