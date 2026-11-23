# Google Flights flexible-return calendar grids — 2026-11-23

## Change

The opt-in Google `GetCalendarPicker` adapter now supports an unfiltered round-trip calendar with a variable return-date range for the already-supported party shape: one adult, economy, no identified travelers. Previously, Google round-trip grids were admitted only for one fixed return date (or a single departure-date round trip).

For each exact return date, the adapter requests a grid covering the selected departure dates that do not fall after that return. That one fixed-return response can populate several departure/return cells. The calendar maps each row only to its exact date pair, preserves the observation's Google `sourceQueryDate`, and rebinds the visible `calendarStart`/`calendarEnd` to the overall user request. The durable worker verifies the provider URL against the exact source-query date and return date and rejects a tampered source date that differs from the grid's exact origin, even if the substituted date lies inside the departure interval.

The request budget continues to count every logical route/departure/return/provider combination, even where one returned grid covers multiple cells. `wireResponses` reports the actual grid requests separately. Provider capability output identifies this as price-only grid support and does not advertise it as native itinerary-search coverage. The adapter remains opt-in (`TRAVEL_GOOGLE_CALENDAR_RPC=1` or explicit injected adapter), is paced through the shared Google source gate, and retains the response deadline/size cap. Active filters, parties other than one adult, and cabins other than economy do not use the price-only grid.

## Verification

- Calendar/query/worker suites: **58/58 passed**; provider capability/calendar/query/worker suites: **65/65 passed**.
- The regression covers two departure dates and two return dates: four exact logical cells use two fixed-return grids, each source result retains the correct return date, budget refusal occurs before provider work, and worker validation rejects a tampered but otherwise in-range source-query date.
- No live Google request was made for flexible-return behavior. This proves integration against provider fixtures, not current endpoint support, response completeness, or latency.
- Full `npm test`: **659/659 passed**. Production build passed after retrying Next.js 16.4.3's security reminder; the reminder remains unresolved.

## Limits

These are date-level CAD observations, not itinerary quotes. They contain no flight segments, seller inventory, baggage, fare rules, or final charges. The endpoint is an undocumented first-party web-app RPC. Live shape compatibility, source policy and authorization for unattended use, and per-query latency remain open. The full reverse-endpoint objective and `work.md` §17 are incomplete.
