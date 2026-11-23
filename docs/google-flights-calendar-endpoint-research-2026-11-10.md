# Google Flights date-calendar RPC research — 2026-11-10

## Finding

The installed `api-anything` Google Flights site definition contains a third, previously undocumented-in-this-app endpoint family:

```text
POST https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetCalendarPicker
```

This is a private Google Flights web RPC, not a supported public API. The local capture names its operation `priceCalendar`. Its learned response extraction returns rows shaped as a departure date and a price. The capture stores the response selectors as `date=[0]` and `price=[2][0][1]` within the extracted date row.

The captured request is an `application/x-www-form-urlencoded` POST. Its `f.req` value contains a JSPB positional array serialized inside JSON and form encoding. The learned request slots place the exact origin and destination airport codes, a departure date, and a start/end calendar interval inside that array. The request also has a referer for the matching Google Flights search and an `x-goog-batchexecute-bgr` header captured from the browser session. The URL includes session/build/request parameters (`f.sid`, `bl`, `_reqid`, and related values); the sample values are volatile and must not be reused as constants.

The learned schema accepts airport IATA codes, not metro or region labels, and bounds the requested date range to roughly three months. The captured fixture is en-US/USD. It does not establish that CAD can be requested or that the response price is a complete itinerary quote.

## Evidence and confidence

- Local capture definition: `../api-anything/sites/google-flights.json`, operation `priceCalendar` (path and request/response mapping).
- Capture research notes: `../api-anything/docs/research/live-probes.md`, Google Flights section. Those notes document live observation of the site's Google Flights RPC family and its chunked JSPB response format. They do not independently describe a current `GetCalendarPicker` live replay.
- Current app code: `lib/google-native.mjs` currently observes `GetShoppingResults` and `GetBookingResults`; the new calendar RPC is not integrated there or into the fare-calendar worker.
- Live recheck on 2026-11-10: attempted ordinary read-only loads of the Air Canada Vacations widget and Booking.com public search page both ended at `net::ERR_CONNECTION_RESET` before browser documents loaded. No provider request was observed, no challenge was handled, and no request was replayed. A fresh Google Flights capture was therefore not established in this run.

**Status:** a previously captured endpoint candidate with a concrete request/response shape; not a newly live-verified endpoint in this run. Treat the response parser, currency, availability, and current request contract as unverified until recaptured through an ordinary Google Flights browser session.

## Safe next step

When the public Google Flights page is reachable, capture only the normal date-calendar interaction for one exact airport pair. Record the endpoint path, request method, non-sensitive field names, response status/content type, and whether the requested dates map to returned rows. Keep session tokens, `f.req` values, BotGuard headers, cookies, and raw captures private and out of logs/source control. Stop if the site requires a CAPTCHA or other human access check. Do not synthesize or replay stale browser tokens.

Before considering integration, confirm current CAD behavior and date-range semantics from fresh responses; validate airport and date constraints, provider coverage and omissions; then add bounded-cost tests using sanitized fixtures. Do not substitute this calendar's price observations for exact, validated round-trip itineraries or seller-confirmed prices.
