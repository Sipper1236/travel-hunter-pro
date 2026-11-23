# Regional round-trip and family calendar integration plan

Date: 2026-11-05. Status: execution in progress; live second-source calendar release remains unverified.

## Execution evidence (2026-11-05)

- Shared preflight, eligible-source budgets, Ignav bounded retry/failure isolation and HTTP-attempt accounting are implemented with controlled worker/browser coverage. Exact `unsupported_search` date refusals now continue independently and have separate coverage counters.
- Skyscanner adult/identified non-infant calendar returns and UTC validation are implemented and controlled-tested; live partner access is absent. This does not satisfy its live fallback gate.
- Google manual handoff and native economy/non-infant return operation are implemented. Native dispatch/calendar/worker wiring, bounded selection, exact-flight refresh, a second actual date/stay observation, regional worker checks and a live refresh of four exact saved-flight group quotes have evidence. Under-12/infant live acceptance, seller final-price/eligibility checks, and independent-source calendar release remain open. See [dated Google evidence](google-round-trip-contract-2026-11-05.md).
- Expedia's official two-segment Flight Listings contract is implemented for exact adult and age-specified child round trips, including full-party category-count and cabin checks, and exact-flight-only listing refresh. Flexible child calendars are refused because the partner query does not accept DOBs for date-specific age recalculation. Expedia credentials are absent, so its live integration remains unverified.
- Source-linked carrier advisories now include Qatar Airways alongside the previously listed carriers; the advisory does not prove itinerary, fare, codeshare or seller eligibility. See [carrier age guidance](carrier-age-guidance.md). Other provider access/contract and infant/carrier eligibility gates remain open. See [access audit](integration-access-audit-2026-11-05.md), HANDOFF.md and IMPLEMENTATION-STATUS.md for implementation evidence. The phases below retain the full required scope and acceptance gates.

## Required outcome

A traveler can choose a region at either endpoint, a departure range, and either a return range or minimum/maximum nights, then obtain exact round-trip group quotes from compatible sources. Adults, actual child ages, identified travelers and infant seating must retain their meanings throughout discovery, pricing, refresh and seller handoff. When a source fails, other compatible sources and airport/date combinations continue within the user’s budget. Unsupported providers are explained before submission.

First release target: reliable Ignav plus one independently working round-trip provider for supported adult/child-count parties. Identified families and infants remain an explicit separate acceptance gate; do not describe count-only support as complete family support. Hotels are out of scope per the user’s direction.

## Baseline evidence and constraints at plan creation

- Regional airport resolution and departure/return/night-range enumeration exist. The calendar defaults to 250 provider/date searches, and reports airport omissions. Exact-date checkpoint keys already include return date.
- Ignav supports round trips and the app’s identified/guardian/infant model, but HTTP 424 currently becomes a generic failure. The shared transport does not implement Ignav’s documented code-specific 424 retry. In the reported search, Ignav was effectively the only usable provider.
- Skyscanner’s general adapter already requests and refreshes two-leg returns and accepts child ages. Its calendar path refuses round trips and identified/infant parties. Missing timezone offsets, age changes across dates, and partner access are unresolved integration constraints—not proof that Skyscanner itself cannot search returns.
- Expedia’s partner adapter normalizes one journey, Air Canada NDC supports one adult/one-way, Google’s current operation supports one adult/one-way, Matrix rejects child/identified parties, and Omkar documents one-adult/one-way pricing in the current integration. Remove guards only after implementing and proving the corresponding request/response contract.
- Configuration checks currently happen in provider-specific branches, sometimes after trip/party guards. A provider menu entry is not proof of usable inventory or credentials. Inspect credential presence without printing values; never assume partner entitlements.

## Phase 1 — honest preflight and budget planning

1. Add a single provider capability registry used by the UI, calendar validator, provider dispatcher and worker. Model trip shape, cabin, adult/child counts, exact ages, DOB/guardian/infant support, time evidence, filters, refresh/handoff support and configured access separately.
2. Return structured eligibility decisions for the actual query: eligible, unsupported trip, unsupported party, missing credentials, missing time evidence, or temporarily unavailable. Include a concise reason and required action.
3. Make “All compatible sources” dispatch only providers eligible for the submitted query. Show excluded providers before starting; keep their reasons in final coverage. Do not spend fare budget or create network requests for excluded adapters.
4. Compute date pairs and retained airport pairs before fare work. Budget the actual eligible provider × airport-pair × date-pair fanout, not every directory entry. Separate logical searches, actual HTTP attempts/polls, retries, and any known billing units. If a source cannot express a trustworthy upper bound, disclose it.
5. Show the selected party, compatible provider count and estimated work before submission. Preserve the 250-search cap and explicit airport omissions. Never alter dates, ages or party composition to make a provider eligible.

