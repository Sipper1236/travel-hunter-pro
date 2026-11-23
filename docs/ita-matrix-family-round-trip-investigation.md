# ITA Matrix family round-trip investigation

Date: 2026-11-05

## Current implementation

Economy identified-family search is implemented and has prior live evidence through the adapter and a bounded regional API/worker calendar query. As of 2026-11-07, identified infant seating passes the exact category count (lap or own seat) to Matrix after DOB, guardian, seating, and date-category validation. Two live YHZ–YYZ economy round-trip searches for 2026-11-20/27 returned 25 solutions each for one adult plus one lap infant and one adult plus one infant in a seat. The app accepted 21 lap-infant results (first accepted group total CAD 590.03) and all 25 seat-infant results (first accepted group total CAD 1,153.84) after validating route/date/cabin and passenger-count/category/group-total echoes. These are source observations, not seller-confirmed availability or bookings. The totals come from separate result sets and are not a like-for-like comparison of the cost of a seat. Category-changing trips remain unsupported; other-cabin infant-family queries and seller bookability remain outside verified capability.

For identified parties, `lib/travelers.mjs:matrixParty` keeps DOBs and traveler/guardian IDs local, converts each under-two traveler to `infantsInLap` or `infantsInSeat`, and rejects trips where the Matrix passenger category changes on any query or observed itinerary date. The Matrix browser transport's existing passenger-field loop submits those counts in the public form. Matrix result normalization checks passenger count and echoed per-category group pricing before accepting an offer. These two live results confirm that the current private endpoint returned lap/seat infant category and group-total echoes accepted by this adapter for those queries. They do not establish a stable public API contract, support for every route/date/carrier, or the carrier/fare's actual eligibility.

### Identified infant implementation check (2026-11-07)

- Focused Matrix/capability/identity tests passed 38/38; the full `npm test` passed 464/464 (89.6 seconds). `npm run build` passed and `npm audit --audit-level=low` found zero vulnerabilities.
- Rebuilt-site `node scripts/check-matrix-family-ui.mjs` rendered the identified-traveler guidance and verified regular-family and lap-infant capability preflights. It submitted zero provider searches, blocked external browser requests (zero attempted), and reported zero page errors.
- The controlled check itself did not send a Matrix search. The separate live source observation below shows one received and validated infant-party result. UI `eligible` capability means only that the query shape maps to the adapter, not that a particular fare accepts the travelers.

### Live Matrix infant observations (2026-11-07)

- Query A: YHZ–YYZ round trip, 2026-11-20 to 2026-11-27, economy, CAD, one adult plus one lap infant. No traveler IDs or DOBs were sent to Matrix. The first-party flow received 25 solutions; `normalizeMatrix` accepted 21 after route/date/cabin and passenger-count/category/group-total checks. First accepted group total: CAD 590.03. Four solutions were not promoted.
- Query B used the same route/dates/cabin/currency with one adult plus one infant in a seat. Matrix returned 25 solutions and the normalizer accepted all 25 on the same identity and group-total checks. First accepted group total: CAD 1,153.84.
- Totals come from separate result sets; itinerary equivalence was not established between the first results, so their difference must not be described as the cost of an infant seat. No price-only observations were returned. No seller refresh, baggage/fee check, purchase or reservation occurred. These observations do not establish bookability, carrier eligibility, stability across dates/routes, or the unofficial endpoint as a supported API. Do not generalize them to all infant fares.

The shared carrier helper also provides source-linked Qatar Airways child/infant and young-solo guidance. This policy advisory does not verify a Matrix fare; see [carrier age guidance](carrier-age-guidance.md).

## Original finding

ITA Matrix already supports **exact-date round trips for adult-count parties** in this app. The `unsupported_party` result is caused by the child/identified-traveler guard, not by a missing round-trip request path.

