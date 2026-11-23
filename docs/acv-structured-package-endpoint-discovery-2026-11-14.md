# Air Canada Vacations structured package response discovery — 2026-11-14

## Observation

An exact adult-only YHZ–BCN Flight + Hotel query was submitted through Air Canada Vacations’ ordinary widget: Halifax Stanfield Intl. Airport (YHZ), Barcelona city, Apr 15–25 2027, one adult, one room. The browser received a **GET 200 JSON** response from:

`https://vacations-api.aircanada.com/packages-search/search`

The observed response was 88,189 bytes and contained 20 package records. The request parameter names included `orig`, `destId`, `destType`, `dest`, `adults`, `dep-date`, `ret-date`, `cabin`, `lang`, `rooms`, `hotels`, `sort`, `offset`, `limit`, and `applySponsorPlacement`. Parameter values, headers, authorization tokens, package prices, hotel names, identifiers, and response bodies were not logged or saved in this note.

The JSON shape included:

- `results.metaData` and `results.packages`;
- top-level hotel and itinerary dictionaries referenced by each package;
- package fields for hotel, room, selected itinerary, stay information and price breakdown;
- `pricing.grandTotal`, `pricing.total`, and per-passenger fields (`paxCount`, `paxType`, `price`, `taxFees`, `total`);
- hotel name, destination, star category, amenities and location metadata;
- itinerary IDs linked to journey summaries with origin/destination, local dates/times, carrier/flight identifiers, connection counts and duration.

The first package's selected hotel and itinerary references resolved in the response maps. Its provider check-in was Apr 16 while the submitted outbound departure was Apr 15; this is consistent with an overnight flight and shows why hotel stay dates must come from the package response, not be copied from the flight departure date. The observed itinerary entries were journey summaries and did not expose a full offset-aware segment chain. No claim of exact individual flight-segment verification is supported by this capture.

## Access and safety

The structured response was observed after the normal widget submitted its search. No direct unauthenticated package call was attempted. No Authorization value, session token, cookie, complete URL, or private response capture was retained. The operation was read-only; there was no checkout, reservation, or purchase. A challenge would stop the flow without interaction.

The provider's current terms endpoint confirmed the Canadian-currency default for the search session, subject to quote-specific exceptions. Package amounts remain provider estimates; this response does not prove checkout availability, local resort charges, a final all-in total, or that every displayed hotel room can still be booked.

## Implementation decision and remaining checks

The adapter is wired to the ordinary widget's `packages-search/search` response for an exact adult-only query with one 20-record page. It enforces a 2 MB response bound, ties the response to the rendered listing URL and exact airports/dates/adult/room counts, joins package/hotel/itinerary maps, matches hotel `destinationId` to request parameter `dest`, validates the provider's inclusive zero-based `currentEnd`, validates economy (`Y`) in the request and journey data, accepts the observed adult pax marker `A` only with an exact adult count, checks hotel city and stay dates, and reconciles per-adult tax/fee totals with package totals. The durable worker rechecks destination and passenger evidence, references, freshness and query constraints. It does not copy or replay widget credentials. Children, infants and 40-result searches still use the rendered-card path.

Current live end-to-end evidence: one ordinary local website-to-worker query completed in `structured_widget_response` mode with 20/20 provider rows accepted and rendered. The page reported 78 total listings, indicating more results beyond the bounded first page; CAD was displayed. Persisted job duration was 24.955 seconds. This is one observation, not a speed guarantee or checkout quote. Focused normalizer/worker/search tests passed 34/34. An earlier attempt was interrupted by the browser script's incorrect wait timeout and is not counted as a provider rejection.

Before extending this path to children, infants, multiple result pages or multi-room child parties, capture and validate those exact response shapes independently. The ordinary rendered-card path remains for query shapes not validated against structured response. Package journey entries are summaries; complete offset-aware segment chronology is not established. Seller availability, room-level allocation, exact property address/room, mandatory local charges and checkout totals remain unverified. This adapter evidence does not close P6 or `work.md` §17 by itself.
