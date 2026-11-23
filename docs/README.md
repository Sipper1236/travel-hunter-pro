# Travel Hunter Pro documentation index

- [Flight worker completion semantics (2026-11-23)](flight-worker-completion-semantics-2026-11-23.md) — blocks completed status when source work or planned regional pairs remain incomplete.

- [Flight worker source-row schema (2026-11-23)](flight-worker-source-row-schema-2026-11-23.md) — provider-row key allowlist and explicit remaining nested-schema gaps.

- [Flight offer booking-claim guard (2026-11-23)](flight-offer-booking-claim-guard-2026-11-23.md) — rejects unsupported completed-booking and seller-verification claims while preserving explicit observation status.

- [Flight worker top-level schema (2026-11-23)](flight-worker-top-level-schema-2026-11-23.md) — rejects unsupported result claims and removes duplicate Skyscanner query metadata; nested schemas remain open.

- [Shared flight-segment chronology guard (2026-11-23)](flight-segment-chronology-2026-11-23.md) — offset-aware intra-flight, connection, and round-trip checks with fixture verification and provider/seller limits.

- [Package worker coverage-mode validation (2026-11-23)](package-worker-coverage-mode-2026-11-23.md) — rejects unknown explicit coverage modes rather than validating them as rendered-card results; one incremental strict-schema fix.

- [Separate-ticket baseline refusal guard (2026-11-23)](comparison-baseline-refusal-stop-2026-11-23.md) — stops after a refused baseline request, preserves only partial observed routes, and reports unsearched airport pairs accurately.
- [ACV current widget entry point and safe-stop behavior (2026-11-23)](acv-current-widget-entrypoint-2026-11-23.md) — current public page has no visible search form; local UI stops safely, with no query or fare, and challenge handling is tested.
- [Hotel worker status schema (2026-11-23)](hotel-worker-status-guard-2026-11-23.md) — known search outcomes, no booking claims, and a cache-test isolation correction.
- [Comparison worker status schema (2026-11-23)](comparison-worker-status-guard-2026-11-23.md) — mode-specific terminal status validation at the durable worker boundary.
- [Package worker status schema (2026-11-23)](package-worker-status-guard-2026-11-23.md) — rejects unverified-currency outputs at the durable worker boundary while preserving explicit normalizer behavior.
- [Hotel worker query envelope (2026-11-23)](hotel-worker-query-envelope-2026-11-23.md) — rejects unexpected hotel query fields and cross-checks resolved city identifiers.
- [Calendar worker submitted-query binding (2026-11-23)](calendar-worker-query-guard-2026-11-23.md) — exact request constraints, airport-resolution evidence, omission disclosure, fixture checks, and live-coverage limits.
- [Comparison worker exact-itinerary validation (2026-11-23)](comparison-roundtrip-worker-guard-2026-11-23.md) — nested round-trip keys, operating-carrier matching, and connected/timestamp-validated party-split segments; fixture-only evidence and live seller limits.
- [GitHub repository release audit (2026-11-23)](github-repository-release-audit-2026-11-23.md) — public repository preparation, dependency update, clean-install verification, UI check results, and remaining release gates.
- [Flight worker exact-query integrity (2026-11-23)](flight-worker-exact-query-guard-2026-11-23.md) — exact party, child-age, identified DOB/guardian/infant-seating, and filter preservation at the flight worker boundary, with fixture-only evidence and remaining schema gaps.
- [Booking.com Demand API bounded pagination (2026-11-23)](booking-demand-bounded-pagination-2026-11-23.md) — strict two-page/60-property ceiling, opaque continuation tokens, per-page evidence, failure retention, fixture tests, and missing partner-credential limits.