- `lib/providers.mjs` passes the return date to Matrix and sends two-direction adult-count requests. It rejects identified travelers and any nonzero `children` count before dispatch.
- `lib/ita-matrix.mjs` builds outbound and inverse return slices and only accepts a result with both matching directions. Its request supports passenger category counts, but its endpoint and response schema are unofficial and reverse-engineered.
- `tests/ita-matrix.test.mjs` covers round-trip request construction, a complete two-leg normalized fixture, and category counts. Those fixtures do not establish live provider behavior or fare eligibility.
- `lib/provider-capabilities.mjs` repeats the child-party refusal. `lib/calendar-query.mjs` exposes Matrix in the calendar source list, while `lib/calendar-search.mjs` refuses Matrix child searches. Thus exact-date adult returns are implemented; broader family round-trip calendar support is not.
- Matrix normalization currently accepts only one flight per direction when validating a complete itinerary. Connecting results may be shown as price-only observations and must not be used as verified calendar minima.

## First-party evidence and its limits

The [official Matrix help page](https://matrix.itasoftware.com/help) exposes Round Trip, outbound and return date controls, and passenger categories for adults, seniors, youths (12–17), children (2–11), infants in a seat, and infants in a lap. This establishes that the Matrix website offers those controls. It does **not** document the private `/v1/search` API, prove that the app's category mapping matches the website, establish age-specific carrier eligibility, or prove that returned totals reflect all submitted passengers.

### Exact senior-age boundary regression (2026-11-08)

The current official Matrix search UI labels its categories Adults (18–61) and Seniors (62+), alongside Youths (12–17), Children (2–11), and infants under two ([Matrix search UI](https://matrix.itasoftware.com/help)). Added a focused regression proving that the app maps age 61 to `adults`, age 62 to `seniors`, and rejects an identified round trip whose traveler turns 62 between the outbound and return dates. `node --test tests/ita-matrix.test.mjs` passed 24/24. This verifies local category mapping only; it does not establish fare eligibility for any airline or seller.

The current app request uses the Matrix web application's private Alkali batch endpoint (`lib/ita-matrix.mjs`). No public developer contract or entitlement for this endpoint has been established. Keep it labeled unofficial and fail closed if the live request/response differs from observed evidence.

### Current endpoint inspection (2026-11-05)

Fetched the first-party `/help` page successfully (HTTP 200) and inspected the JavaScript asset it references: `https://www.gstatic.com/alkali/ca5342ed5a6417d17590f3d7cb32f905a66ba015.js`. In the current client bundle, the route-state parser:

- recognizes `type: "round-trip"` and retains each slice's return date;
- converts passenger counts to numeric `pax` fields named `adults`, `children`, `youth`, `infantsInLap`, `infantsInSeat`, and `seniors`;
- converts `PREMIUM_COACH` cabin state and route/date options into the internal search options object.

This is first-party **client code evidence** for the website's state-to-query mapping, and supports the same category field names used by the adapter. It is still not an API guarantee. The app adapter posts its `specificDatesSlice` body through the Alkali `/v1/search` batch endpoint; no public schema is published.

The user-provided [old Matrix calendar URL](https://oldmatrix.itasoftware.com/calendar?search=eyJ0eXBlIjoicm91bmQtdHJpcCIsInNsaWNlcyI6W3sib3JpZ2luIjpbIllZWiJdLCJkZXN0IjpbIkxBWCJdLCJkYXRlcyI6eyJzZWFyY2hEYXRlVHlwZSI6ImNhbGVuZGFyIiwiZGVwYXJ0dXJlRGF0ZSI6IjIwMjYtMTEtMDYiLCJkZXBhcnR1cmVEYXRlVHlwZSI6ImRlcGFydCIsImRlcGFydHVyZURhdGVNb2RpZmllciI6IjIyIiwiZGVwYXJ0dXJlRGF0ZVByZWZlcnJlZFRpbWVzIjpbXSwiZHVyYXRpb24iOiIxIiwicmV0dXJuRGF0ZVR5cGUiOiJkZXBhcnQiLCJyZXR1cm5EYXRlTW9kaWZpZXIiOiIwIiwicmV0dXJuRGF0ZVByZWZlcnJlZFRpbWVzIjpbXX19XSwib3B0aW9ucyI6eyJjYWJpbiI6IkNPQUNIIiwic3RvcHMiOiItMSIsImV4dHJhU3RvcHMiOiItMSIsImFsbG93QWlycG9ydENoYW5nZXMiOiJ0cnVlIiwic2hvd09ubHlBdmFpbGFibGUiOiJ0cnVlIiwiY3VycmVuY3kiOnsiZGlzcGxheU5hbWUiOiJDYW5hZGlhbiBEb2xsYXIgKENBRCkiLCJjb2RlIjoiQ0FEIn19LCJwYXgiOnsiYWR1bHRzIjoiMSIsInlvdXRoIjoiMSwiY2hpbGRyZW4iOiIxIn19) decodes to a Matrix `round-trip` calendar for **YYZ–LAX**, with `pax: { adults: "1", youth: "1", children: "1" }`, coach cabin, CAD, and `duration: "1"`. The newer [Matrix calendar URL](https://matrix.itasoftware.com/calendar?search=eyJ0eXBlIjoicm91bmQtdHJpcCIsInNsaWNlcyI6W3sib3JpZ2luIjpbIllZWiJdLCJkZXN0IjpbIkxBWCJdLCJkYXRlcyI6eyJzZWFyY2hEYXRlVHlwZSI6ImNhbGVuZGFyIiwiZGVwYXJ0dXJlRGF0ZSI6IjIwMjYtMTEtMTAiLCJkZXBhcnR1cmVEYXRlVHlwZSI6ImRlcGFydCIsImRlcGFydHVyZURhdGVNb2RpZmllciI6IjAiLCJkZXBhcnR1cmVEYXRlUHJlZmVycmVkVGltZXMiOltdLCJkdXJhdGlvbiI6IjUiLCJyZXR1cm5EYXRlVHlwZSI6ImRlcGFydCIsInJldHVybkRhdGVNb2RpZmllciI6IjAiLCJyZXR1cm5EYXRlUHJlZmVycmVkVGltZXMiOltdfX1dLCJvcHRpb25zIjp7ImNhYmluIjoiQ09BQ0giLCJzdG9wcyI6Ii0xIiwiZXh0cmFTdG9wcyI6Ii0xIiwiYWxsb3dBaXJwb3J0Q2hhbmdlcyI6InRydWUiLCJzaG93T25seUF2YWlsYWJsZSI6InRydWUiLCJjdXJyZW5jeSI6eyJkaXNwbGF5TmFtZSI6IkNhbmFkaWFuIERvbGxhciAoQ0FEKSIsImNvZGUiOiJDQUQifX0sInBheCI6eyJhZHVsdHMiOiIxIiwieW91dGgiOiIxIiwiY2hpbGRyZW4iOiIxIn19) encodes the same party for a five-day calendar beginning 2026-11-10, with a zero departure modifier. Both are evidence that Matrix shareable UI state represents adult + youth + child categories on a round-trip calendar; neither URL alone proves fares or age eligibility. These routes are YYZ–LAX, not the earlier YHZ query.

Opened the newer link in headless Chromium and waited 60 seconds. Matrix returned the calendar page shell, but the page continued to show “Choose your departure date” and did not issue a fare-search request. The only Matrix batch request observed was `GET /v1/applications/matrix/userinfo`; its inner response was `401 UNAUTHENTICATED` (outer batch HTTP 200), and the **Update** button remained disabled. No search endpoint request or fare result was observed in this session. The browser request went to `content-alkalicore-pa.googleapis.com`; the app adapter's search batch host is `content-alkalimatrix-pa.googleapis.com`. The userinfo request neither proves nor disproves the adapter's search endpoint contract. The discrepancy with the user's report that fares load after waiting suggests the user's Matrix browser session or access context differs from this headless session; that remains an inference. The old URL's `departureDateModifier: "22"` is retained as opaque state; its exact semantics are unverified.

One live adapter query was attempted for YHZ–IST, 2026-12-18 to 2026-12-28, one adult plus one Matrix `children` category, economy/CAD. The request ended with `ITA Matrix request failed or timed out` (the adapter's request timeout is 45 seconds). It yielded **no response, quote, or validation of the returned total**. No retry was made. This leaves the critical live request/response and family-price semantics unverified; the static client mapping alone is not sufficient to enable children.

## Original investigation and implementation path

1. Capture one bounded, user-authorized search made through Matrix's own UI: an exact-date round trip for one adult and one child aged 2–11. Retain only sanitized request/response fields needed for comparison; do not store cookies, API keys, or passenger identity data.
2. Compare the UI request with `makeMatrixBody` and `buildMatrixUrl`: confirm the category key and count, inverse return slice, dates, cabin, and whether passenger categories are echoed or otherwise verifiably bound to the returned group total. Confirm the response's group-total and both-leg semantics.
3. If that comparison is sound, add a narrowly scoped **count-only child 2–11** capability for exact-date searches. Preserve the submitted Matrix child category and count in query/signature/checkpoint data. Do not claim support for an individually identified child or for exact-age carrier rules without additional provider evidence.
4. Add capability and provider dispatch tests, plus normalization cases for wrong category/count where the source provides such evidence, missing or mismatched return legs, wrong dates/cabin/currency, and connecting flights. Keep unverified itineraries as price observations, never verified offers.
5. For calendar support, allow only child searches whose age category is known to remain valid over every searched date. If the user supplies dates of birth, derive age per flight date only after proving Matrix's category mapping; otherwise reject birthday-boundary ranges. Apply the same rule to the return date.
6. Keep youths (12–17), infants, and identified/guardian-linked parties disabled until their request semantics and age/eligibility behavior have separate evidence. A UI category alone is insufficient to remove those guards.
7. Verify the narrow capability with controlled fixtures, then a small actual-party search through the worker and UI, covering one exact outbound/return pair and a region/date subset. Check returned party total, both flight directions, CAD amount, cabin, search link, and visible incomplete coverage. Do not describe Matrix results as bookable or seller-confirmed.

## Acceptance gates

- The request sent to Matrix matches the observed first-party UI request for trip dates, traveler category/count, cabin, and currency.
- Every accepted return offer contains both complete, query-matching directions and sufficient flight/cabin/party evidence; otherwise it remains a price-only observation.
- The same narrow party is correctly represented in preflight, exact search, calendar dispatch, budget accounting, checkpoints, result labels, and handoff.
- No child age-boundary, teen, infant, identified-family, or seller eligibility support is claimed without separate evidence.
- A controlled actual search succeeds without challenges or bypasses. Rate limits and access blocks remain visible and do not cause unsupported claims of coverage.

## Primary sources

- [ITA Matrix official help / search UI](https://matrix.itasoftware.com/help): visible trip-type/date controls and passenger categories.
- [ITA Matrix current adapter](../lib/ita-matrix.mjs): private endpoint request construction and response normalization.
- [Provider dispatch and current party guard](../lib/providers.mjs).
- [Provider capability preflight](../lib/provider-capabilities.mjs).
- [Calendar query eligibility](../lib/calendar-query.mjs) and [calendar search](../lib/calendar-search.mjs).
- [Matrix controlled tests](../tests/ita-matrix.test.mjs): fixtures and the behaviors they currently cover.


## API Anything and endpoint trace — 2026-11-06

Checked the [API Anything repository](https://github.com/goodnight000/api-anything) and installed 0.2.0 capture workflow. Its capture supports in-app navigation with --soft-from, which is relevant because direct SPA links need not issue data requests. No bundled Matrix operation was found in the installed catalog.

The current Matrix client bundle establishes these details directly:

- Its generated API client calls POST /v1/search (alkalimatrix_pa.search) for fresh searches and POST /v1/summarize for existing session/solution-set summaries.
- The MY request builder constructs summarizers, inputs and summarizerSet. Inputs include pax, slices, cabin, currency, filters, paging and sorting. Calendar requests also carry startDate/endDate and a layover duration range.
- The Tma fresh-search builder adds name, an optional session, and bgProgramResponse generated by the normal browser runtime before calling search. The adapter currently omits this runtime field; static evidence alone does not establish whether the server requires it for every caller. Do not fabricate it or treat it as a reusable credential.
- The first-party pax category is youth (singular). The adapter currently sends its internal youths key unchanged in makeMatrixBody. This is a concrete request-shape mismatch; fixture tests that assert youths do not validate the first-party protocol.
- Summarization requires both session and solutionSet; those cannot be invented from a price observation.

The next implementation should translate internal youths to source youth, preserve all category counts, and use a normal browser-observed successful request/response to validate the search contract before removing party guards. A browser token dependency, if confirmed, requires the first-party browser workflow rather than blind HTTP replay.

API Anything capture cmw50fc4g completed with in-app navigation and a 45-second wait. Inspection of candidate 19 showed GET /v1/currencies, not a fare search; HTTP 200 from this candidate is not evidence of fares. Capture remains private in the API Anything capture store and is not included in repository documentation.

## Successful live family search — 2026-11-06

Submitting the actual Matrix homepage form succeeded where direct calendar navigation did not. The controlled query was YYZ–LAX, 2026-11-10 through 2026-11-15, one adult, one youth and one child. The first-party search returned HTTP 200 with 25 solutions. The first solution's passengerCount is 3 and its pricing categories explicitly echo adults:1, youth:1 and children:1. Both non-stop directions include offsets, flight identities, cabin and category passenger counts.

The displayed UI amount CA$1,250 is NOT the family total: the same solution has ext.price CAD1250.00, while displayTotal and ext.totalPrice are CAD3749.34. The integration must use the full group total and validate echoed pricing-category counts. A normal browser form submission is the proven access route. Private quote response is ignored under .cache/matrix-discovery/family-response.txt; no API keys or browser tokens were copied into documentation. Implementation and end-to-end family dispatch remain outstanding.

## Adapter progress — 2026-11-06

The implemented browser transport now submits the real homepage form and uses first-party request context. The actual `searchMatrix` call for YYZ–LAX, November 10–15, one adult/one youth/one child returned 25 solutions: 21 complete validated offers and four separate incomplete price observations. The first accepted group amount was CAD 3749.34. Family normalization verifies passengerCount, echoed pricing category counts and agreement between displayTotal and ext.totalPrice. Browser setup has a bounded 20-second allowance followed by a 45-second submitted-search response window. Provider dispatch and calendar preflight now use a shared Matrix category translation; infant seating remains explicitly unsupported. Full integration regression and app/worker verification are still outstanding.

## Live regional API/worker verification — 2026-11-06

The local job API accepted a Matrix calendar request for Canada → United States using an explicitly bounded YYZ/LAX airport subset, November 10 departure, five nights, one adult with child/youth ages 8 and 14, economy/nonstop, searchLimit 1. The real forked worker completed it, reporting exactly one started fare request, one checked pair/date, zero failed or omitted selected combinations, and fullyScanned true for that selected scope. The resulting date cell carried ITA Matrix, CAD 3749.34 and “1 adult, 1 youth, 1 child.” This proves one bounded regional worker path; it does not establish exhaustive country coverage or seller bookability.

## Final verification — 2026-11-06

- `npm test`: 387/387 passed. Worker fixture observation budgets were increased to accommodate process startup under concurrent Chromium load; all original price, coverage, identity and request-budget assertions remain.
- `npm run build`: passed.
- Local production server restarted on 127.0.0.1:3000.
- `node scripts/check-matrix-family-ui.mjs`: passed; rendered family entry, client compatibility and actual server preflight all accept the adult/youth/child economy party without an extra provider request.
- The separate live API-to-forked-worker regional search returned the validated CAD 3749.34 family quote within its one-search budget.

The family-search implementation goal is complete for the stated economy non-infant capability. Infant seating, category-changing itineraries, other cabins and seller acceptance retain explicit limitations; the broader integration plan is not marked complete.

## User-requested live retest — 2026-11-06

Retested the running production website by filling its actual form and submitting a YYZ–LAX November 10–15 round trip for one adult and ages 8/14. The real job transitioned queued → running → complete, returned 21 validated itineraries and four separate unverified price observations, and rendered all 25 cards. First validated full-party quote remained CAD 3749.34; all accepted offers retained the correct return date, CAD and adult/youth/child party label. A separate real regional-calendar API/worker retest also completed with the same group quote and exactly one budgeted request. All 32 targeted Matrix/party/capability tests passed again. No implementation changes were needed for this retest.

## Automatic Canada → Europe regional test — 2026-11-06

The running local website API resolved Canada and Europe automatically from its combined airport directories and selected YYZ/YVR → IST/LHR under a four-query budget for November 10–15, one adult and ages 8/14, economy/nonstop. The first run exposed a bug: a Matrix timeout stopped all later pairs. Fixed Matrix browser TimeoutError classification and calendar route-local failure handling, preserving explicit cancellation and source-wide access/rate refusals. The regression verifies that a failed pair leaves coverage incomplete while later searches continue and no partial regional minimum is shown.

Live retest used all four slots: YYZ–IST returned four validated family itineraries; YYZ–LHR returned eleven validated itineraries plus fourteen price observations; YVR–IST returned six unverified price observations and zero complete offers; YVR–LHR timed out. Coverage correctly reported three completed pairs, one failed pair, no unattempted selected pairs and fullyScanned false. A regional minimum was withheld. The bounded selection omitted 459 origin and 595 destination directory airports; this is not exhaustive Canada/Europe coverage. All 55 targeted Matrix/calendar regressions passed. No further fare queries were sent to chase a clean result.

## Repeated regional live test — 2026-11-06

The next user-requested retest first found the foreground-launched local server and older worker had exited. Restarted both as detached persistent processes (server 2071352, worker 2071829), confirmed website HTTP 200 and re-ran the actual regional API job. All four budgeted Canada/Europe pairs were attempted: YYZ–IST and YYZ–LHR timed out; YVR–IST returned six incomplete price observations; YVR–LHR returned five complete family offers plus twenty incomplete observations. The job completed with two successful pairs, two failed pairs, zero unattempted pairs and fullyScanned false. No regional minimum was published. All 55 targeted regressions passed again. This repeated run demonstrates correct failure isolation, but source latency remains unreliable at the configured 45-second response limit. No further retries were made.

## Longer timeout and connection investigation — 2026-11-06

User corrected the requested direction from shorter to longer: Matrix response timeout now defaults to 90000 ms, configurable by TRAVEL_MATRIX_RESPONSE_TIMEOUT_MS within 1000–180000 ms, for browser and direct HTTP paths. Browser setup retains its additional bounded allowance. Added timing fields for setup, submission-to-request, request-to-response, total, configured limit and whether a search was actually emitted; this will distinguish browser dispatch delay from server response delay. Twenty targeted tests pass.

A fresh YVR–IST family summary response contains seven solutions, including a TK outbound and TK/AC inbound via SEA. The summary gives flight labels, stop airports, overall direction timestamps and aggregate cabin lists, but not individual connecting-flight times. Therefore it cannot establish layover chronology. The first-party client separately requests bookingDetails using the viewDetails summarizer when a result row is expanded. A normal UI detail capture is running; no connection times or cabins are inferred from the summary.

## Connecting-flight details implemented — 2026-11-06

Captured the first-party `viewDetails`/`bookingDetails` response by expanding a real YVR–IST result. It contains explicit segment and operating-leg airports, flight numbers/carriers, booking-category cabins, offset-aware timestamps and durations, connection duration, party categories, full group total and itinerary ID. Added a sanitized fixture with synthetic future dates and a strict parser that requires the selected summary and detail ID, party and group total to match; validates each segment/leg, airport continuity, exact flight order, all-category cabin evidence, UTC chronology, elapsed durations and source-reported layovers. Invalid details remain unverified observations.

Native browser searches now expand up to three connecting or mixed-carrier results and disclose requested/received/needed detail coverage. Other incomplete results remain separate; this is bounded search coverage. A live integrated YVR–IST search successfully returned connecting itineraries, including two flights in each direction via FRA. Measured setup was approximately 4.5 s, submission-to-request 0.4 s and Matrix response 19.4 s in that run. This is one timing observation, not a general explanation of earlier timeouts. A previously slow YYZ–IST route is being measured next with the new 90-second response window.

## Live connecting-family worker and latency verification — 2026-11-06

A real API → forked calendar worker search for the bounded YVR/IST region subset, November 10–15, one adult plus ages 8/14, economy, maximum one stop and layovers 60–180 minutes completed one logical query. It returned CAD 10579.11 for the family, with one outbound segment and two inbound segments via SEA; the 115-minute layover passed the actual filter. Three details were requested and received out of seven candidates; three full itineraries passed normalization, three remained price observations and one failed validation. The selected-scope calendar coverage was complete; it is not an exhaustive regional/market minimum.

Observed timings: setup 4.803 s, dispatch 0.395 s, fare response 20.213 s, detail retrieval 1.328 s, total 27.083 s. A separate previously slow YYZ–IST query returned four complete offers with setup 4.433 s, dispatch 0.386 s, fare response 24.938 s and total 29.981 s under the 90-second setting. Matrix response latency dominated both successful measurements; prior 45-second failures lacked this instrumentation, so their exact cause cannot be conclusively attributed. Persistent timing fields now distinguish a request that was never emitted from a slow response. Longer configured waits reduce early refusals but do not make the upstream service faster.

All 58 targeted Matrix, timeout and calendar tests passed, including source summary/detail ID, category/group total, flight order, offset/time chronology, duration, cabin and connection mismatches plus downstream layover/airline/stop/country filter checks. Full regression and final build are in progress.

## Completed release verification — 2026-11-06

- Full regression: 392/392 passed; production build passed.
- Persistent local server PID 2129856 and worker PID 2129857 restarted with the configured 90000 ms response window; website is listening on 127.0.0.1:3000.
- Real browser form submission through the deployed HTTP API progressed queued → running → complete, rendered one filter-matching complete connecting family offer and three separate incomplete observations. The complete quote was CAD 10579.11, with two return segments and the validated 115-minute SEA connection under a 60–180 minute layover filter.
- Measured deployed run: setup 4.221 s, dispatch 0.390 s, Matrix response 49.353 s, detail retrieval 1.268 s, total 55.288 s. The former 45-second response window would have expired before this valid response; the new 90-second setting allowed completion. This directly demonstrates the value of the user's requested longer timeout. It establishes variable upstream response latency in this run, without attributing uninstrumented earlier failures to a specific cause.
- Three first-party details were retrieved and validated out of seven candidates. Remaining incomplete observations are explicitly separate and are not treated as validated itineraries or filter-matching regional minima.

The timeout/latency-investigation/connecting-parser goal is complete, honoring the user's later instruction to lengthen the timeout. Matrix is still unofficial; detailed expansion is bounded and seller availability/eligibility remains unverified.
