# Live same-flight separate-ticket comparison — 2026-11-12 20:20 -04

## Query

- One adult, economy, one-way, YHZ→LAX, 2026-12-15, CAD, Ignav only.
- Selected a fresh exact flight from a bounded Ignav response, then ran `compareSeparateTickets` with a 12-search maximum, 180-minute minimum self-transfer buffer, and contiguous ticket blocks enabled.
- No alternate airport pairs were supplied. The comparison refreshed its baseline and priced the two exact observed segments; 3 fare searches were used of the 12-request limit. One eligible ticket partition, two unique blocks, both priced, and one complete plan were reported.

## Observed itinerary and comparison

The fresh through-itinerary observation was CAD 302 at `2026-11-13T00:20:48.765636Z`, with these exact segments:

| Segment | Flight | Departure UTC | Arrival UTC |
|---|---|---|---|
| YHZ–YYZ | AC2061 | 2026-12-15 11:00 | 2026-12-15 13:41 |
| YYZ–LAX | AC787 | 2026-12-15 17:00 | 2026-12-15 22:34 |

The independent segment observations were CAD 194 for YHZ–YYZ at `00:20:51.184806Z` and CAD 273 for YYZ–LAX at `00:20:52.224416Z`, totaling CAD 467. The split is CAD 165 more than the through observation before any unobserved extras. The split plan was labeled `no_lower_price`. Its baseline-derived quote expiry was `2026-11-13T00:35:48.765Z`.

## Limits

This confirms the current Ignav adapter and comparison code can match the same exact flight segments, validate chronology and quote freshness, and total the segment observations under budget. It does not show the split tickets save money. Seller availability, ticket issuance, fare-rule compatibility, baggage, mandatory charges, seat inventory continuity, payment terms, and final checkout totals were not checked. Independent quotes may overlap inventory. No seller URL was opened and no purchase or reservation occurred. No alternate airport-pair coverage was searched. This is a short-lived provider observation, not a currently actionable offer.