- [Reverse-endpoint implementation plan and inventory](reverse-endpoint-implementation.md) — current adapter/API inventory, access and entitlement gates, full adapter contract, and latency/streaming targets.
- [Reservit exact-query hotel response cache (2026-11-23)](reservit-response-cache-2026-11-23.md) — durable exact-query cache for complete fresh official hotel observations, with fixture evidence and live-source limits.
- [ACV structured package response cache (2026-11-23)](acv-structured-response-cache-2026-11-23.md) — exact-query reuse for validated ordinary-widget responses, with explicit partial-coverage and live-access limits.
- [ACV structured package pagination (2026-11-23)](acv-structured-pagination-2026-11-23.md) — bounded 20/40-result widget pages, strict sequential merge/worker validation, live request-shape observations, and the still-missing post-change website-to-worker proof.
- [Skyscanner exact-query cache (2026-11-23)](skyscanner-response-cache-2026-11-23.md) — short durable cache for completed exact CAD results, integrity checks, fixture evidence, and missing partner-credential limits.
- [Expedia Travel Redirect exact-query cache (2026-11-23)](expedia-response-cache-2026-11-23.md) — short credential-scoped cache for complete Expedia partner results; exact seller refresh bypass and unconfigured live access remain explicit.
- [Reverse-endpoint full implementation map](reverse-endpoint-full-implementation-plan.md) — provider-by-provider endpoint map, end-to-end completion contract, fast request path, priorities, and current evidence/open access gates.
- [Google API Anything one-way coverage gap (2026-11-23)](google-api-anything-one-way-gap-2026-11-23.md) — missing segment and response-side currency evidence in the current one-way result projection, with the verification required before enabling it as itinerary inventory.
- [Omkar exact-response cache (2026-11-23)](omkar-exact-response-cache-2026-11-23.md) — exact fresh-offer cache rules, provider-seam regression, full suite/build evidence, and the lack of a live cacheable wrapper result.
- [Google round-trip failure-stage diagnostics (2026-11-23)](google-roundtrip-failure-stage-2026-11-23.md) — allow-listed failure stage, bounded counters, sanitized regression and remaining live diagnosis gap.
- [Ignav live exact-query cache check (2026-11-23)](ignav-live-warm-cache-2026-11-23.md) — one bounded fresh response and same-process warm hit, with original timestamp preservation and the persistent/cross-worker limits.
- [Provider quota exhaustion handling (2026-11-23)](provider-quota-exhaustion-2026-11-23.md) — durable cooldown when a successful response reports the account quota is exhausted, with source-policy regression evidence.
- [Bounded regional airport-pair overlap (2026-11-23)](regional-pair-streaming-2026-11-23.md) — two-pair one-way adult-only fan-out, deterministic coverage, source-stop behavior, and limits.
- [ACV structured package endpoint discovery (2026-11-14)](acv-structured-package-endpoint-discovery-2026-11-14.md) — ordinary-widget response contract plus adult and one-child adapter/worker-validator evidence, observed stay dates, and scope limits; credentials, prices and property names withheld.
- [Reverse-endpoint progressive flight results (2026-11-14)](reverse-endpoint-progressive-results-2026-11-14.md) — bounded provider fan-out, durable progress timestamps, sanitized HTTP/Google RPC latency histograms, decoded response caps, current Google calendar and ACV endpoint feasibility checks, and remaining endpoint/access gates.
- [ACV suggestion RPC response bound (2026-11-14)](acv-suggestion-response-bound-2026-11-14.md) — decoded-body limit and fail-closed JSON handling for the widget's structured location suggestion response, with exact-boundary tests and browser-buffering limitations.

- [Fare calendar live announcement (2026-11-14)](calendar-live-announcement-2026-11-14.md) — progressive result accessibility change, fresh production browser/test/build/audit evidence, and remaining screen-reader/provider coverage limits.

- [Frontend accessibility and implementation audit (2026-11-14)](frontend-accessibility-audit-2026-11-14.md) — current production-build Chromium checks, measurable results, audit scores, false-positive note, and remaining device/assistive-technology limits.

- [Authenticated encrypted local backups (2026-11-14)](encrypted-job-backups-2026-11-14.md) — AES-256-GCM CLI workflow, permissions, tamper tests and limits.

- [Air Canada Vacations live package refresh (2026-11-14 17:19 UTC)](acv-live-package-refresh-2026-11-14-1719.md) — current website-to-worker child-inclusive package observations, with checkout and coverage limits.

- [CAA, Costco and Visa public-offer recheck (2026-11-14 17:43 UTC)](member-offer-current-check-2026-11-14-1743.md) — official public benefits and terms, current Costco listing, and why no discount or traveler eligibility is inferred.

- [Local recovery and stack verification (2026-11-14)](local-recovery-stack-verification-2026-11-14.md) — isolated backup/restore and temporary-stack checks, with production-operations limits.

- [Flight worker source-evidence integrity (2026-11-14)](flight-worker-source-evidence-2026-11-14.md) — exact provider and route-level evidence requirements, regressions, verification, and remaining coverage limits.