Acceptance: the reported round-trip family query cannot start as though seven providers will price it; the exact eligible set and reasons are visible, and unsupported adapters receive zero calls.

## Phase 2 — Ignav reliability and regional scan recovery

1. Preserve sanitized structured error code, HTTP status and provider request identifier where safe. Read bounded error bodies; do not log keys, headers, DOBs, traveler identities or raw private responses.
2. Retry only HTTP 424 with `unable_to_complete_request`, as documented, using bounded exponential backoff with jitter (initial proposal: two retries, approximately 1 and 3 seconds), abort propagation and the job deadline. Respect Retry-After, access refusals, billing limits and source cooldowns. Account for each HTTP attempt independently; do not assume every failed HTTP response is free without confirming current billing terms.
3. Do not retry other 4xx errors automatically. Treat `unsupported_search` as unsupported for that exact query; never silently change dates. Classify exhausted 424 as a temporary source failure rather than “no flights.”
4. Change calendar orchestration so a route/date-specific exhausted 424 records that provider/query as failed and continues other eligible providers and later airport/date pairs. Authentication, billing and rate-limit failures should stop or cool down that source across the remaining scan while independent sources continue. Cancellation still ends all work.
5. Retain successful fresh checkpoints; resume does not re-price completed exact queries unnecessarily. Unavailable sources and partial pairs must never be presented as a complete minimum.

Acceptance: deterministic 424→success, repeated 424, non-retryable 4xx, rate refusal, abort during backoff, deadline expiry and restart tests; a failed YHZ→IST pair does not erase or prevent successful eligible alternatives. Then run one small authorized live exact query and a bounded regional query, recording sanitized outcomes and attempt counts.

## Phase 3 — Skyscanner as the second round-trip source

1. Confirm partner access and current create/poll/refresh contract. Reuse the existing native two-leg adapter; never sum unrelated one-way prices into a through return fare.
2. Add a time-evidence layer. Preserve airport-local timestamps, validated airport IANA zones and date-specific UTC conversion, including DST ambiguities/nonexistent times and date-line crossings. Neither OurAirports coordinates nor guessed fixed UTC offsets establish timezone evidence. Select a documented licensed timezone source or approved geographic timezone mapping; reject ambiguous conversions rather than inventing chronology.
3. Validate both directions against the exact query, every segment reference, connecting airports, actual elapsed times and return chronology. Apply exact layover filters only when sufficient time evidence exists. Explain any unsupported filter before sending a request.
4. Resolve child ages for each queried departure/return date from supplied DOBs where the provider contract permits. If only an age-at-original-departure is supplied and a category change is possible, request DOB instead of inventing a birthday. Keep infant seating and identified parties disabled until their provider contract is verified.
5. Admit validated Skyscanner returns to calendar normalization, filtering, checkpointing, refresh and seller handoff. Preserve single itinerary/group amount, currency, provider IDs, incremental polling semantics and freshness. Bound HTTP polls independently from logical calendar queries.

Acceptance: adult and exact-age child round trips through direct search, regional calendar, min/max nights, refresh and handoff; overnight/date-line/DST cases; missing zone/segment/party evidence rejected; controlled browser and real worker tests. A real credentialed regional query must return at least one independently attributable round-trip offer before labeling this a working fallback. Missing partner access blocks the live gate, not independent Phase 1/2 work.

## Phase 4 — expand other adapters by verified contract

