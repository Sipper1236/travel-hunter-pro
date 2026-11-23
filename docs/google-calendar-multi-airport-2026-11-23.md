# Google Flights date grid for multi-airport calendars — 2026-11-23

## Change

The experimental Google `GetCalendarPicker` path was restricted to a calendar with one selected airport pair. It now supports multiple exact airport pairs, including bounded pairs resolved from regions, when the user selects Google as the calendar source. It opens one date grid per exact route and reuses that response across the grid's departure dates. The per-request cache identity includes route, trip type, return date, party counts/ages, cabin, filters, and calendar date range. Active filters still disable the price-only grid because it does not return itinerary details needed to prove filter compliance.

Supported shape remains one adult, economy, no identified travelers, no active filters, one-way or fixed-return round trip. Round-trip ranges with changing return dates are not enabled. Exact date and route validation, CAD-only labeling, price-only classification, airport-pair limits and the existing 250-request cap remain in effect. The budget counts logical route/date requests; `wireResponses` records actual Google grid calls (one per airport pair). The default remains opt-in unless the adapter is injected for a test.

## Verification

- `node --test tests/calendar-search.test.mjs tests/calendar-worker-result.test.mjs tests/calendar-query.test.mjs`: **53/53 passed**. The two-airport regional fixed-return fixture asserts two route-specific grid calls for four logical route/date slots, exact return-date binding, four provider responses, one wire response per pair, and worker result validation.
- Full `npm test`: **653/653 passed**.
- `npm run build`: passed after retrying past Next.js 16.4.3's security reminder.
- `check-calendar-streaming-ui` against an isolated production build passed (2 status polls, 0 page errors, provider/job calls intercepted and external requests blocked). This check covers generic calendar progressive presentation, not a multi-airport Google result.
- No live Google multi-airport calendar request was made. Live endpoint behavior, region route coverage, latency, and p95 remain unverified. One-way live coverage is also still shape-specific; prior fixed-return single-pair evidence does not prove this extension.

The implementation remains experimental and disabled by default. Google web-app RPC authorization/scope and the broader reverse-endpoint/`work.md` §17 criteria remain open. The dependency audit still has one moderate Next.js 16.4.3 finding.