- [Comparison worker result validation (2026-11-14)](comparison-worker-result-validation-2026-11-14.md) — checks persisted ticket totals, freshness, exact segment blocks, request budgets, and guardian-safe traveler assignment; records live-inventory and seller limits.

- [Flight worker result validation (2026-11-14)](flight-worker-result-validation-2026-11-14.md) — pre-persistence route/query/party and offer checks, checked regional coverage and Matrix price-only semantics; records what this guard does not prove.

- [Calendar worker result validation (2026-11-14)](calendar-worker-result-validation-2026-11-14.md) — pre-persistence exact date-grid, offer/price, freshness, route, and coverage checks; records remaining worker-schema gaps.

- [Calendar airport-candidate limit validation (2026-11-14)](calendar-airport-candidate-limit-2026-11-14.md) — server-side enforcement, red/green regression, API rejection, and rebuilt-browser verification.

- [ITA Matrix detailed-itinerary expansion (2026-11-14)](matrix-detailed-expansion-live-2026-11-14.md) — bounded live adapter and website-to-worker evidence, validation behavior, test/build/audit results, and seller/coverage limits.

- [Bounded live round-trip ticket comparison (2026-11-14)](separate-ticket-roundtrip-live-check-2026-11-14.md) — current exact-block quote counts, one searched alternate airport pair, request budget, freshness and seller/inventory limits.

- [Official hotel-engine access recheck (2026-11-14)](official-hotel-access-recheck-2026-11-14.md) — current Mews/Cloudbeds authorization and rate-limit gates, actual local hotel credential state, and why P10 cannot yet be extended safely.

- [Member-offer source recheck (2026-11-14 00:23–00:25 UTC)](member-offers-recheck-2026-11-14-0025.md) — paced CAA and Visa pages/terms were observed; Costco current deals remained blocked with its next retry time; no membership eligibility or discount was inferred.

- [Current audit checkpoint (2026-11-14 00:15–00:21 UTC)](current-audit-checkpoint-2026-11-14-0020.md) — current full suite/build/audit, regional coverage browser check, same-origin health, and explicitly limited live-source scope.

