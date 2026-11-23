# Google Flights API Anything one-way coverage gap — 2026-11-23

## Current behavior

The normal one-way Google source in `lib/providers.mjs` calls the `google-flights` `search` and `top` operations through `api-anything` (`lib/search.mjs`). The request transport rewrites the page URL to `hl=en-CA`, `gl=CA`, and `curr=CAD`.

The bundled `api-anything/sites/google-flights.json` response projection returns airline names, a numeric price, route airports, local departure/arrival time, arrival date, total duration, and connection airports. It does not return flight numbers, marketing-carrier codes per segment, segment timestamps, or response-side currency confirmation. Its own bundled documentation describes USD defaults. This projection cannot satisfy the app's complete-offer validator, which requires exact segment identity and rejects route-level prices as full itineraries. `tests/search.test.mjs` explicitly verifies that these rows are not promoted to offers.

The local normalizer now also leaves `currency` unset unless the response row explicitly supplies a three-letter currency. The `curr=CAD` request parameter alone no longer labels the returned number as CAD. A regression covers this distinction; the route-level record remains unshowable because both segment and currency evidence are absent.

The separate native browser adapter captures `GetShoppingResults` and `GetBookingResults`, but currently implements selected round trips only. Native one-way calendar RPC probing returned error marker `4`; that calendar operation remains opt-in and is not a substitute for a one-way itinerary result.

## Decision and remaining work

- Do not label the API Anything number CAD solely because the request URL asked for CAD.
- Do not turn its route summary into a complete flight offer or fill missing segment identifiers from elsewhere.
- The one-way Google source currently cannot contribute a validated itinerary; a failed or empty offer list must remain visible as incomplete coverage.
- A future API Anything spec extension may expose raw per-segment data already present in the embedded Google response. Before enabling it, verify the mapping with a current redacted fixture and a bounded live request, add offset-aware airport-timezone validation, prove the query's CAD setting is reflected by Google, and test end-to-end publication through the durable worker.
- Alternatively, implement a native one-way selection/booking flow only after capturing and validating the exact response shape for selected one-way flights. Do not infer `GetBookingResults` schema from the round-trip parser.
- The live API Anything wrapper and Google native RPC are not public provider APIs; unattended-use scope, rate policy and runtime stability remain open.

## Evidence

- Bounded live `api-anything` `search` operation: YHZ→LAX, one-way, 2026-12-15, queried 2026-11-23 through `canadianFetch` at tier 1. HTTP/source result was `ok` in 1,328 ms with 5 rows. Sanitized schema inspection found only `airline`, `arrivalDate`, `arrivalTime`, `departureTime`, `durationMinutes`, `from`, `price`, `to`, and `via`; zero rows had segment arrays, flight-number fields, or a response-side currency field. No prices, booking tokens, or raw response were logged. This is one provider operation, not a p95 or end-to-end worker/UI measurement.
- Local package docs: `node_modules/api-anything/sites/google-flights.md` and its bundled JSON projection. This describes package behavior; it is not independent Google documentation.
- Code: `lib/search.mjs`, `lib/providers.mjs`, `lib/flight-offer.mjs`, `lib/google-native.mjs`, `lib/google-round-trip.mjs`.
- Regression: `tests/search.test.mjs` — “does not promote Google route-level prices without flight-segment evidence.”
- Currency regression: `tests/search.test.mjs` — “Google API Anything cannot infer CAD from the requested page currency.” Focused provider/search suite: 33/33; full `npm test`: 667/667.
- Production build passes after retrying Next.js 16.4.3's security reminder. `npm audit --audit-level=low` reports one moderate Next.js advisory; npm's suggested forced upgrade to 16.4.6 is outside the declared dependency range and was not applied.
- Dated native calendar evidence and limits: [Google flexible-return calendar evidence](google-flexible-return-calendar-2026-11-23.md) and [reverse-endpoint implementation map](reverse-endpoint-implementation.md).

This live observation confirms the current API Anything projection gap for one exact query only; it does not establish broader Google availability or current fare coverage. The adapter remains incomplete for validated one-way itineraries.
