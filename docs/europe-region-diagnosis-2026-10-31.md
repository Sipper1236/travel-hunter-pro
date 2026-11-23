# Europe airport search: diagnosis, implementation, and live verification — 2026-10-31

## Root cause

The previous Europe resolver result was loaded from `.cache/regions-v5` and contained an alphabetic candidate list beginning `AAA, AAL, AAQ`. That historical list explains why the user's search used irrelevant locations. The UI had already changed to a default of 10 in code, but the helper text still claimed `1–100`; the server had a separate `4–100` limit. A stale persistent cache concealed the improved resolver, and exact-class matching also omitted many real international airports.

## Current behavior

- Europe uses a fresh cache namespace, `.cache/regions-v7`.
- Candidate airports come from Wikidata countries classified under Europe (Q46) and airport coordinates within 25°W–45°E and 34°N–72°N.
- Airport instance-of subclasses are included via `P31/P279*`.
- The resolver reads passenger traffic property P3872, collapses repeated observations by IATA code using the highest recorded figure, then sorts descending by that figure. Airports without a recorded passenger value or coordinates are not included.
- The raw Wikidata query is capped at 1,000 traffic observations; the resolver returns the top 100 airport codes and lists known further candidates. This is a bounded, incomplete dataset, not a full airport catalog or proof of current popularity.
- The site defaults to 10, lets the user select 4–20, and carries that value into the search job. If both endpoints are expanded regions, at most 400 planned airport pairs are checked. Provider stops may reduce checked pairs.

## Live evidence

A fresh live call through `resolveRegion('Europe')` completed in 5.1 seconds on 2026-10-31. It returned 100 ranked airports and 247 additional ranked codes. The top observed passenger figures were:

| Rank | IATA | Airport | Country | Recorded passengers |
| ---: | --- | --- | --- | ---: |
| 1 | IST | Istanbul Airport | Turkey | 84,457,421 |
| 2 | LHR | London Heathrow Airport | United Kingdom | 83,884,572 |
| 3 | CDG | Paris-Charles de Gaulle Airport | France | 67,421,316 |
| 4 | AMS | Amsterdam Schiphol Airport | Netherlands | 66,828,453 |
| 5 | MAD | Madrid-Barajas Airport | Spain | 66,197,066 |
| 6 | FRA | Frankfurt Airport | Germany | 61,564,957 |
| 7 | FCO | Roma Fiumicino Airport | Italy | 51,306,744 |
| 8 | SAW | Istanbul Sabiha Gökçen International Airport | Turkey | 48,407,318 |
| 9 | BCN | Josep Tarradellas Airport Barcelona-El Prat | Spain | 41,639,622 |
| 10 | MUC | Munich Airport | Germany | 41,568,000 |

These are the highest values represented in Wikidata, potentially from different years; they are not comparable current-year counts. The query uses Q46 political country membership and an approximate continental bounding box. It can include airports in transcontinental countries (for example, Turkish airports) and can exclude eastern European locations east of 45°E. The country list displayed by the UI is the set represented in the capped observations, not every European country.

Chromium against the built local site observed minimum 4, maximum 20, default 10, and accepted custom value 14; the displayed pair budget became 196. A separate intercepted browser submission confirmed `airportLimit: 14` reached `/api/search/jobs` with Europe and Canada as the endpoints. The API was intercepted, so no provider search or synthetic production fare was involved.

## Verification and remaining limits

- `npm test -- --test-concurrency=2`: 297 passed.
- `npm run build`: passed.
- `npm audit`: 0 vulnerabilities.
- Live Europe resolver query: passed in 5.1 seconds and produced popularity-ranked output.
- Live fare-provider search: not run; provider inventory, fare availability, and seller prices remain unverified.
- Geographic policy is approximate and recorded-traffic data is incomplete; results must not be described as exhaustive or current annual traffic.

## Follow-up selection rule — 2026-11-06

The current Europe resolver still ranks by recorded Wikidata P3872 passenger values, but now intentionally excludes the first three ranked airports (IST, LHR and CDG in the 2026-10-31 observation) from fare-search candidates. The default limit of 10 therefore selects ranked candidates 4–13. The top three are surfaced separately as intentionally excluded, including in results merged with OurAirports, so that directory cannot reintroduce them. The persistent cache namespace advanced to `.cache/regions-v8` to prevent prior candidate lists from masking the rule. The exclusion applies to Europe only; reported passenger values remain historical/incomparable observations, not current traffic.