- [Same-flight party comparison no-plan wording (2026-11-13 23:50 UTC)](party-comparison-no-plan-disclosure-2026-11-13.md) — red/green production-browser check that distinguishes an unpriced split result from an inventory conclusion.
- [Air Canada Vacations live package check (2026-11-14 00:05–00:07 UTC)](acv-live-package-check-2026-11-14.md) — refreshed real website/worker result for a supplied one-adult/age-7-child YHZ–Barcelona party, plus the Playwright response-body race and check-script correction.
- [Progressive calendar verification refresh (2026-11-13 23:56 UTC)](calendar-all-offers-streaming-2026-11-13.md#verification-refresh--2026-11-13-2356-utc) — current-tree calendar suite/browser recheck, same-origin worker health, and explicit fixture-only scope.
- [Visa Infinite / Booking.com public terms audit (2026-11-13 23:45 UTC)](visa-booking-travel-credit-terms-2026-11-13.md) — official Canadian Visa pages, general terms, accessible Booking.com destination, and promotion-specific conditions that remain unavailable.
- [Booking.com Demand conditional-charge disclosure (2026-11-13)](booking-demand-conditional-charge-disclosure-2026-11-13.md) — distinguishes priced, explicitly empty, and missing/incalculable conditional fees; preserves observed charge IDs, modes, condition IDs, and online-collection flags; includes official API references and current controlled verification.

- [ACV adult multi-room allocation disclosure (2026-11-13)](acv-adult-multiroom-allocation-disclosure-2026-11-13.md) — aggregate adult/room URL validation, explicit unknown per-room assignment, controlled tests, and remaining live package gaps.

- [P13 initial-page touch-target audit (2026-11-13 23:01 UTC)](p13-touch-target-audit-2026-11-13.md) — 80 initial-page target measurements at 320/1280px, checkbox/radio label handling, and dynamic/device limitations.

- [P13 text-spacing reflow (2026-11-13 22:54 UTC)](p13-text-spacing-reflow-2026-11-13.md) — reproduced and fixed summary-pill overflow under enlarged text/spacing; records production browser, test/build/audit evidence and the true-zoom limitation.

- [Current-tree verification (2026-11-13 22:46 UTC)](current-tree-verification-2026-11-13-2246.md) — full test/build/audit results, production-browser hotel checks with provider traffic intercepted, loopback health, and remaining P1/P2/P3/P4/P10 limits.

- [Regional pair-coverage bounds (2026-11-13 22:34 UTC)](region-pair-coverage-bounds-2026-11-13.md) — exact omitted-pair accounting across all resolver-returned airport codes, bounded large-set representation, regression/build/audit/browser evidence, and source-cap limits.

- [Calendar full airport-omission reporting (2026-11-13 22:27 UTC)](calendar-full-airport-omissions-2026-11-13.md) — completed results include all resolver-returned omitted codes; progress remains a labeled bounded sample, with regression/build/audit/browser evidence and upstream coverage limits.

- [All-region resolver recheck (2026-11-13 22:16 UTC)](region-resolver-recheck-2026-11-13-2216.md) — all 28 named regions resolved from cached directory snapshots, with returned/omitted candidate counts and Europe’s coordinate/popularity exclusions; no fare searches.

- [Count-based child Flight + Hotel UI (2026-11-13)](flight-hotel-count-based-child-ui-2026-11-13.md) — fixes the hidden add-hotel action for validated count-based child parties and records controlled multi-room browser evidence plus the remaining live-inventory gaps.
- [Flight-provider capability snapshot (2026-11-13)](provider-capability-snapshot-2026-11-13.md) — current loopback capability states for one exact query shape, without exposing credentials or implying inventory.
- [Air Canada Vacations party-form recheck (2026-11-13)](acv-party-ui-recheck-2026-11-13.md) — controlled child/infant form and DOB privacy behavior, with multi-room supplier limitation and live-inventory caveats.
- [Ignav seller-page recheck (2026-11-13 22:10 UTC)](ignav-live-p7-seller-recheck-2026-11-13-2210.md) — fresh CAD observation and matched handoff followed by a single normal GET that met an HTTP 403 gate; no challenge interaction or workaround.

- [Current audit continuation (2026-11-13 21:21 UTC)](current-audit-2026-11-13-2121.md) — current Expedia duration code/test re-audit and the absence of a fresh local quote required for a read-only seller handoff.
- [Fresh Ignav seller-handoff response (2026-11-13 21:28 UTC)](ignav-live-p7-handoff-2026-11-13-2128.md) — real website-to-worker CAD observation, owner-bound matched itinerary handoff, provider-price evidence, and explicit availability/baggage/mandatory-charge gaps.
- [United policy access recheck (2026-11-13 21:35 UTC)](united-policy-access-recheck-2026-11-13.md) — official customer pages still expose a JavaScript shell; a normal browser read failed before content, with no challenge workaround or rule inference.

- [Skyscanner timezone and duration integrity (2026-11-13)](skyscanner-timezone-integrity-2026-11-13.md) — mandatory server-side timezone evidence for ordinary search/refresh, elapsed UTC duration validation including layovers, regression/build/audit/controlled-browser evidence, and live-source limitations.
- [Air Canada Vacations live package check (2026-11-13)](acv-live-package-check-2026-11-13.md) — refreshed real website-to-worker child-package search, verified provider location/airport choices, exact submitted settings, visible CAD observations and remaining package/checkout limits.

**Reconciled:** 2026-11-14. The completion goal is active; see the root [`goal.md`](../goal.md) and detailed [`handoff.md`](../handoff.md). Current implementation evidence is maintained in the root [`HANDOFF.md`](../HANDOFF.md) and [`IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md); requirements and acceptance evidence are in [`work.md`](../work.md). This index identifies the purpose and scope of the supporting notes. Dated research documents retain their original observation dates and should not be read as current provider availability.

- [Flight-offer segment evidence gate (2026-11-13)](strict-flight-offer-validation-2026-11-13.md) — rejects complete flight fares that lack provider identity or exact segment evidence; documents the separate Matrix price-only path and links the later Skyscanner timezone/duration continuation.

- [YYZ–FRA round-trip split-ticket live check (2026-11-13)](separate-ticket-roundtrip-live-check-2026-11-13.md) — bounded exact-flight round-trip refresh, provider outcomes, request budget, unpriced ticket blocks and the per-block diagnostics added afterward.
- [Ignav live seller-handoff prerequisite attempt (2026-11-13)](ignav-live-p7-availability-attempt-2026-11-13.md) — current bounded search returned a temporary provider failure before a seller handoff; no retry or availability claim.
- [Flight + Hotel party and room-coverage checks (2026-11-13)](hotel-flight-party-reset-2026-11-13.md) — selected-flight occupancy guard (including exact DOB-derived check-in age validation and stale child-age clearing), flight-switch stale-result regression, provider failure versus inventory status, explicit not-searched rooms, and remaining availability/fees limits.

## Current implementation guidance

- [P13 UI quality smoke checks (2026-11-13)](ui-quality-smoke-checks-2026-11-13.md) — current accessibility structure, keyboard disclosure, responsive/theme checks, search-settings preservation, and the corrected dev-versus-production CSP browser check. Full WCAG/device coverage remains open.
- [Progressive all-offer calendar updates (2026-11-13)](calendar-all-offers-streaming-2026-11-13.md) — every validated fresh fare observation is rendered per date during the running search, with separate provider-response and completed route/date progress, controlled browser/test evidence and provider/seller coverage limits.

- [Google Flights handoff page observation, 2026-11-12](google-handoff-live-2026-11-12.md) — a bounded public GET of the price-only Google observation; route/date/amount marker appeared, but currency, exact flights and seller availability were not verified.

- [Dependency audit follow-up, 2026-11-12](dependency-audit-2026-11-12.md) — patched transitive Hono server dependency and post-update full verification.

- [Air Canada Vacations live child-package check, 2026-11-12](acv-live-package-check-2026-11-12.md) — bounded real website-to-worker search; 19 supported estimates from 20 inspected cards, with result and verification limits.

- [Local-stack smoke-check isolation (2026-11-12)](local-stack-smoke-check-2026-11-12.md) — Next.js `.next` collision, isolated temporary output directory, and local recovery evidence.
- [Progressive fare-calendar results (2026-11-12)](calendar-progressive-results-2026-11-12.md) — live provisional date results, durable-job progress transport, browser verification and open live-inventory limits.
- [Mews official-hotel access check (2026-11-12)](mews-official-hotel-access-2026-11-12.md) — vendor authorization, polling limits, and the exact gate before a second engine can represent inventory.
- [Cloudbeds official-hotel access check (2026-11-12)](cloudbeds-official-hotel-access-2026-11-12.md) — documented guest links versus property-authorized inventory APIs, exact occupancy limits, and current access gate.
- [Named-region airport resolver check (2026-11-12)](region-airport-coverage-2026-11-12.md) — all 28 `work.md` region policies through the current two-directory resolver, cached snapshot ages, airport caps, exclusions, and explicit no-fare-search limits.
- [Live regional fare-calendar audit (2026-11-09, continued 2026-11-12)](calendar-region-live-audit-2026-11-09.md) — bounded one-pair samples for all 28 regions, provider failures, prices as dated observations, and unsearched airports/source/checkout limits.
- [Live same-flight separate-ticket comparison (2026-11-12)](separate-ticket-live-check-2026-11-12-2020.md) — fresh YHZ–LAX exact-flight through observation against two contiguous segment observations, request counts, and seller/inventory limitations.
- [YYZ–Europe multi-airport live calendar and polling contention fix (2026-11-13)](calendar-multi-airport-live-2026-11-13.md) — four selected airport pairs, all-source request accounting, bounded coverage, one price-only Matrix observation, and the SQLite status-poll write reduction.
- [Ignav live seller-handoff match (2026-11-12 20:22 -04)](ignav-live-handoff-2026-11-12-2022.md) — fresh YHZ–LAX exact itinerary match, provider-reported seller prices, and unverified availability/baggage/charges.
- [Bounded Europe route discovery and split-ticket comparison (2026-11-13 00:30 UTC)](separate-ticket-europe-live-2026-11-13-0030.md) — four live alternate airport-pair responses, request/coverage accounting, a higher-priced split plan, and incomplete provider coverage.
- [Live regional fare-calendar audit (2026-11-09, continued 2026-11-12)](calendar-region-live-audit-2026-11-09.md) — bounded one-pair samples for all 28 regions, provider failures, prices as dated observations, and unsearched airports/source/checkout limits.

- Root status sources: [`handoff.md`](../handoff.md) (continuation guide), [`goal.md`](../goal.md) (active objective), [`IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md) (priority/§17 evidence), and [`HANDOFF.md`](../HANDOFF.md) (dated chronological log). Historical research notes below retain their original observation dates.

- [Carrier age guidance](carrier-age-guidance.md) — advisory rules, source links, known policy conflicts, and eligibility limits for supported carriers. Mixed itineraries disclose missing/malformed segment identities, recognized segment names resolve when codes are absent, and each carrier role is mapped to its outbound/return segment(s) (2026-11-13). TAP (`TP`) source-linked guidance was added on 2026-11-13; KLM and Emirates family/solo-child rules, including Canadian source/transfer limits, were added on 2026-11-08; United policy pages were rechecked on 2026-11-12 but remain inaccessible as machine-readable official content, so UA eligibility remains unverified.
- [United policy access recheck (2026-11-12)](united-policy-access-recheck-2026-11-12.md) — first-party customer pages still expose only a JavaScript shell; the accessible booking page only links to those pages. United Vacations and partner pages were excluded as evidence for airline rules.
- [United policy access recheck (2026-11-08)](united-policy-access-recheck-2026-11-08.md) — earlier access probe and limitation.
- [Geographic conventions audit](geographic-conventions-audit.md) — current region and country conventions, source policy, and coverage limitations.
- [Member offer checks](member-offer-checks.md) — selectable CAA club pages, BCAA/AMA fetch limitations, Costco membership terms and a separate live dated-deal listing, Visa promotion evidence, and the CAA National API credential blocker.
- Current loopback UI checks: `npm run check:accessible-controls`, `npm run check:responsive-ui`, and `npm run check:theme-contrast` cover structure/keyboard disclosure, selected responsive widths, and computed text contrast. These are smoke checks, not full WCAG or device certification.
- [Hotel multi-room live check](hotel-multiroom-live-check-2026-11-08.md) — bounded Montréal child/two-room observation, an unavailable Booking.com room, and its error-reporting fix.
- [Reservit official integration documentation](https://help.reservit.com/EN/presentation-of-our-tools-for-web-agencies) — current booking-link guest-count limitation, Best Price age input, regional tax wording, and fee/cancellation caveats.
- [Booking.com Demand API multi-room subtotal](flight-hotel-demand-multiroom-2026-11-08.md) — exact child/room-product checks, Flight + Hotel display semantics, fixture-backed loopback evidence, and missing partner-credential blocker.
- [Expedia seller handoff check](expedia-seller-handoff-check-2026-11-08.md) — user-supplied YHZ–LAX round-trip handoff, current provider capability, and HTTP 429 blocker.
- [Expedia-via-Omkar live duration probe](omkar-expedia-live-duration-2026-11-09.md) — bounded YHZ–LAX one-way attempt returned HTTP 500 before timestamp/fare evidence; direct Expedia credentials remain unconfigured.
- [Ignav live YHZ–LAX observation](ignav-live-yhz-lax-2026-11-08.md) — historical and fresh exact one-adult queries, matched handoff observations, and the guarded Air Canada link probe; availability, baggage, mandatory-charge and seller timestamp gaps remain open. The live refresh helper is opt-in, selects only a fresh stored exact one-adult/economy query, and accepts `TRAVEL_SELLER_ORIGIN`, `TRAVEL_SELLER_DESTINATION`, `TRAVEL_SELLER_DATE`, `TRAVEL_SELLER_TRIP_TYPE`, and (for returns) `TRAVEL_SELLER_RETURN_DATE`. Its default remains the historical Nov 12–19 round trip. No handoff is sent when no matching fresh offer exists.
- [Separate-ticket live comparison, 2026-11-09 01:02 UTC](separate-ticket-live-check-2026-11-09-0102.md) — bounded YHZ–LAX round trip, exact YUL/YYZ alternative-pair responses, zero complete split plans, and the attempted/stopped/unsearched coverage correction.
- [Ignav timezone validation](ignav-timezone-validation-2026-11-08.md) — local/UTC consistency finding, red/green regression, exact checks, and the limit that airport-zone identity remains provider-declared.
- [Air Canada Vacations live package check, 2026-11-08](acv-live-package-check-2026-11-08-1807.md) — bounded YHZ–Barcelona website/worker observation and explicit quote limits.

## Dated investigations and verification records

- [Seller-link price freshness scope (2026-11-14)](seller-link-price-freshness-2026-11-14.md) — distinguishes handoff-response age from unobserved per-link seller price timestamps.
- [Hotel/package result-envelope validation (2026-11-14)](hotel-result-query-envelope-2026-11-14.md) — empty hotel results must preserve submitted stay constraints; final worker-boundary tests/build/audit and controlled UI checks.
- [Vacation-package worker result validation (2026-11-14)](package-worker-result-validation-2026-11-14.md) — ACV query, party, CAD, freshness, destination and bounded coverage checks before persistence.
- [Hotel worker result validation (2026-11-14)](hotel-worker-result-validation-2026-11-14.md) — occupancy, stay dates, property and room-total checks before persistence.
- [Air Canada Vacations browser discovery](air-canada-vacations-probe.md) — widget location selection and package-search observations.
- [Airport source alternatives](airport-source-alternatives.md) — candidate airport data sources and access assessment.
- [Europe region diagnosis](europe-region-diagnosis-2026-10-31.md) — Europe resolver issue, bounded airport selection, and associated evidence.
- [Geographic label options](geographic-label-options-2026-11-07.md) — research on provisional region/country labels.
- [Google round-trip contract observation](google-round-trip-contract-2026-11-05.md) — observed native round-trip capability and its constraints.
- [Integration access audit](integration-access-audit-2026-11-05.md) — provider/source access and entitlement blockers.
- [ITA Matrix family round-trip investigation](ita-matrix-family-round-trip-investigation.md) — family-party and round-trip Matrix constraints.
- [Regional round-trip integration plan](round-trip-integration-plan.md) — planned and verified steps for regional round trips and family calendars.

## Integration references

- [`../work.md`](../work.md) §17 is the acceptance authority. Fixtures and UI smoke checks do not substitute for live supplier/seller evidence.

- [`ITA_MATRIX_INTEGRATION.md`](../ITA_MATRIX_INTEGRATION.md) — Matrix adapter architecture, acceptance criteria, and reverse-engineering caveats.
- [Google Flights calendar endpoint research](google-flights-calendar-endpoint-research-2026-11-10.md) — captured `GetCalendarPicker` RPC candidate, evidence, limits, and live recheck status.
- [`integration.md`](../integration.md) — historical Expedia/Omkar/Selenium proposal, explicitly qualified by current implementation status.

## Evidence discipline

Fixture-backed tests demonstrate code behavior only. They do not establish current inventory, seller acceptance, exact taxes/fees, eligibility, bookability, or successful checkout. For current status and reproducible commands, use the dated top entries in `HANDOFF.md` and `IMPLEMENTATION-STATUS.md`; keep open items from `work.md` explicitly unresolved until real source evidence exists.

- [Bounded live separate-ticket comparison (2026-11-08 23:38 UTC)](separate-ticket-live-check-2026-11-08-2338.md) — one exact YHZ–LAX round trip, five logical fare searches, two higher-priced exact-flight ticket plans; no alternate airport pairs or seller verification.

## Latest implementation evidence

- [2026-11-14 ACV page-expansion request bound](acv-result-page-budget-2026-11-14.md) — limits expansion to one extra page for a 40-card request; current tests/build/audit and controlled UI checks are recorded. No live package query was made.

- [2026-11-14 P4 source-count consistency](hotel-worker-source-occupancy-2026-11-14.md#source-count-consistency--2026-11-14-1624-utc) — accepted hotel offers are bounded by source-reported candidate/listing counts; test/build/audit and controlled UI evidence are recorded, with no live inventory claim.

- [2026-11-14 P4 accepted-source coverage guard](hotel-worker-source-occupancy-2026-11-14.md#accepted-source-coverage-guard--2026-11-14-1618-utc) — priced results require positive accepted evidence from the matching provider, including every separately quoted browser room.

- [2026-11-14 hotel worker source and occupancy validation](hotel-worker-source-occupancy-2026-11-14.md) — source identity, exact room/age evidence and fresh same-property room sums; local fixture and browser evidence only. P4 remains Partial.
- [2026-11-14 P4 hotel coverage follow-up](hotel-worker-source-occupancy-2026-11-14.md#single-room-source-coverage-follow-up) — reports visible first-page scope and rejects empty worker results without source-status/discovery coverage.
- The [P4 hotel evidence](hotel-worker-source-occupancy-2026-11-14.md) now also documents bounded empty-result discovery validation and visible per-source observation counts.
- The same [P4 evidence note](hotel-worker-source-occupancy-2026-11-14.md#priced-offer-provider-status-integrity--2026-11-14-1612-utc) now records that priced hotel offers require a matching observed provider status row; current tests/build/audit and controlled localhost UI checks passed, while live supplier/seller evidence remains open.
