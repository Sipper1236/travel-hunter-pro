# Remaining source access and contract audit

Checked 2026-11-05 during execution of `round-trip-integration-plan.md`.

| Source | Current evidence | Consequence / next action |
| --- | --- | --- |
| Ignav | Configured; native family round trips implemented. Documented 424 retry and regional failure isolation implemented. | Needs small authorized current live queries and seller verification; success cannot be inferred from fixtures. |
| Skyscanner | Native and calendar adult/identified non-infant return paths have controlled tests. Server key absent on last credential-presence audit. | Obtain approved partner access before live release gate; infant seating and birthday-crossing semantics still unsupported. |
| Expedia partner API | The official Flight Listings contract documents two-segment round-trip requests, child ages 2–17, adult-fare treatment for 12–17, offer totals, passenger-category counts, cabin and segment references. The adapter now sends both inverse legs and retains only complete linked offers whose group price, passenger-category counts, cabin, flight identities and dates match the query. Exact-flight refresh re-runs the listing and never substitutes another itinerary. Partner key/authorization are absent. | Obtain Expedia-issued credentials and run bounded live adult and child-age exact round trips; broad child calendars stay excluded because the query does not carry DOBs to recalculate ages for each date. Seller checkout remains unverified. |
| Air Canada NDC | Required onboarding credentials absent. | Obtain approved schema/version and seller access; do not claim native family/return inventory from the current one-adult path. |
| Omkar | Current public README still documents `/expedia/flights/one-way`, with no verified family-return operation. Existing key cannot establish undocumented capabilities. | Keep existing restrictions. No undocumented endpoint guessing or multiplied single-adult fare. |
| Expedia public website | Local Chromium read-only navigation to `https://www.expedia.ca/Flights` returned HTTP 429 with title `Bot or Not?` and a human-check prompt. Browser closed; no challenge interaction or search submitted. | Public browser fallback blocked in this session. Do not bypass or repeatedly retry the challenge. |
| Google Flights installed operation | `node_modules/api-anything/sites/google-flights.md` explicitly limits search/top/calendar operations to one-way, one adult, economy; JSON slots have origin/destination/date only. | A new observed operation is required for returns/parties; existing parser cannot be relabeled as a family return source. |
| Google Flights public form | Local Chromium read-only navigation to `https://www.google.com/travel/flights?hl=en-CA&gl=CA&curr=CAD` returned HTTP 200 and a `Round trip` combobox, Economy, and origin/destination comboboxes. No query submitted. | Candidate for a new authorized browser/API-anything operation. Next inspect traveler/date controls and capture an exact full-party return request/response with consent/access gates, then validate total currency, both directions, all segment identities/times, occupancy and seller links. Reachable form is not working inventory. |

## Evidence boundaries

No fare query, passenger identity submission, booking, reservation or paid commitment occurred during this audit. The Expedia challenge identifier and private session data were not retained. In the follow-up implementation, the Expedia one-way-only guard was removed after the official Flight Listings documentation and OpenAPI contract verified two-leg round-trip group semantics; its live gate remains closed pending partner credentials. No other capability guard was relaxed without source evidence. Cached or advertised source prices were not imported into app results.

Primary public references: [Expedia Flight Listings API](https://developers.expediagroup.com/xap-apis/api/shopping-apis/flight-listings), [Expedia API Explorer and OpenAPI spec](https://developers.expediagroup.com/travel-redirect-api/api/resources/api-explorer), [Omkar Expedia scraper README](https://github.com/omkarcloud/expedia-scraper). Google contract evidence is the installed api-anything package's own site definition and maintainer notes; public form evidence is the read-only browser result above. Expedia's documented contract is implemented, but its missing credentials mean the live adapter gate is still open.

## Manual fallback implemented

`app/ManualFlightSearch.js` now offers a local exact-trip checklist from calendar queries, including no-access preflight failures. Its Google link opens the unfilled form; no party data is exported and no quote is returned. This is the plan's explicit manual handoff, not a new automated Google return operation. The checklist records actual supplied ages on both selected dates and canonical guardian/infant seating where identified data is available. Native full-party return request/response discovery remains pending.

## Native Google return observation superseding the form-only audit

The saved actual family query reached a fully selected native return and seller quotes on 2026-11-05; see `google-round-trip-contract-2026-11-05.md`. Complete native group-quote normalization is implemented and passed against the captured response. The production browser operation and dispatch/calendar wiring remain pending, so existing Google automated return exclusions remain accurate. This evidence advances Google beyond a reachable form; it does not establish live support for under-12 children, infants or final seller acceptance.

## Native operation enabled locally

Google native economy/non-infant returns are now wired through the calendar and worker and enabled with `TRAVEL_GOOGLE_ROUND_TRIP=1`. Controlled and actual-party live evidence is in `google-round-trip-contract-2026-11-05.md`. Source coverage is bounded and failures remain explicit. Direct same-flight refresh returned fresh live quotes for the exact observed itinerary and party; seller availability, final price, and acceptance remain open. Older form-only audit statements above are historical evidence, not the current implementation status.

## Expedia round-trip contract implemented

Official Expedia Flight Listings documentation is now reflected in `lib/expedia.mjs`: two inverse request legs, actual child ages, source adult-fare mapping for ages 12–17, full-group offer total, passenger-category counts, cabin-matched complete segments, split-ticket disclosure and an Expedia deep link. Exact-flight refresh repeats the query and filters to the original flight identities. Flexible child calendars are refused because the source accepts ages but no birth dates for date-specific age recalculation. Controlled tests cover dispatch, mismatched return legs, party/cabin mismatch, age-boundary refusal and exact refresh. Partner credentials are absent, so no live Expedia quote is claimed.
