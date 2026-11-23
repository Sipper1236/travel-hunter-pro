# Live fare-calendar regional audit — 2026-11-09

## Scope and query

This audit exercised the production-built local app, durable worker, dynamic region resolver, fare calendar and configured fare adapters. Each job used a one-way economy search for one adult, no children, CAD, from YHZ on 2026-12-15, with no extra fare filters. `source: all` selected every compatible provider configured on this local server. The airport-candidate limit was four. Each resolved region received a four provider/date-slot budget, which allowed one representative destination-airport pair; Europe received 16 slots and four pairs to honor the requested exclusion of its top three traffic-ranked airports and use more than three candidates.

This is a bounded smoke audit, not exhaustive regional coverage, a market minimum, seller verification or a booking. Resolved directories reported between 14 and 2,699 known omitted airport candidates in the 19 post-fix results. The directories themselves can omit additional airports. The origin remained YHZ, so this did not test every origin/destination pair or every pair within each region.

## Corrected post-fix results

The post-fix run began at 2026-11-09 02:29 UTC and was explicitly stopped by the user after 19 of 28 requested labels. All 19 jobs completed; 18 dates returned an observed fare and Greenland & St. Pierre returned no matching observation. Every result had `fullyScanned: false` because Expedia via Omkar did not complete, even when another provider returned an observation. The prices below are point-in-time observed calendar values from that run. They are now historical and must not be presented as current or seller-confirmed.

| Region | Selected destination airport(s) | Known candidates omitted | Calendar result | Observed CAD price / provider |
|---|---:|---:|---|---|
| North America | ATL | 2,699 | Observed | 377 / Google Flights |
| United States | ATL | 1,856 | Observed | 377 / Google Flights |
| Canada | YYZ | 460 | Observed | 164 / Ignav |
| Greenland & St. Pierre | GOH | 14 | No matching observation | — |
| Latin America & The Caribbean | MEX | 1,152 | Observed | 967 / Google Flights |
| Central America & Mexico | MEX | 231 | Observed | 967 / Google Flights |
| South America | BOG | 776 | Observed | 683 / Ignav |
| The Caribbean | PUJ | 144 | Observed | 387 / Google Flights |
| Europe | FRA, FCO, BCN, MUC | 839 | Observed | 1,054 / Google Flights |
| Western Europe | NCE | 227 | Observed | 1,356 / Ignav |
| Eastern Europe | SVO | 312 | Observed | 5,212 / Ignav |
| Northern Europe / Scandinavia | ARN | 320 | Observed | 1,419 / Ignav |
| Southern Europe / Mediterranean | PMI | 212 | Observed | 1,403 / Ignav |
| Middle East | SAW | 294 | Observed | 7,827 / Ignav |
| Gulf States | RUH | 58 | Observed | 1,844 / Ignav |
| Levant & Beyond | SAW | 124 | Observed | 7,827 / Ignav |
| Africa | CAI | 950 | Observed | 1,525 / Ignav |
| North Africa | CAI | 140 | Observed | 1,525 / Ignav |
| Sub-Saharan Africa | ADD | 809 | Observed | 1,610 / Ignav |

For Europe, the live resolver had 627 candidates with recorded passenger values and no exclusion shortfall. It excluded LHR (83,884,572), CDG (67,421,316), and MAD (66,197,066), then searched FRA, FCO, BCN and MUC. All four airport-pair queries were checked. The calendar selected a CAD 1,054 Google Flights observation for the date. The exact winning route and seller price were not rechecked; this is an observed provider price, not a confirmed or current offer.

### Provider coverage in the 19 post-fix jobs

The four eligible configured adapters each received 22 provider/date slots because Europe had four pairs and the other 18 regions had one pair each (88 slots total):

| Provider | Queries | Successful | Unavailable |
|---|---:|---:|---:|
| Ignav | 22 | 22 | 0 |
| Google Flights | 22 | 17 | 5 |
| ITA Matrix | 22 | 18 | 4 |
| Expedia via Omkar | 22 | 0 | 22 |

Expedia via Omkar returned HTTP 500 (`temporarily_unavailable`) on all 22 route/date queries. Expedia partner API, Skyscanner and Air Canada NDC were not configured and were correctly excluded from `all`; they were not queried. Provider/date slots are the calendar's logical budget and do not include all transport retries, Google RPCs/assets or other underlying HTTP work.

## Defects found and changes made

The first 28-label live pass happened before the calendar fix. It reached 22 regions and failed six location resolutions with `Neither airport directory is available.` Among the 22 resolved jobs, 15 calendar results stopped before scanning the date with `Cannot read properties of undefined (reading 'slice')`; the other seven returned observations. Source responses showed that some valid Google Flights observations omitted segment arrays while carrying a validated `via` list. Calendar validation accepted those observations, but a later transformation assumed `segments` always existed.

