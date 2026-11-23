# Google Flights API Anything one-way coverage gap — 2026-11-23

## Current behavior

The normal one-way Google source in `lib/providers.mjs` calls the `google-flights` `search` and `top` operations through `api-anything` (`lib/search.mjs`). The request transport rewrites the page URL to `hl=en-CA`, `gl=CA`, and `curr=CAD`.

The bundled `api-anything/sites/google-flights.json` response projection returns airline names, a numeric price, route airports, local departure/arrival time, arrival date, total duration, and connection airports. It does not return flight numbers, marketing-carrier codes per segment, segment timestamps, or response-side currency confirmation. Its own bundled documentation describes USD defaults. This projection cannot satisfy the app's complete-offer validator, which requires exact segment identity and rejects route-level prices as full itineraries. `tests/search.test.mjs` explicitly verifies that these rows are not promoted to offers.

The local normalizer now also leaves `currency` unset unless the response row explicitly supplies a three-letter currency. The `curr=CAD` request parameter alone no longer labels the returned number as CAD. A regression covers this distinction; the route-level record remains unshowable because both segment and currency evidence are absent.

The native browser adapter now also implements a bounded one-way results-page path for one adult in economy. Unlike the failed one-way calendar RPC experiment (marker `4`), this follows the ordinary Google Flights results page and reads its `GetShoppingResults` response. It is wired as the default one-way Google provider path. The older API Anything route-only rows remain withheld.

## Decision and remaining work

- Do not label the API Anything number CAD solely because the request URL asked for CAD.
- Do not turn its route summary into a complete flight offer or fill missing segment identifiers from elsewhere.
- One adult/economy one-way results can now contribute bounded segment-level Google page observations. They are not seller-refreshed or bookable fare claims; current seller availability, baggage, mandatory fees, and checkout total remain unverified.
- The native flow requires the exact generated source URL, visible `Currency CAD` and one-passenger labels, exact route/date, full flight identity, validated airport time zones, and a single bounded results response. It stops on access checks, HTTP refusals, malformed data, or unsupported party/cabin shapes.
- Do not infer `GetBookingResults` schema from the round-trip parser. Seller refresh for one-way remains unimplemented.
- Demonstrate the default provider path through the durable worker and website using current evidence before marking this source complete. Confirm the approved unattended-use scope and provider rate terms; one ordinary page observation does not establish authorization or reliability.
- The live API Anything wrapper and Google native RPC are not public provider APIs; unattended-use scope, rate policy and runtime stability remain open.

## Evidence

- Bounded live `api-anything` `search` operation: YHZ→LAX, one-way, 2026-12-15, queried 2026-11-23 through `canadianFetch` at tier 1. HTTP/source result was `ok` in 1,328 ms with 5 rows. Sanitized schema inspection found only `airline`, `arrivalDate`, `arrivalTime`, `departureTime`, `durationMinutes`, `from`, `price`, `to`, and `via`; zero rows had segment arrays, flight-number fields, or a response-side currency field. No prices, booking tokens, or raw response were logged. This is one provider operation, not a p95 or end-to-end worker/UI measurement.
- Bounded live ordinary Google one-way page observation: YHZ→LAX, 2026-12-15, queried 2026-11-23. The page and one `GetShoppingResults` response returned HTTP 200; the response body was 93,772 bytes, visible controls showed CAD and one passenger, and the existing segment parser yielded 10 candidates. No human challenge appeared; no prices, booking tokens, or raw response were recorded. This proves only the current ordinary page/query response shape. It does not prove seller inventory, end-to-end worker/UI publication, p95 latency, broad availability, or permitted unattended-use scope.
- Local package docs: `node_modules/api-anything/sites/google-flights.md` and its bundled JSON projection. This describes package behavior; it is not independent Google documentation.
- Code: `lib/search.mjs`, `lib/providers.mjs`, `lib/flight-offer.mjs`, `lib/google-native.mjs`, `lib/google-round-trip.mjs`.
- Fixture browser regressions: `tests/google-native.test.mjs` — native one-way exact segments and explicitly unrefreshed price; challenge/rate/party refusal; one-results-RPC cap. The same suite covers native round-trip capture.
- Current verification after adding the native one-way default path: `npm test` **669/669**; `npm run build` passed on retry after Next.js's security reminder. `npm audit --audit-level=low` reports one moderate Next.js advisory; the suggested forced fix to 16.4.6 is outside the declared dependency range and was not applied.
- Regression: `tests/search.test.mjs` — “does not promote Google route-level prices without flight-segment evidence.”
- Currency regression: `tests/search.test.mjs` — “Google API Anything cannot infer CAD from the requested page currency.” Focused provider/search suite: 33/33; full `npm test`: 667/667.
- Production build passes after retrying Next.js 16.4.3's security reminder. `npm audit --audit-level=low` reports one moderate Next.js advisory; npm's suggested forced upgrade to 16.4.6 is outside the declared dependency range and was not applied.
- Dated native calendar evidence and limits: [Google flexible-return calendar evidence](google-flexible-return-calendar-2026-11-23.md) and [reverse-endpoint implementation map](reverse-endpoint-implementation.md).

The live observations establish both the API Anything projection gap and one ordinary native one-way page shape, each for one exact query only. Native one-way page observations are now implemented, but seller refresh, durable worker/UI reproduction, broader Google availability, rate/permission scope, and all remaining reverse-endpoint requirements stay open.