| Source | Required investigation and implementation | Release gate |
|---|---|---|
| Expedia partner API | Implemented from the documented Flight Listings contract: two requested legs, one offer linking both direction segment IDs, actual child ages and fare categories, group total, cabin-matched complete flight identities, split-ticket flag, CAD deep link, and refresh by exact-flight requery. Flexible child calendars are blocked without DOBs. | Partner credentials are absent. Still require live adult and child-age round trips, exact refresh, Expedia deeplink handoff and seller checkout verification; no first-journey truncation. |
| Air Canada NDC | Confirm approved schema/version and seller entitlement; add two origin-destination requests, linked priced passenger records, child/infant categories and offer repricing. | Credentialed adult then family return quotes, correct passenger references and exact itinerary; no ticket/order creation. |
| Google Flights integration | Inspect the actual authorized operation’s return and party support. Implement those capabilities only if exposed; otherwise use an explicit manual handoff. | Actual source-supported return group quote with attributable itinerary and amount; no multiplying one-adult prices. |
| ITA Matrix | Implemented economy non-infant family browser search, category-count verification, full CAD group totals, detailed connecting-flight/cabin/layover validation for up to three expanded candidates per search, configurable 90-second response timing, source `youth` mapping, local DOB/guardian validation and observed-flight category checks. Live adapter returned 21 complete offers; the real API/worker regional calendar completed one bounded family query. See [Matrix evidence](ita-matrix-family-round-trip-investigation.md). | Infant seating, category-changing trips, other-cabin family search and seller acceptance remain unsupported/unverified. Price-only observations stay outside exact calendar minima. |
| Expedia via Omkar | Check whether a new documented operation genuinely supports returns and group/child pricing. | Verified new request/response contract and live evidence; otherwise retain its explicit one-adult/one-way limitation. |

Prioritize sources by access that actually exists and ability to price the user’s party; do not spend implementation time treating unconfigured partner APIs as immediate fallbacks. If none can provide the second source with current access, record that exact blocker and investigate an authorized browser-based full-party return workflow with the same normalization gates.

## Phase 5 — identified families and infants across sources

Define per-provider translation from the canonical traveler model, including ages on every flight date, birthdays during travel, lap versus seated infants and named guardian links. A provider’s “adult” fare category does not establish legal guardianship. Keep the party together by default. Any booking partitions require exact traveler assignments, guardian-safe groups and matching actual flights; inventory observed separately is never called simultaneous. Validate marketing/operating-carrier rules and seller acceptance independently of API category acceptance.

Acceptance: supported source-specific infant seating and child/youth eligibility evidence, birthday boundary tests, guardian-safe partition tests and an authorized live exact-party quote. Do not use invented user ages or DOBs; synthetic identities are test fixtures only.

## Verification and rollout

- Unit/contract: capability matrix, exact date/night cross-products, actual party translation, money/currency, complete itinerary, UTC chronology, retry classification, source isolation, checkpoint signatures and budget accounting.
- Integration: real forked worker and API validation; region and automatic-location modes; failures on first/middle/last airport pairs; fresh successful fallback when Ignav fails; 250-query boundary with no overspend; pause/resume/cancel/deadline handling.
- Browser: preflight exclusions, compatible-source budgeting, exact dates/calendar mode menu, fixed/ranged nights, automatic and explicit regions, selecting a result, restoring a job and visible incomplete coverage.
- Live gate: authorized, small, bounded adult and actual-age family return searches; region subset and at least two departure/stay combinations; attributable provider IDs, exact flights/dates/party/CAD, quote timestamps and seller handoffs. Record inaccessible sources as blocked. No purchases or reservations.
- Run `npm test`, `npm run build`, `npm audit`, and the calendar browser scripts. Run both website and worker and verify a submitted job moves out of queued state. Keep local-only operation.
- Release in order: preflight + Ignav resilience, second verified source, then source-by-source party expansion. Keep unsupported combinations visible and unavailable until their own gates pass. Update HANDOFF.md and IMPLEMENTATION-STATUS.md with commands, source access, dated live evidence and remaining gaps.

## Primary sources checked

- [Ignav error codes](https://ignav.com/docs/errors) and [production checklist](https://ignav.com/docs/production-checklist): code-specific 424 retry guidance; other refusal classes must remain distinguishable.
- [Ignav round trips](https://ignav.com/docs/round-trip): native two-direction search and limits on quote/booking interpretation.
- [Skyscanner live query object](https://developers.skyscanner.net/docs/flights-live-prices/query-object) and [live API overview](https://developers.skyscanner.net/docs/flights-live-prices/overview): native return legs and live search flow.
- [Skyscanner FAQ](https://developers.skyscanner.net/docs/faqs): returned airport times are local, requiring additional evidence for cross-zone chronology.
- [Expedia Flight Listings](https://developers.expediagroup.com/xap-apis/api/shopping-apis/flight-listings) and [Flight Listings OpenAPI specification](https://a.travel-assets.com/documentation-hubs/prod/travel-redirect-api/latest/en-US/assets/specs/xap-flight-v3.yaml): two-segment searches, group total and passenger-category schema, child ages, cabin, segment and split-ticket evidence.

Other provider expansion contracts are investigation tasks, not verified capabilities inferred from these sources.