The calendar now preserves the already validated `via` fields for outbound and inbound journeys rather than deriving them with an unconditional segment-array `.slice()`. A regression test covers a Google Flights one-way offer with no segment array. The calendar's resolved-location coverage also now carries the Europe popularity-exclusion limit, ranked-candidate count, shortfall and excluded-airport codes so the UI can disclose the selection evidence.

After the fix and rebuild, the audit was restarted. The previously unavailable region directory recovered; all first 19 labels resolved, including all five Europe labels. The user then asked to stop. The remaining nine post-fix labels have not been rerun.

## Continuation — remaining nine regions — 2026-11-12 20:01–20:07 -04

Resumed the stopped audit for the nine remaining labels using the same query shape (YHZ → region, one adult, one-way economy, CAD, 2026-12-15, all compatible configured providers). Each job had four provider/date slots and four airport candidates, allowing exactly one representative airport pair. All nine jobs completed, searched one pair, and returned one fresh-under-calendar-TTL observed price. Each job remained `fullyScanned: false` because Expedia via Omkar returned HTTP 500. Direct Expedia, Skyscanner, and Air Canada NDC were unconfigured and excluded. Some Google Flights queries also failed. The final price is the lowest among providers that completed the pair; it is not a seller quote or checkout total.

| Region | Pair searched | Observed CAD | Source | Observation time UTC | Three candidate airports omitted by per-job request budget |
|---|---|---:|---|---|---|
| Southern Africa | YHZ–CPT | 2,185 | Ignav | 2026-11-13 00:01:12 | DUR, PLZ, ELS |
| Asia | YHZ–HND | 1,690 | Ignav | 2026-11-13 00:02:19 | PVG, DEL, CAN |
| East Asia | YHZ–HND | 1,690 | Ignav | 2026-11-13 00:02:19 | PVG, CAN, SZX |
| Southeast Asia | YHZ–BKK | 1,752 | Ignav | 2026-11-13 00:03:26 | CGK, SGN, SIN |
| South Asia | YHZ–DEL | 2,025 | Google Flights | 2026-11-13 00:04:25 | BLR, HYD, THR |
| Central Asia | YHZ–ALA | 2,624 | Ignav | 2026-11-13 00:05:02 | OSS, SCO, GUW |
| Oceania / South Pacific | YHZ–SYD | 1,960 | Google Flights | 2026-11-13 00:05:58 | AKL, BNE, ADL |
| Australia & New Zealand | YHZ–SYD | 1,960 | Google Flights | 2026-11-13 00:06:46 | AKL, BNE, ADL |
| Pacific Islands | YHZ–APW | 5,362 | Ignav | 2026-11-13 00:07:01 | CXI, GUM, HIR |

The shared source report shows Ignav and ITA Matrix succeeded for all nine pairs; Google Flights succeeded for seven and failed for Central Asia and Pacific Islands; Expedia via Omkar failed for all nine. These are point-in-time provider observations. Seller availability, exact revalidation, baggage, mandatory charges, simultaneous inventory and payable checkout totals were not checked. No purchase or reservation occurred.

Across the original 19 and this continuation, one representative pair was searched for each of the 28 named regions. The original 19-region sample returned observations for 18 regions and no matching observation for Greenland & St. Pierre. The continuation returned an observation for all nine remaining regions. Thus, this bounded sample now has 27/28 region/date observations; it does not establish complete source coverage, exhaustive airport coverage, a regional market minimum, or current seller availability. The first 19 queries and resumed nine used the same fixed YHZ origin/date/party/cabin. Many hundreds of known airports were omitted by resolver and request caps; see [the Nov 12 resolver coverage audit](region-airport-coverage-2026-11-12.md).

## Remaining work and limits

1. Rerun any labels that return a directory error, within the source's rate limits; do not call a failed/blocked provider successful.
2. Make `FareCalendar` render the Europe `popularityExcludedAirports` list where available. Current calendar UI may show selected/omitted candidates and the region method without exposing every excluded code.
3. Diagnose the repeated Omkar HTTP 500 with the provider/API Anything owner. Until it succeeds, no `all` calendar in this audit is fully scanned.
4. Expand beyond the single YHZ origin and one representative destination pair per region, and retain precise candidate, country and airport-pair exclusions. Do not claim exhaustive coverage.
5. Refresh any fare through its seller before treating it as current, and verify the exact itinerary, baggage, mandatory charges, availability and payable total. No seller refresh, reservation, checkout or purchase was performed.

## Verification

- `npm test` — 537/537 passed.
- `npm run build` — passed.
- `npm audit --audit-level=low` — 0 vulnerabilities.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:calendar-source` — passed with source/API requests intercepted; confirmed the `all` source UI exposes seven provider entries, identifies Europe as a region, and submits worker-side region resolution. This is UI smoke evidence, not live inventory evidence.
- Actual live jobs used the local calendar jobs API and existing worker. Prices were observations, not seller-verified offers. No purchase, reservation or deployment occurred. The local web server started for this work has been stopped; the worker process predated this audit and was left running.
