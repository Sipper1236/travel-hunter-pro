# Bounded YHZ–Europe route discovery and split-ticket comparison — 2026-11-13

## Search scope

- One adult, economy, one-way, YHZ–FRA, Dec 15 2026, CAD, Ignav.
- Resolved Europe airport candidates from the cached resolver snapshot. The resolver's configured top-three traffic-ranked exclusion was preserved. Excluding the selected FRA route, nine exact alternatives were planned from the first ten displayed candidates; four were requested under `routeSearchLimit: 4` and a 12-request total budget.
- Searched pairs: YHZ–FCO, YHZ–BCN, YHZ–MUC and YHZ–LGW. Not searched: YHZ–DUB, YHZ–PMI, YHZ–ZRH, YHZ–VIE and YHZ–MXP.

## Observations

- Fresh through observation: CAD 993 at `2026-11-13T00:30:54.537584Z`, with AC2067 YHZ–YYZ, TP258 YYZ–LIS and LH1167 LIS–FRA.
- The comparison consumed 8 of 12 fare requests: baseline refresh, four pair searches and three contiguous ticket-block searches. It returned one complete split plan at CAD 1,532, which is CAD 539 more than the through observation before extras.
- The four alternate-pair responses contained 57 matching fresh CAD itinerary alternatives. Eight were displayed and 49 omitted by the UI's eight-alternative display cap. Provider completion was known and explicitly `false`.
- The captured command summary retained the aggregate plan total and exact baseline flights, but not the three ticket-block component totals. The aggregate CAD 1,532 is therefore not a component-level audit record.

## Limits

Five of nine planned pairs were not searched. The region resolver itself is bounded and directory-based; this check is not exhaustive Europe coverage. The comparison is based on provider observations. Seller availability, inventory continuity across independently priced tickets, fare rules, baggage, mandatory charges and checkout totals were not verified. No seller URL was opened; no reservation or purchase occurred.

This confirms bounded route discovery, preserved request accounting and one live split-price comparison for this query. It does not establish savings or bookability. P3 remains Partial.
