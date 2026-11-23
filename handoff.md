# Travel Hunter Pro — Detailed Handoff (updated 2026-11-23)

## 2026-11-23 continuation — flight provider-row field allowlist

Flight worker provider status rows now reject unknown keys, including an injected `sellerVerified` claim. Current source and regional route metadata remain allowed. Focused tests passed 99/99; full suite 739/739; isolated build, audit, and controlled browser check passed. This does not yet validate the contents of nested timing/diagnostic objects, enumerate source states for empty results, or complete schemas for observations/coverage/other workers. [Evidence](docs/flight-worker-source-row-schema-2026-11-23.md).

## 2026-11-23 continuation — flight offer booking claims

The shared flight-offer validator blocks unsupported completion fields (`booked`, `reserved`, `ticketed`) and seller-verification flags, plus affirmative completed-booking status text. A stated “not booked” observation remains valid. Red regressions reproduced the false acceptance; focused tests passed 13/13 and full suite 739/739; isolated build, audit, and controlled local browser checks passed. No seller request or booking was made. This is an honesty guard, not proof of current availability, ticket issuance, or checkout price. [Evidence](docs/flight-offer-booking-claim-guard-2026-11-23.md).

## 2026-11-23 continuation — flight worker top-level schema

The durable flight worker now rejects unrecognized result-level properties, so fabricated booking or seller-verification claims cannot ride along with valid flight offers. Source and location metadata used by current adapters remain allowed. Skyscanner partial results now keep filters only in the exact validated query instead of duplicating them at top level. Focused flight/Skyscanner suites passed 31/31, full `npm test` passed 738/738, isolated build passed, and audit found zero vulnerabilities. This is not field-by-field validation of nested offers, statuses, and coverage, and does not close §17. [Evidence](docs/flight-worker-top-level-schema-2026-11-23.md).

## 2026-11-23 continuation — shared flight chronology

The shared offer validator now checks offset-aware timestamp consistency and elapsed chronology across each flight's segments, connecting legs, and round-trip directions. It rejects malformed and unknown offsets, contradictory local/UTC fields, missing offset-aware times in a multi-segment itinerary, and impossible transfer order. One-segment legacy local-time records remain accepted. Focused cross-provider tests passed 100/100; the full suite passed 737/737; isolated Next.js build passed; audit found no vulnerabilities. Same-origin health is `ok` with one live worker, no queue, and no expired leases/deadlines. No provider request or booking occurred. This partial P0 fix does not establish source timezone authority, live prices, carrier eligibility, or seller availability. [Evidence](docs/flight-segment-chronology-2026-11-23.md).

## 2026-11-23 continuation — package worker coverage mode

A test-first regression reproduced that an explicit unknown package `coverage.mode` was accepted as if it were the browser-rendered path. The durable validator now distinguishes the supported structured widget mode from the existing omitted-mode rendered-card result and rejects other values. Package worker plus vacation-search suites passed 33/33; full `npm test` passed 735/735; isolated production build passed; audit found 0 vulnerabilities; and Markdown links passed for 143 files. The local website and worker remained healthy. This closes one schema-discriminator gap; the broader strict worker schema and §17 remain open. No provider query. [Evidence](docs/package-worker-coverage-mode-2026-11-23.md).

## 2026-11-23 continuation — separate-ticket baseline refusal

The initial exact-itinerary refresh now honors rate-limit and access-stop statuses. Before the fix, a valid baseline plus `rate_limited` could still trigger another fare request. The optimizer now stops after that one request, returns `source_unavailable`, preserves only fresh alternatives from the same partial response, and lists unsearched airport pairs. Route-coverage wording no longer says all pairs responded unless all were actually searched. Focused comparison/search/worker tests passed 61/61; full suite passed 734/734; isolated production build passed; `npm audit --audit-level=low` found zero vulnerabilities; the browser check passed with provider/job calls intercepted, external requests blocked and zero errors. No live request or booking occurred. Seller availability, simultaneous inventory, ticket issuance, baggage, fees, and all-in totals remain open. [Evidence](docs/comparison-baseline-refusal-stop-2026-11-23.md).

## 2026-11-23 continuation — ACV current widget entry point

The website's ACV origin lookup previously returned HTTP 400 with a raw locator timeout because the expected provider field never appeared. The public Flight & Hotel page now renders promotions and no visible search inputs; the canonical no-trailing-slash route behaves the same, and the site's Book navigation leads through an options page back to that promotion route. A paced read-only inspection saw no explicit CAPTCHA/human challenge. The local website now returns HTTP 503 `temporarily_unavailable` with a safe message and sends no location/package query. Challenge detection blocks and cools down ACV for five minutes without interacting with the challenge. Focused ACV tests pass 35/35; full suite passes 731/731, isolated build passes, audit finds 0 vulnerabilities, and 141 Markdown files pass link checks. No current package fare was obtained; P6/§17 remain open. [Evidence](docs/acv-current-widget-entrypoint-2026-11-23.md).

## 2026-11-23 continuation — hotel worker status schema

Hotel worker validation now rejects fabricated statuses such as `booked`; any status on priced results must be `complete` or `partial`. Focused hotel/Booking.com/Reservit/Flight + Hotel suites passed 71/71; full `npm test` passed 726/726, build passed, audit found 0 vulnerabilities, and Markdown links passed for 140 files. Fixed a test isolation issue by constructing the cache store with `{path: db}`. No live source request. [Evidence](docs/hotel-worker-status-guard-2026-11-23.md).

## 2026-11-23 continuation — comparison worker status schema

Comparison worker validation now rejects invented terminal states. Segment mode requires a status emitted by the producer or wrapper; party mode allows no status or the wrapper's `budget_exhausted`. Regressions reproduced acceptance of `booked` and a missing segment result status. Focused suites passed 62/62; full `npm test` passed 725/725, build passed, audit found 0 vulnerabilities, and Markdown links passed for 139 files. No source request. [Evidence](docs/comparison-worker-status-guard-2026-11-23.md).

## 2026-11-23 continuation — package worker status schema

Package worker validation now accepts only `observed` result envelopes. The test-first regression showed that a minimal `currency_unverified` envelope had been accepted without observed coverage or provider evidence. The lower-level normalizer still preserves its explicit unverified-currency result; the durable worker now rejects it. Focused tests passed 25/25; full `npm test` passed 725/725, build passed, audit found 0 vulnerabilities, and Markdown links passed for 138 files. No provider request was made. [Evidence](docs/package-worker-status-guard-2026-11-23.md).

## 2026-11-23 continuation — hotel worker query envelope

The durable hotel worker guard now rejects query fields outside the submitted schema and known destination-resolution metadata; resolved `cityId` must match the destination evidence. A test-first regression reproduced the previous acceptance of an injected field. Focused tests passed 14/14; full `npm test` passed 725/725, build passed, audit found 0 vulnerabilities, and Markdown links passed for 137 files. This remains fixture-only. Full source-specific hotel schemas, live availability, fees and checkout totals are open. [Evidence](docs/hotel-worker-query-envelope-2026-11-23.md).

## 2026-11-23 continuation — calendar worker submitted-query binding

Fixed a worker boundary that validated calendars only against the query echoed by the result. The runner now supplies the original job input; the validator preserves requested filters, party, dates, stay settings, source, airport limit, budget, Matrix options and known terminal statuses. Selected airport pairs must come from submitted candidates; resolved city/region airports require matching location evidence, and removed candidates need omission coverage. Focused suites passed 68/68, full suite 724/724, build passed, audit found 0 vulnerabilities and Markdown links passed for 136 files. No live source call. Regional source coverage, price freshness beyond existing checks, seller availability and checkout remain open. [Evidence](docs/calendar-worker-query-guard-2026-11-23.md).

## 2026-11-23 continuation — comparison exact-itinerary result guard

Corrected round-trip split-ticket parsing and added exact-itinerary validation for party-split plans. Results now require connected segments, requested route/date, airport-local/UTC agreement, outbound/return chronology, matching inbound summary fields and a rebuilt nine-field itinerary key. Regressions cover placeholder flights, unknown signature fields, changed marketing/operating carriers, wrong airport times and changed/impossible return flights. Focused suites passed 10/10; full suite passed 721/721; build passed; audit found 0 vulnerabilities. No live query. Seller availability, simultaneous inventory, carrier eligibility, baggage and mandatory charges remain open. [Evidence](docs/comparison-roundtrip-worker-guard-2026-11-23.md).

## 2026-11-23 continuation — Flight worker exact-query integrity

Hardened the durable flight-worker result boundary so it rejects changed or missing count-party child ages, identified traveler IDs/DOBs/guardian assignments/infant seating, and normalized search filters. Skyscanner partial progress now includes the validated identified-party assignment in local result metadata while keeping identities and DOBs out of the upstream request. Regression tests cover valid and tampered party/filter envelopes and the progress boundary. Full `npm test` passed 719/719; `npm run build` passed; audit found 0 vulnerabilities; Markdown links passed for 134 files. This is fixture evidence, not live fare or seller evidence. Other worker result types, provider chronology, carrier eligibility, and seller validation remain open. [Evidence](docs/flight-worker-exact-query-guard-2026-11-23.md).

## 2026-11-23 continuation — Booking.com Demand pagination

Added one bounded v3.3 continuation page after the initial 30-property result. The adapter checks at most 60 provider rows, sends the opaque `metadata.next_page` value only as the next request's `page`, checks details per page, timestamps pages separately, and caps pagination at two. Invalid tokens are withheld; an error on later work preserves earlier validated offers and is marked partial. The durable hotel worker now reconciles page observations, accepted offers, freshness timestamps, provider counts and failure state. Focused adapter/worker tests passed 29/29; full suite passed 715/715, build passed, audit found 0 vulnerabilities, and Markdown links passed for 133 files. The production Chromium check verifies the partial-page explanation, exact two-room assignments and zero provider calls/browser errors. Partner credentials are not configured, so no live request or inventory claim was made. P4/§17 remain Partial. [Evidence](docs/booking-demand-bounded-pagination-2026-11-23.md).

## 2026-11-23 continuation — ACV structured pagination

Implemented bounded ACV widget pagination for supported party shapes. A selected 40-result query may use the ordinary widget's exact offset-0 and offset-20 responses; the merged result and durable worker require sequential ranges, consistent provider totals, unique identities, per-page observation evidence, exact query/listing correspondence, and rendered-card parity. Incomplete/mismatched data falls back to the bounded card path; access/rate refusals and cancellation stop. Updated UI coverage text reports pages checked and the provider-reported count. Two earlier widget checks confirmed the page shape (40 cards; offsets 0/20; reported totals 78 and 84). The adapter's new live integration attempt could not load the package form and submitted no search, so it produced no price and does not establish website-to-worker evidence. Full tests passed 710/710 and focused package tests 45/45 after the last guard; production build passed on the final code state, audit found 0 vulnerabilities. Production browser package-coverage and responsive fixture checks passed with provider traffic intercepted. See [detailed ACV pagination evidence](docs/acv-structured-pagination-2026-11-23.md). P6 and `work.md` §17 remain open.

## P13 streamed calendar announcement — 2026-11-14

Replaced multiple frequently changing calendar status regions with a single concise polite announcement that updates when the displayed preview changes and reports observed provider/date progress. Detailed polling counters remain visible. Fresh production browser test checked provisional CAD 500/510 observations and final CAD 400 observation; status was announced once while streaming and on completion, provider/job calls were intercepted, and there were no page errors. `npm run build` passed; `npm test` passed 599/599; `npm audit --audit-level=low` reported zero vulnerabilities. The local production server was stopped. P13 still needs screen-reader/manual testing and broader dynamic-state validation. A bounded Omkar Expedia live recheck made two adapter attempts and received HTTP 500 both times; no fare was observed. [Evidence](docs/calendar-live-announcement-2026-11-14.md).

## P13 mobile target comfort — 2026-11-14

Raised worker status, location-type selects, filter reset, and advanced-filter inputs/selects to 44px minimum. The responsive browser check now enforces 44px for the designated controls; fresh build shows all 66 sampled initial-page targets meet 44px at 320px with no overflow at 320/375/768px or under text-spacing overrides. P13 remains partial pending dynamic UI, screen-reader and physical-device evidence. [Full audit](docs/frontend-accessibility-audit-2026-11-14.md).

## P13 theme tokens and verification — 2026-11-14

Main dark/light colors now use 48 semantic CSS variables, with browser assertions that key values resolve and switch by theme. Fresh isolated build and production UI checks passed: sampled contrast minimum 5.27:1 dark / 5.53:1 light, 113 named controls, responsive at 320/375/768px and enlarged text spacing. Full suite passed 599/599 using temporary API Anything state paths; audit reported 0 vulnerabilities. The adapter now honors `TRAVEL_API_ANYTHING_HOME` for test isolation. The subsequent touch-target update raised all 66 sampled initial-page targets to 44px minimum at 320px. Full WCAG/assistive-technology and physical-device validation remains open. See [audit details](docs/frontend-accessibility-audit-2026-11-14.md).

## P13 frontend audit — 2026-11-14

Production-build browser checks passed for named controls, sampled dark/light contrast, and responsive text reflow. Audit score is 14/20 (Good). Findings are a scattered hard-coded color palette and 12 of 66 sampled visible controls below the 44px comfort target at 320px (all passed the 24px AA floor). Full WCAG, assistive-technology, dynamic-state, physical-device, and field performance evidence remains open. No frontend code changed. See the [full audit report](docs/frontend-accessibility-audit-2026-11-14.md).

## P5 official public-offer recheck — 2026-11-14 17:40–17:43 UTC

Official CAA, Costco and Visa source pages were reviewed; active CAA/Canadian Costco membership or eligible Canadian Visa card requirements remain user-specific and unverified. Costco's current Montreal offer has a Nov 15 booking deadline, with no exact-date price. Visa's Booking.com benefit and Costco Executive reward are future credits/rewards, not immediate price discounts. No discount was applied. [Evidence](docs/member-offer-current-check-2026-11-14-1743.md).

## P2 United rule access remains unresolved — 2026-11-14 17:39 UTC

The official United child-travel and unaccompanied-minor pages still expose a JavaScript shell, and official search results provide no readable policy details. United-specific age/fare eligibility remains `unverified`; the app must not infer it. [Evidence](docs/united-policy-access-recheck-2026-11-13.md).

## P6 fresh ACV live package result — 2026-11-14 17:16–17:19 UTC

Current website-to-worker evidence: 19 supported estimated CAD results from 20 inspected panels for YHZ–Barcelona/BCN, Apr 15–25 2027, one adult and the supplied age-7 child, one room, four stars, up to two stops. Display range CAD 3,235.95–5,890.72; more listings remained unsearched. Checkout, exact property, local charges and child fare acceptance remain open. [Evidence](docs/acv-live-package-refresh-2026-11-14-1719.md). The temporary stack and disposable database were removed after the check.

The 17:44 UTC widget recheck confirmed the provider disables child selection with two rooms in this package flow. The app keeps that occupancy unsupported; no search or checkout was submitted. [Evidence](docs/acv-party-ui-recheck-2026-11-13.md).

## P12 encrypted-backup key-reader hardening — 2026-11-14 17:12 UTC

Encrypted backup keys are opened without following symlinks. The opened descriptor is checked for regular-file type, ownership and owner-only mode; key data is capped at 129 bytes. Encrypted archive verification/restore open once without following symlinks, validate the opened descriptor, and decrypt from that same descriptor. Regressions cover oversized and symlinked keys plus symlinked archives. Focused backup suite 3/3, isolated recovery drill, full `npm test` 599/599, isolated Next build and audit (zero vulnerabilities) passed. No provider requests or production database access. [Evidence](docs/encrypted-job-backups-2026-11-14.md). This is a local hardening step; §17 remains Partial and the service remains local-only.

## P12 local credential-file permissions — 2026-11-14 16:55 UTC

The local secrets check found `.env.local` mode `0644` and corrected it to `0600`; contents were not printed. Only `.env.local` and `.env.example` were found in the bounded file scan, and only example assignment metadata was inspected. This reduces local account exposure but does not encrypt the credentials, rotate them, or establish deployment-grade key storage. See [security evidence](docs/encrypted-job-backups-2026-11-14.md).

## P12 authenticated encrypted local backups — 2026-11-14 16:53 UTC

Added `keygen`, `backup-encrypted`, `verify-encrypted`, and `restore-encrypted` to the SQLite job-database CLI. Archives use AES-256-GCM; a separately stored 32-byte key file must be regular, non-symlink and mode `0600`. Restore writes to a new file, checks authentication/schema, marks queued/running/paused work interrupted, and never automatically replays it. Existing plaintext CLI paths remain for compatibility and are labeled plaintext in README. The backup regression suite passed 3/3, including wrong key, modified tag, unsafe permissions, overwrite refusal and sensitive-value absence. Full suite 599/599; isolated build and zero-vulnerability audit passed; expanded disposable `check:job-recovery` and `check:local-stack` passed. Neither touched the production DB nor made provider calls. There is no automated encrypted offsite schedule, independent key escrow or production-data restore drill, so P12 remains Partial and the app stays local-only. [Commands and evidence](docs/encrypted-job-backups-2026-11-14.md).

## P0/P11 calendar worker result guard — 2026-11-14 01:31–01:43 UTC

The calendar child worker now validates the final date grid, exact route pairs, CAD price-to-offer consistency, offer freshness/segments, and request/coverage counters before sending a result for persistence. Invalid envelopes become sanitized worker errors. Focused calendar-validator and actual durable-worker tests passed 11/11; full `npm test` passed 566/566; isolated Next.js 16.4.3 build passed; `npm audit --audit-level=low` found zero vulnerabilities. Rebuilt Chromium streaming and region-selected calendar checks passed with provider/job calls intercepted; no live fare query ran. This closes only the calendar result boundary. Flight, comparison, hotel and package result schemas plus complete cross-provider chronology evidence remain open. [Evidence and limits](docs/calendar-worker-result-validation-2026-11-14.md).

## P11 calendar candidate-limit validation — 2026-11-14 01:18–01:27 UTC

`validateCalendarQuery` now rejects pre-resolved origin or destination lists longer than the selected per-location airport limit. A regression reproduced the mismatch and now covers overflow on either side while preserving the 20-candidate case. The calendar API returned HTTP 400 before job creation for an over-limit request. Full `npm test` passed 562/562; an isolated Next.js 16.4.3 build passed; `npm audit --audit-level=low` found zero vulnerabilities; rebuilt loopback Chromium calendar-range checks passed for both explicit-airport and region-selected forms with capability/job calls intercepted. This does not expand airport discovery or live fare coverage; P11 and §17 remain Partial. [Evidence](docs/calendar-airport-candidate-limit-2026-11-14.md).

## P0 Matrix detailed itinerary expansion and fanout guard — 2026-11-14 00:46–01:07 UTC

The Matrix option now exposes bounded native-browser detail expansion: all-source searches keep it opt-in; Matrix-only economy searches enable it automatically when the extra-stop setting is at most two. The adapter applies the native form's stop/airport-change settings, expands up to three connecting or mixed-carrier results only for fixed-date exact-airport searches; regional fanout suppresses expansion and calendars reject it. Matching Matrix session/solution IDs and strict itinerary validation are required. Unsupported combinations fail closed; incomplete fares remain CAD price-only observations. Current full suite: 562/562 passed; isolated production build passed; `npm audit --audit-level=low` found zero vulnerabilities. Controlled Matrix-settings and price-observation Chromium checks passed. One live YHZ–LAX 2026-12-15–22 / 1 adult / economy / CAD query returned 25 results, expanded 3/3 details, accepted 3 itineraries, and retained 22 price observations. A separate production-build UI→worker search reproduced those counts with zero browser errors and zero off-origin browser requests. Seller availability, baggage, fees, checkout and exhaustive route coverage remain unverified. Overall status remains Partial and local-only. [Full evidence and limits](docs/matrix-detailed-expansion-live-2026-11-14.md).

## P3 bounded live round-trip ticket comparison — 2026-11-14 01:12 UTC

A fresh direct backend Ignav query refreshed the exact YHZ–LAX Dec 15–22 one-adult economy round-trip at CAD 777. The separate-ticket optimizer used 8 requests plus one baseline-selection query, priced all 6 exact ticket blocks and returned 4 complete plans. Lowest observed total CAD 772 (CAD 5 lower before unverified extras); one alternate YYZ–LAX pair returned 98 matching alternatives (8 shown, 90 omitted), with provider coverage explicitly incomplete. Focused tests passed 50/50; controlled result UI check passed with providers intercepted. This is not a live website-submitted fare search and does not establish seat inventory, seller issuance, baggage, fees or protection. [Evidence](docs/separate-ticket-roundtrip-live-check-2026-11-14.md).

## P10 official hotel-engine access recheck — 2026-11-14

Current official-property inventory routes through Reservit only. The expected Booking.com Demand keys are absent from `.env.local`; no Cloudbeds or Mews production/property authorization is present. Current Mews guidance says its Booking Engine API is unsuitable for continuous single-server polling and requires registered client/property access; its Connector API production access follows certification. Cloudbeds requires partner/property authorization, endpoint scopes, and partner onboarding. No adapter was added without a permitted read-only availability contract. P10 remains Partial; exact gates and primary links are in [the access review](docs/official-hotel-access-recheck-2026-11-14.md).

## P5 current member-offer source recheck — 2026-11-14 00:23–00:25 UTC

The paced same-origin endpoint observed CAA Atlantic’s public hotel page plus membership terms and Visa Canada’s benefit page plus general terms. Visa’s advertised benefit is up to 8% (maximum USD 230) in future Booking.com Travel Credits, not an immediate price reduction; the general terms require an eligible Canadian Infinite/Infinite+ card and do not allow combining discounts. Full booking-specific Visa terms and traveler/card eligibility remain unknown. One Costco current-deals request after its old cooldown was blocked again; new retry time is `2026-11-14T00:29:56.450Z`. No further retry or alternate access was attempted. No account data or discount. [Evidence](docs/member-offers-recheck-2026-11-14-0025.md).

## Current audit checkpoint — 2026-11-14 00:15–00:21 UTC

Re-read current repository instructions and inspected traveler/Expedia implementation and tests. Expedia's age-only round-trip check already rejects a possible move across its 12+ adult-fare category; focused tests cover the behavior. No speculative rule for an 18th-birthday fare-category change was added because 12+ is already treated as the same Expedia adult-fare category, while legal age/guardian eligibility remains distinct. Full `npm test` passed 557/557 in 85.1s, isolated Next.js 16.4.3 build passed, audit found zero vulnerabilities, and the current loopback regional coverage browser check passed with provider/job operations intercepted. Same-origin health at 00:15:54 UTC: `ok`, queue empty, one live worker, zero expired leases/deadlines. One paced Costco current-deals request was blocked with retry time 00:24:43.422 UTC; no retry or discount was attempted. Regional UI evidence does not prove current live resolver or fare coverage. Overall status remains Partial/local-only. [Evidence](docs/current-audit-checkpoint-2026-11-14-0020.md).

## P6 fresh Air Canada Vacations website/worker result — 2026-11-14 00:05–00:07 UTC

The local website selected provider YHZ, Barcelona city and BCN arrival airport, then submitted the previously supplied actual age-7 child with one adult, one room, Apr 15–25 2027, four-star minimum, max two stops and a 20-panel cap. The live widget rendered 20 supported estimated observations from 20 inspected panels and indicated more remained. Examples ranged from CAD 3,235.54 to CAD 5,890.92. These are estimates, not checkout-confirmed offers. The response-body race in the Playwright location-check script was fixed by capturing JSON at the response event; the full website flow passed. Exact property/address, child fare acceptance, current availability, full mandatory/local charges, checkout and multi-room child support remain open. [Evidence](docs/acv-live-package-check-2026-11-14.md).

## P4 Booking.com conditional-charge disclosure — 2026-11-13 23:22 UTC

A current-code review found that absent conditional-charge evidence could be rendered as if details had been supplied, and a null conditional amount could cause an otherwise valid search observation to be dropped. The adapter now labels priced conditional amounts, explicit empty lists, and missing/incalculable amounts distinctly; it never adds conditional fees to the expected total. Included/excluded amount validation still fails closed. Booking.com’s current docs confirm that conditional charges are outside search totals, may be payable, and may be incalculable. Focused Booking.com/Flight + Hotel tests passed 22/22; full `npm test` passed 557/557; isolated Next.js 16.4.3 production build passed; `npm audit --audit-level=low` found zero vulnerabilities. The controlled two-room browser check passed against the rebuilt production server on port 3001 with provider/job traffic intercepted and zero browser errors. Port 3000 remained HTTP 200 with same-origin health `ok` at 23:25:53 UTC (queue 0, one live worker, zero expired leases/deadlines). No live Booking.com API quote was made; partner credentials remain unconfigured. P4 is Partial. [Evidence](docs/booking-demand-conditional-charge-disclosure-2026-11-13.md).


P4 follow-up — 2026-11-13 23:34 UTC: the fee UI preserves observed Booking.com charge IDs, calculation modes, condition IDs and provider `chargeable_online` flags; it does not guess charge names or collection locations. The 557-test suite, isolated production build, zero-vulnerability audit, and controlled production two-room browser check passed. Port 3000 root returned HTTP 200 and same-origin health returned `ok`, with queue depth 0 and one live worker (nine historical worker records were stale). Provider traffic was intercepted; no live Demand API credentials are configured. P4 remains Partial. See [the charge disclosure evidence](docs/booking-demand-conditional-charge-disclosure-2026-11-13.md).

## P3 same-flight party-split UI wording — 2026-11-13 23:50 UTC

P3 same-flight party-split UI wording — 2026-11-13 23:50 UTC: the empty result heading now says “No complete same-flight booking plan was priced,” avoiding any implication that refused/incomplete source calls prove no inventory. The new controlled browser regression failed against the old production UI and passed after the change; it covers a guardian-linked priced plan plus a second provider-refused result. `npm test` passed 557/557, the isolated production build passed, audit found zero vulnerabilities, and the production browser check passed with provider/job traffic intercepted, off-origin requests blocked, and zero page errors. No live supplier request occurred. P2/P3 remain Partial. See [the evidence](docs/party-comparison-no-plan-disclosure-2026-11-13.md).

## P5 current public-source and offer-terms refresh — 2026-11-13 23:16–23:45 UTC

The local paced checker rechecked Costco Travel’s current-deals page once at 23:16 UTC; it returned `blocked` with retry time `2026-11-13T23:22:42.722Z`, and no retry or alternative access was attempted. At 23:18 UTC the app observed Visa’s Canadian Infinite offer and general terms: up to 8% (maximum USD 230) as future Booking.com Travel Credits, not an immediate fare reduction. A separate official-page review found that the public sources do not specify the promotion dates, qualifying properties/rates, credit calculation/timing, cancellation effects, or full stacking rules. Visa directs users to Concierge for full third-party terms; its Booking.com link reached a JavaScript/robot-verification page, and no challenge was attempted. No account/card data was sent and no discount applied. P5 remains Partial. [Terms audit](docs/visa-booking-travel-credit-terms-2026-11-13.md) · [Member-source evidence](docs/member-offer-checks.md).

## P6 adult multi-room allocation disclosure — 2026-11-13

The ACV result normalizer now records aggregate occupancy evidence and labels adult assignment as `not_exposed_by_widget` for multi-room searches. The result page warns that a matching aggregate adult/room total does not verify a particular per-room allocation. Child/infant searches remain limited to the provider-observed one-room flow. Focused package tests passed 23/23; the current loopback production browser check passed with provider traffic intercepted (0 provider calls, 6 controlled job calls); it verified the allocation caveat is a visible `role=status`. The loopback page returned HTTP 200 and same-origin health was `ok` at 23:16:47 UTC. Fresh full verification also passed: `npm test` 556/556, isolated Next 16.4.3 production build, and `npm audit --audit-level=low` with zero vulnerabilities. These are controlled checks, not a new live package quote. Property/room equivalence, per-room assignments, current availability, full fees and checkout remain unverified; P6 is Partial. [Evidence](docs/acv-adult-multiroom-allocation-disclosure-2026-11-13.md).


## P13 initial-page touch-target evidence — 2026-11-13 23:01 UTC

Production Chromium measured 80 visible targets at both 320px and 1280px, all at least 24×24 CSS pixels. Choice labels were measured as clickable targets; the focused skip link was 189×46px. One inline link within prose was exempted as an inline text link. The responsive check blocked provider/external traffic and reported no page errors. This is limited to the initial page; dynamic result controls, real devices, assistive technology, full WCAG coverage, and actual 400% browser zoom remain open. [Evidence](docs/p13-touch-target-audit-2026-11-13.md).

## P13 text-spacing reflow — 2026-11-13 22:54 UTC

Fixed the summary-pill overflow found at a 320px layout width when text enlargement and WCAG text-spacing overrides were active. The prior nowrap pill reached 375px; it now wraps within the narrow container. The responsive browser script preserves this regression. Production Chromium passed 320/375/768px and the enlarged-text spacing case; the full suite passed 555/555, the isolated production build passed, and audit found 0 vulnerabilities. The rebuilt local production site is running at `http://127.0.0.1:3000`; root returned HTTP 200 and same-origin health was `ok` at 22:57 UTC. This is not a true desktop 400% browser-zoom test: the headless browser did not process zoom shortcuts. Full zoom/WCAG/device validation remains open. [Evidence](docs/p13-text-spacing-reflow-2026-11-13.md).

## Current-tree verification — 2026-11-13 22:46 UTC

Fresh full verification on the current tree passed: `npm test` 555/555, an isolated Next production build, and `npm audit --audit-level=low` with zero vulnerabilities. Production Chromium checks for the two-room child Flight + Hotel UI and room handoff passed with provider traffic intercepted. They verify visible traveler/room assignment, controlled subtotal, and re-entry/current-rate caveats, not live hotel availability. The isolated same-origin health observation was `ok` with queue 0 and no expired leases/deadlines; its temporary server was stopped after capture.

The current P1 code derives Expedia journey duration from validated offset-aware endpoints and includes layovers; P2 exact DOB/guardian validation is present; P3 identified passenger splits keep minors with assigned guardians. These code/test facts do not establish live fare or seller eligibility. Count-only child split optimization remains disabled because no guardian assignment is available. P4 multi-room child comparison remains fixture-backed without Booking.com partner credentials; P10 has no authorized non-Reservit inventory adapter. Overall `work.md` §17 is still Partial. See [the dated verification note](docs/current-tree-verification-2026-11-13-2246.md) and [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) for evidence and the open requirements.

## P8 exact regional pair-omission coverage — 2026-11-13 22:34 UTC

Regional pair results now calculate every omitted pair possible from the full returned origin/destination code lists. They enumerate up to 1,000 pair objects and summarize larger products with exact counts and the reconstructable code-set rule. The UI explains the pair formula and any resolver-more caveat. The 40×40 regression reported 1,600 possible pairs, 16 selected, 1,584 omitted. `npm test` passed 555/555, current production build passed, audit found zero vulnerabilities, and production Chromium confirmed the summary with provider calls intercepted. Upstream-hidden airport identities and live fares remain open. [Evidence](docs/region-pair-coverage-bounds-2026-11-13.md).

## P11 calendar omission reporting — 2026-11-13 22:27 UTC

Completed region-calendar output now identifies each airport code returned by the resolver but left unsearched, including candidates removed to fit the request budget. Removed candidates keep the resolver order. Running progress sends a marked sample of at most 20 codes; the completed UI shows every returned code. Resolver limits may still conceal candidates. New calendar test passed, 554/554 full tests passed, isolated production build and zero-vulnerability audit passed, and controlled Chromium confirmed progress sample/completed full list with zero browser errors and provider requests intercepted. [Evidence](docs/calendar-full-airport-omissions-2026-11-13.md).

## P8 all-region resolver recheck — 2026-11-13 22:16 UTC

The current cached production resolver succeeded for all 28 work.md geographic labels without calling fare providers. Counts matched the earlier audit. Europe returned 100 of 843 known candidates after excluding its 261 out-of-box airports and its three recorded popularity leaders, LHR/CDG/MAD. Most regions exceed the 100-airport exposed list; the resolver audit did not search fares or enumerate every possible omitted pair. P8 remains Partial. [Detailed counts and snapshot ages](docs/region-resolver-recheck-2026-11-13-2216.md).

## P7 fresh handoff and access-gated seller page — 2026-11-13 22:10 UTC

A bounded one-adult/economy YYZ–YUL Dec 18 Ignav search through the actual site returned 21 CAD observations; the first was a nonstop Porter CAD 233 result. An owner-bound handoff matched the itinerary and provider-reported price, but did not check current seller availability or supply baggage/mandatory charges; link specificity was unknown. A single normal GET to the Porter link was denied with HTTP 403 / `Just a moment...`. No challenge was interacted with or bypassed; no checkout, reservation or purchase. P7 remains Partial. [Evidence](docs/ignav-live-p7-seller-recheck-2026-11-13-2210.md).

## P9 current provider configuration — 2026-11-13 22:00 UTC

Read-only same-origin capability query for one-way YHZ–YYZ, one adult/economy: Ignav, Google, ITA Matrix and Expedia via Omkar were eligible for this query shape; Expedia partner API, Skyscanner and Air Canada NDC were unconfigured. No fare source ran and no secret was exposed. This is not evidence of inventory, permitted-use entitlement or seller pricing. [Evidence](docs/provider-capability-snapshot-2026-11-13.md). P9 remains Partial.

## P6 package-party UI recheck — 2026-11-13 22:01 UTC

Current production Chromium `check:package-infant-guidance` passed. It verifies exact child ages in the supported one-room path, browser-side infant age derivation, and no DOB in worker payloads. The checker intercepted all suppliers (0 provider calls) and reported 4 controlled job calls and zero browser errors. The two-room child restriction remains because the real ACV widget disabled child selection for two rooms; no workaround or separate-package aggregation was added. Live occupancy, exact property, availability, complete charges and checkout remain open. [Evidence](docs/acv-party-ui-recheck-2026-11-13.md).

## P4 count-based child Flight + Hotel UI — 2026-11-13 21:53 UTC

Removed a UI gate that suppressed **+ Hotel** for all count-based child parties. The action now requires a round trip, valid adult/child counts, and an explicitly entered age for each count-based child. It leaves age-at-hotel-check-in entry and strict comparator checks in place. The rebuilt local production UI passed the controlled Booking.com Demand multi-room path with one adult plus one age-7 child, two explicit room assignments, and fixture subtotal CAD 1,530 / CAD 510 per traveler; no provider or external network calls were made. Focused tests 30/30, isolated build and zero-vulnerability audit passed. An initial full-suite run alongside the production build timed out one unrelated worker test (552/553); it passed alone, then the full run without build contention passed 553/553 in 122.9 seconds. Evidence: [count-based Flight + Hotel UI](docs/flight-hotel-count-based-child-ui-2026-11-13.md). P4 and overall §17 are still incomplete.

## Current audit continuation — 2026-11-13 21:21 UTC

Expedia's current adapter already derives full journey elapsed time from validated offset-aware timestamps, including layovers. Its focused tests passed 8/8 on this re-audit. A local read-only store scan found no fresh exact one-adult CAD Ignav offer for P7 seller refresh, so no handoff request was sent. Follow up only after a fresh exact offer exists; no checkout, seller URL, reservation or purchase was opened. [Details](docs/current-audit-2026-11-13-2121.md).

The P2 exact-age and guardian-safe partition code was also re-read; the focused traveler, carrier, passenger split, and separate-ticket suites passed 96/96. This covers fixtures and invariants, not live fare eligibility or seller acceptance, so the requirement stays partial.

### P7 live follow-up — 2026-11-13 21:28 UTC

One real production-site YYZ–YUL Dec 16 query returned 23/23 accepted Ignav observations; the lowest fresh CAD quote was 169. A single owner-bound handoff returned the exact matching itinerary and same provider-reported price. Seller availability was `not_checked`, baggage was absent, mandatory charges were `not_itemized`, the seller timestamp was absent, and all five link entries had unknown specificity. No seller URL was opened. The site/worker remained healthy with an empty queue; no checkout or purchase. Detailed results: [P7 handoff note](docs/ignav-live-p7-handoff-2026-11-13-2128.md).

## P13 production UI recheck — 2026-11-13 21:34 UTC

Current production-browser smoke checks passed for accessible controls (112 named, no broken references, eight fieldsets, 85 keyboard targets), responsive layout (no overflow at 320/375/768, light-theme persistence), and visible theme contrast (162 samples per theme, minimum 5.27:1 dark and 5.53:1 light). External traffic was blocked; no search submitted. Full accessibility conformance remains open. See [UI evidence](docs/ui-quality-smoke-checks-2026-11-13.md).

United's official child/UM policy pages remained unreadable in the 21:35 UTC recheck: web viewer returned a JavaScript shell and normal browser GETs failed with HTTP/2 errors. No challenge was bypassed or policy inferred; keep the advisory `unverified`. See [access evidence](docs/united-policy-access-recheck-2026-11-13.md).

## P6 fresh ACV live package search — 2026-11-13 21:12–21:15 UTC

The live local site and existing worker completed a YHZ–Barcelona search for Apr 15–25, 2027. The website chose the exact ACV suggestions for Halifax origin, Barcelona city and Barcelona Airport (BCN), then submitted one adult and one actual age-7 child in one room, four-star minimum, maximum two stops and the 20-result cap. The worker inspected all 20 visible package panels and the UI rendered 20 supported estimated package observations; no offers were removed by selected hotel class/budget or stops. More listings remained beyond the cap. Examples: CAD 3,235.54 at Exe Barbera Parc and CAD 5,890.92 at H10 Art Gallery, observed at 21:14:01 UTC. These are estimated package group totals, not checkout-confirmed prices. Health after completion was `ok`, queue 0, one live worker, zero expired leases/deadlines, nine historical workers stale. The focused ACV suite passed 28/28. This does not establish child fare acceptance, exact property address/room, current inventory, complete taxes and local charges, all result pages, or final seller price. Multi-room child/infant bookings remain unsupported by the observed public widget. No account, challenge, checkout, reservation or purchase occurred. [Evidence](docs/acv-live-package-check-2026-11-13.md).

## P0 Skyscanner timezone and duration integrity — 2026-11-13 20:58–21:02 UTC

The Skyscanner adapter now loads airport timezone evidence before search or refresh, requires evidence regardless of caller options, and validates all local segment timestamps into UTC before publishing an offer. It checks chronology across connections and round-trip directions, supports valid date-line crossings, and rejects a leg if the provider-reported duration differs from first departure to final arrival in UTC. The refresh API no longer accepts a client-controlled opt-out. Search/refresh coverage distinguishes normalized offers received, accepted, and rejected; malformed raw rows filtered during normalization are outside these counts.

Verification through 21:02 UTC: regression tests first demonstrated the missing-timezone and duration-mismatch acceptance, then passed after the fix. Focused adapter/calendar/provider/refresh suite passed 79/79; full `npm test` passed 552/552; isolated production build passed; `npm audit --audit-level=low` reported 0 vulnerabilities. Production Chromium `check:flight-default` and `check:calendar-source` passed against the isolated port-3001 build, with supplier/job requests intercepted and zero browser errors/CSP violations. No live supplier call was made. See [the dated evidence](docs/skyscanner-timezone-integrity-2026-11-13.md).

This closes only the ordinary Skyscanner timestamp/duration integrity gap. Live Skyscanner evidence and seller verification are absent; all other open requirements in `work.md` §17 remain open. The prior 20:31 status below is historical and has been superseded for Skyscanner's timezone gate.

## P5 public member-source refresh — 2026-11-13 21:05 UTC

The application's paced checker freshly observed CAA Atlantic's public hotel summary and its membership terms, and Visa Infinite's public hotel-credit summary and linked general terms. CAA and Visa eligibility remain `unverified`; no user membership/card data or exact property/date room rate was checked. Visa describes up to 8% (USD 230 maximum) as a future credit for qualifying Booking.com stays, not an immediate price reduction. Costco's current-deals endpoint was `blocked` at 21:05 UTC and remained blocked on one paced retry after the supplied cooldown at 21:10:55 UTC; the retry time advanced to `2026-11-13T21:15:59.869Z`, with no offer returned. No further request, account access, discount, or workaround occurred. Details and source limits: [member-offer checks](docs/member-offer-checks.md).

Follow-up verification: `node --test tests/member-offers.test.mjs` passed 15/15; the suite's fixture tests preserve fail-closed eligibility and cooldown behavior but are not current Costco offer evidence.

## P0 flight-result completeness gate — 2026-11-13 20:31 UTC

`flightOfferError` now blocks a complete fare offer without provider/source/traveler provenance or actual segment evidence. It checks a bounded nonempty segment list, connected airports matching the complete requested route, flight and carrier identity, timestamps, and agreement between segment endpoints/times and the displayed journey. Google route-level output without flight details is rejected. Matrix prices without verified details remain in the separate price-only observation path. Regression checks and final `npm test` (551/551) passed; the isolated production build passed; `npm audit --audit-level=low` found 0 vulnerabilities; production Chromium flight-default and Matrix price-observation checks passed with provider calls intercepted and no browser/CSP errors. One preliminary suite run had a native Google test hit its 10-second deadline under load; the isolated test and subsequent full run passed. Ordinary Skyscanner flight search still lacks the timezone requirement used by calendar searches, and other worker-result schemas remain incomplete. No provider query or booking action occurred. Details: [P0 validation evidence](docs/strict-flight-offer-validation-2026-11-13.md).

## P0 bounded live backend query — 2026-11-13 19:09 UTC

Submitted one exact Canadian YYZ–YUL one-way request for 2026-12-15, one adult, economy, CAD, and Ignav only through the local owner-bound job API. The actual worker completed it; Ignav returned 20 and all 20 passed the shared validator. The lowest observed price was CAD 169 on WS 916, with observation time `2026-11-13T19:09:15.269563Z`. This confirms the backend live source path, not a live UI submission or seller-verified price. No handoff, booking, or reservation occurred. All limits are recorded in [the dated live note](docs/ignav-live-yyz-yul-2026-11-13.md). The broader goal remains active.

At 19:11 UTC a real Chromium UI search for YYZ→YUL Dec 16 (one-way, economy, one adult, Ignav only) rendered 23 observed prices; 23/23 were accepted, lowest CAD 169. Browser errors and off-origin requests were both zero. Together the two dated checks cover the backend path and one live UI-to-worker-to-provider-to-card path. They do not verify seller checkout or general route/date/party coverage; details and caveats are in the same live note.

## P12 retry-time status UI and current verification — 2026-11-13 19:04 UTC

The owner-visible queued-job state now includes the persisted worker recovery time. Flight search, fare calendar, and comparison UI render `retryAt` while a worker lease recovery is backing off; the timestamp goes away when the job is claimable. Production Chromium directly verified the flight and comparison notices; calendar remains to be asserted in browser. `npm test` passed 551/551; the isolated retry-status production build completed successfully; `npm audit --audit-level=low` found 0 vulnerabilities. Latest production Chromium retry-status and flight-default checks passed at 19:04; accessible-controls passed at 18:50. Provider calls were intercepted and no search was submitted; no browser errors or application CSP violations were observed. At 19:04 UTC the loopback production site and worker were running at `http://127.0.0.1:3000`; same-origin health was `ok`, queue depth 0, one live worker, zero expired leases/deadlines, nine stale historical records. Evidence: [worker recovery retry UI](docs/worker-recovery-retry-ui-2026-11-13.md).

This is a bounded P12 improvement, not completion: source-specific retry policy, authentication, abuse protection, monitoring, off-host recovery, and public deployment gates remain open. The root directory lacks `.git`, so changes cannot be summarized by Git status/diff. Site remains loopback-only. No supplier search, booking, reservation, or purchase was performed.

## P12 durable worker-recovery backoff — 2026-11-13 05:52 UTC

Expired flight/comparison/calendar worker leases now requeue with durable exponential delays (1s, then 2s, capped at 30s); repeated crashes remain bounded at two recoveries before the job fails. SQLite restart retains the scheduled delay and prior checkpoint, and stale lease tokens cannot publish. Package/hotel browser-session leases still fail rather than replaying an unrecoverable browser. Intentional pause/resume is unchanged. `npm test` 551/551; isolated production build passed; audit 0 vulnerabilities; disposable backup/restore drill passed with no provider calls. Local production server and worker were restarted; root and same-origin health pass, queue 0, one live worker, no expired leases/deadlines. P12 remains Partial. Evidence: [worker recovery backoff](docs/worker-recovery-backoff-2026-11-13.md).

Local state at 05:52 UTC: current production build is running at `http://127.0.0.1:3000`; health `ok`, queue depth 0, one live worker, nine stale historical worker records, zero expired leases/deadlines. No search was started.


## P13 keyboard skip link — 2026-11-13 05:41 UTC

Added the first-keyboard-stop skip link to Flight Search. Fresh isolated-production Chromium checks verified first Tab focus, Enter focus transfer, dynamic airline suggestions announced/operated by keyboard with state exposed; 85 rendered-order Tab targets traversed (native date input internal steps allowed); responsive 320/375/768px widths, and accessible-control integrity. Theme contrast sampled 162 visible text items per theme with no failures. Full tests passed 550/550, production build passed, audit found zero vulnerabilities. All provider traffic was blocked. At 05:30 UTC the local production site was restored at `http://127.0.0.1:3000`; operational health showed one live worker, queue depth zero, and zero expired leases/deadlines. Nine historical worker records are stale. P13 and the overall project remain partial; actual browser zoom, assistive-technology checks, and all other open `work.md` criteria remain outstanding. Evidence: [P13 skip-link note](docs/p13-keyboard-skip-link-2026-11-13.md).



## P4 check-in age reset and identified-party regression — 2026-11-13 05:16 UTC

`HotelSearch` now sources child check-in ages from the currently selected flight. If there is no DOB evidence for a child, a stale prior hotel age is left blank; standalone stay searches may still rehydrate the last submitted ages. `check-hotel-flight-switch` now covers a DOB-identified 2-adult/age-7 child party: an age-8 room allocation is blocked, age 7 proceeds, and birth dates remain absent from the hotel job request. It also covers a count-only party size mismatch. Flight-switch reset and an in-progress previous-job disclosure pass. `check:hotel-occupancy` still shows a fixture CAD 300 two-room child subtotal while availability stays unverified. Both controlled Chromium checks passed with provider/job traffic intercepted and zero page errors; `npm test` 550/550; isolated build and `npm audit --audit-level=low` passed with zero vulnerabilities. No live hotel search. Seller availability, room-category equivalence, mandatory charges and final checkout totals are open.

## P4 selected-flight hotel party matching — 2026-11-13 04:57 UTC

`HotelSearch` validates the requested hotel party against the selected flight before enqueueing. Count-only flight searches must have the same total guest count; actual hotel check-in ages stay explicit user inputs. DOB-identified flight parties must match hotel adults/children by age at check-in; assigned room adult ages are also checked. The browser regression proved a three-adult assignment was blocked against a two-adult flight and no hotel job was sent. The existing two-room/child fixture check still showed CAD 300.00 with simultaneous availability unverified; flight-switch reset/stale running job checks also passed. `npm test` 550/550; isolated production build passed; audit 0 vulnerabilities. Both browser checks intercepted provider/job traffic and had zero page errors. No live query. Live hotel inventory, equivalent rooms, complete fees and checkout totals remain open.

## P4 hotel failure and room coverage semantics — 2026-11-13 04:45 UTC

Booking.com multi-room provider failures no longer become `unavailable` status. A provider state such as `rate_limited` is preserved; generic failures are `error`; planned later rooms are `not_searched`. `coverage` now distinguishes searches attempted/completed/failed/not attempted, and limitation text reports those counts. Official-site and combined Booking.com error paths retain provider state. Focused tests passed 27/27; `npm test` passed 550/550; isolated production build passed; `npm audit --audit-level=low` found zero vulnerabilities. No live hotel query ran. Real inventory, simultaneous room availability, room-type equivalence, complete fees, seller confirmation and checkout totals remain open.

## P2 carrier-to-segment role mapping — 2026-11-13 04:35 UTC

Carrier age guidance now associates recognized marketing/operating roles with each outbound/inbound segment number. Airline names on segments can resolve supported guidance without an IATA designator. Missing or malformed identity remains visible and all fare/seller eligibility is unverified. Carrier tests 40/40; full suite 549/549; isolated build, audit (0 vulnerabilities), and controlled Chromium `check:party-partition` passed. Browser provider/job calls were intercepted; external calls blocked; zero page errors. Local production root/health HTTP 200, health `ok`, worker available, queue 0. No supplier query.

## P2 per-segment carrier name resolution — 2026-11-13 04:17 UTC

Recognized airline names on individual segments now resolve source-linked guidance when codes are absent, preserving marketing/operating roles. Missing or malformed identities remain disclosed and eligibility stays `unverified`. Carrier tests 40/40, full suite 549/549, isolated build, audit (zero vulnerabilities), and controlled Chromium `check:party-partition` passed. Provider/job requests were intercepted, external requests blocked and browser errors were zero. Local root/health HTTP 200/`ok`, queue 0, worker available, no expired leases/deadlines. No provider query. P2 remains Partial; see [carrier guidance](docs/carrier-age-guidance.md).

### Latest P5 promotion-source check — 2026-11-13 03:27 UTC

The app's paced official-source checker observed Visa's public Booking.com future-credit offer and linked general terms. It did not verify Booking-specific trip/property conditions or the user's card eligibility; no discount was applied. Costco's current-deals page returned a blocked response and was not retried or bypassed. The controlled member-offer UI check passed with fixture responses and intercepted provider traffic; that fixture does not represent the live Costco result. P5 remains Partial because active membership/card eligibility, current comparable property rates and the denied Costco listing remain open. [Evidence](docs/member-offer-checks.md#current-public-source-recheck--2026-11-13-0327-utc).

### Latest P7 live seller-handoff prerequisite attempt — 2026-11-13 03:05 UTC

A bounded YHZ–LAX Dec 15, one-adult/economy Ignav job returned `temporarily_unavailable` and no fare. No seller-handoff request or retry was made. The local app and worker remained healthy afterward. This is not proof of no inventory and did not verify seller availability, baggage, mandatory charges or checkout. Continue with a fresh bounded query only when provider conditions permit; handoff is conditional on a fresh exact offer. [Evidence](docs/ignav-live-p7-availability-attempt-2026-11-13.md).

The opt-in seller helper now accepts explicit origin/destination/date and one-way/round-trip settings while preserving a one-adult/economy/no-child guard. It only calls the owner-bound seller endpoint after selecting a fresh matching CAD Ignav offer; missing or stale matches stop before that call. Tests 4/4, full suite 547/547, isolated build and zero-vulnerability audit passed. The new helper was not used to retry the failed live source.

### Latest P4 selected-flight room-state fix — 2026-11-13 02:52 UTC

The hotel form previously retained a two-room assignment from a completed search after selecting a different flight; the old hotel observation could also be combined with the new flight display. State now resets on itinerary/query identity changes, a prior job cannot rehydrate room assignments while a flight is selected, and old hotel observations are hidden with a refresh instruction. The controlled Chromium regression submitted two rooms (adult ages 39 and 37) on YYZ–FRA, switched to YYZ–BCN and observed one room, zero assignment fieldsets, the stale-result message and zero page errors. All provider and job HTTP requests were intercepted. `npm test` 546/546, isolated Next production build and audit (zero vulnerabilities) passed. Site returned HTTP 200; same-origin worker health was `ok`, queue 0, worker available. No live hotel search occurred. P4/§17 remain Partial; see [the evidence note](docs/hotel-flight-party-reset-2026-11-13.md).

### Latest P3 live round-trip split check — 2026-11-13 02:03–02:05 UTC

One local YYZ–FRA Nov 14–20, one-adult/economy all-source search returned 183 Ignav fare records and 15 ITA Matrix price observations. Google native round-trip evidence failed; Expedia partner/Skyscanner were unconfigured and Air Canada NDC/Expedia via Omkar unsupported. A CAD 1,591 Ignav itinerary (two segments each direction) was refreshed for contiguous-ticket comparison, using 7/20 requests and no alternate airport pairs. Only 2/6 exact blocks were priceable, so there is no complete split plan. Same-pair alternatives were bounded and incomplete (182 matching, eight shown). No seller checks or booking. [Full evidence](docs/separate-ticket-roundtrip-live-check-2026-11-13.md).

Added per-block exact-flight/timestamp, request and quote counts plus bounded source response status, surfaced in a collapsed UI disclosure. It says missing fare evidence does not prove no inventory. Focused comparison tests 31/31; `npm test` 545/545; isolated production build passed; audit zero vulnerabilities; browser fixture passed with external/provider/job requests intercepted and zero page errors. The local website remained HTTP 200 and worker status healthy/empty. P3 remains partial; the live round-trip comparison had only 2/6 priced blocks.

Follow-up tested three exact alternate pairs in the live round-trip comparison (YYZ–FCO, YYZ–BCN, YYZ–MUC): 3/3 returned, 10/12 requests used, 413 matching alternatives, 8 shown, provider completion false. Exact chain BA98/BA906 outbound, TP6700/TP261 return; two blocks priced and four unpriced. Because source-level offers did not match the exact target flights, the UI calls those blocks `unpriced`, not unavailable. No complete split or savings; all seller/booking facts remain open. Full details and source counts: [evidence note](docs/separate-ticket-roundtrip-live-check-2026-11-13.md).

Post-label verification: focused comparison tests 31/31, `npm test` 545/545, separate-ticket results browser check passed with external/provider/job traffic intercepted and zero page errors, isolated production build passed, audit found zero vulnerabilities. The app remains live at `http://127.0.0.1:3000`; worker health is `ok` with empty queue and zero expired leases/deadlines. P3 remains incomplete because four exact blocks were unpriced and seller acceptance, baggage, fees, availability and simultaneous inventory were not verified.

Latest incremental fix also reports ticket blocks on stop/budget exits (`priced` / `partial` / `unpriced` / `not_searched`) with source refusal evidence. Focused tests 32/32, `npm test` 546/546, the controlled results browser check, isolated build and zero-vulnerability audit all passed. Local site HTTP 200; worker healthy and idle. See the [updated dated evidence](docs/separate-ticket-roundtrip-live-check-2026-11-13.md).

A later edge case now reports `partial` when some traveler-group quotes qualified before a source refusal. Final post-change verification at 02:36 UTC: focused 32/32, `npm test` 546/546, controlled browser check, isolated build and `npm audit` all passed; local site HTTP 200 and worker healthy/idle. Four of six exact live blocks still lacked a qualifying quote, so no complete split itinerary is shown.

### P11 provider response versus route completion — 2026-11-13 01:51–01:56 UTC

The calendar previously rendered an early validated offer but its progress text could still report zero completed route/date batches, with no count of replies from providers already finished. It now shows `provider responses received / planned` separately from `airport-pair/date searches checked`. Each exact provider/pair row is recorded once; suppressed calls are not counted as received responses, and traveler details are not copied into coverage rows. The running preview test saw two source replies while Expedia waited: 2/7 provider responses, 0/1 route/date batch complete. `tests/calendar-search.test.mjs` passed 43/43; full `npm test` passed 545/545; isolated build passed; audit found zero vulnerabilities. Local Chromium rendered offers and the separate counter with provider requests intercepted and zero browser errors. No live fare request occurred.

### P2 TAP Air Portugal source-linked advisory — 2026-11-13 01:25–01:39 UTC

Added TP code/name resolution and advisory rules from TAP's first-party family and FAQ pages. The UI explains adult/child group limits, infant lap/approved-seat handling, children's own-seat requirement, route-dependent special fares, and the online booking/connection limits for unaccompanied-minor service. TAP public age/companion wording differs by localized page, so the app leaves exact traveler and fare eligibility `unverified`. Focused tests 2/2; carrier suite 38/38; full `npm test` 545/545; isolated production build passed; audit found zero vulnerabilities. Updated local Chromium browser check confirms TAP guidance/links with provider requests intercepted and zero browser errors. No live fare or seller query. P2 remains Partial; see [`docs/carrier-age-guidance.md`](docs/carrier-age-guidance.md).

### Latest P13 UI quality and CSP check — 2026-11-13 01:18 UTC

Rechecked accessibility structure, search settings, responsiveness and theme contrast against the current loopback app. The browser checks reported 112 named controls, zero unnamed/duplicate/broken references, eight fieldsets with legends, working keyboard disclosure, no overflow at 320/375/768 px, persistent light theme, and 161 visible text samples per theme with minimum contrast 5.27:1 dark / 5.53:1 light. The Matrix settings form preserved its submitted controls; one airline suggestion rendered from intercepted test data. `check:flight-default` now passes on both dev and production: the old assertion timed out on Next dev HMR/overlay scripts, and its CSP event audit now distinguishes only the known devtools style events. It recorded zero app CSP violations and zero browser errors; production had zero CSP events. No CSP weakening or live provider request. P13 remains Partial pending full screen-reader, keyboard, zoom/reflow, reduced-motion, touch-target and physical-device coverage. See [the evidence note](docs/ui-quality-smoke-checks-2026-11-13.md).

### Latest P11 incremental all-offer calendar update — 2026-11-13 01:05 UTC

The calendar now exposes the complete validated fresh offer set received per date while route/provider work continues, rather than showing only the single best provisional fare. The best remains highlighted and updates with later lower observations; incomplete airport coverage remains labeled incomplete. Existing durable job progress and one-second owner-bound polling are used, so a response appears on the next poll after its provider returns. A controlled Chromium check showed CAD 500 and CAD 510 while running, then CAD 400 after completion. `npm test` passed 542/542, isolated production build passed, and audit found zero vulnerabilities. No live provider request was made. See [the evidence note](docs/calendar-all-offers-streaming-2026-11-13.md). The all-work goal remains active and incomplete.

### Latest P11/P12 checkpoint — 2026-11-13 00:41 UTC

The actual all-source YYZ→Europe one-day calendar completed four selected pairs (FRA/FCO/BCN/MUC), used all 16 request slots, and returned an ITA Matrix CAD 516.62 price-only YYZ–FRA observation. Omkar returned HTTP 500 for all four pairs, so the result remained `fullyScanned:false`; 839 airport candidates were known beyond the selected four, before the documented popularity/geography exclusions. See [the live calendar note](docs/calendar-multi-airport-live-2026-11-13.md).

A status poll returned SQLite `database is locked` during worker writes. `job-store.get()` used to force a global retention delete and run expiry updates on every poll. It now uses a 60-second retention sweep throttle, removes the requested expired row directly, and updates only an expired requested lease/deadline. A regression failed before and passed after; job-store tests 18/18, focused error/job-store tests 29/29 and full `npm test` 541/541. Busy/locked errors return generic HTTP 503 with `Retry-After: 1`. `npm audit fix` updated Hono 4.13.14 to 4.13.18; the isolated production build passed after all changes and audit reports zero vulnerabilities. At 00:53:34 UTC the local page returned HTTP 200 and health was `ok` with one live worker, queue 0 and no expired leases/deadlines. Final audit found zero vulnerabilities. This reduces unnecessary DB writes but does not prove future locks impossible. The search goal remains active; continue against all open `work.md` §17 criteria.

## Current continuation checkpoint — 2026-11-13 00:32 UTC

The completion goal remains active and incomplete. Treat `work.md` §17 as the acceptance authority; current dated evidence is in [`HANDOFF.md`](HANDOFF.md) and [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md), with the source index in [`docs/README.md`](docs/README.md). No purchase, reservation, account creation, CAPTCHA action, public deployment, or seller checkout was performed.

- **P1:** Current Expedia adapter uses validated offset-aware segment timestamps and elapsed journey time including layovers. `node --test tests/expedia.test.mjs` passed 8/8 at 00:28 UTC. This is fixture-backed; Expedia partner credentials remain unconfigured and Omkar previously returned HTTP 500.
- **P3:** A bounded live YHZ–FRA Dec 15 Ignav check used 8/12 requests and searched four of nine Europe airport pairs. Five were left unsearched; provider completion was false. It found 57 matching alternatives (8 shown) and one CAD 1,532 split plan vs. CAD 993 through. Component quote totals were not retained in the command summary, so this is aggregate-only evidence; no savings or seller availability was verified. See [`docs/separate-ticket-europe-live-2026-11-13-0030.md`](docs/separate-ticket-europe-live-2026-11-13-0030.md).
- **P7:** A fresh read-only owner-bound YHZ–LAX handoff matched the observed itinerary and returned five provider-priced options. Link specificity is unknown; seller availability is not checked, baggage absent, charges unitemized, and handoff timestamp missing. See [`docs/ignav-live-handoff-2026-11-12-2022.md`](docs/ignav-live-handoff-2026-11-12-2022.md).
- **P8/P11:** All 28 region resolvers work on recorded snapshots and each has one bounded fare-calendar sample, but 27/28 samples returned an observation and every regional scan is incomplete. Selected airport, pair and source coverage remains bounded. The actual site remains available at `http://127.0.0.1:3000` (HTTP 200 at 00:32 UTC); the worker health was last reported healthy in the previous check.
- **P10:** Reservit is the only configured official hotel engine. Cloudbeds and Mews require registered/authorized property integrations; no inventory adapter was added without those grants.
- The current tree's prior recorded verification is `npm test` 539/539, isolated production build passed, and `npm audit --audit-level=low` found zero vulnerabilities after the latest code change. This turn re-ran Expedia tests 8/8 and checked the local web root (HTTP 200); changes since are documentation-only.

### Next actions

1. Continue the open items in `work.md` §17; retain live evidence distinctions and only use authorized, bounded provider requests.
2. Prioritize exact-age/carrier eligibility and booking-party partitions where first-party policy evidence can be verified; keep unknown carrier rules fail-closed.
3. Continue hotel/ACV work only where a documented authorized inventory or package flow exists; record credential/property access blockers and move to independent items.
4. Keep regional fare searches bounded and disclose every omitted airport/pair, unsupported provider, failed request and date not searched. Do not call a regional minimum exhaustive.
5. Do not open checkout, reserve, purchase, create accounts, bypass challenges, or deploy publicly. Keep local-only until P12 gates are proven.
6. After code changes, follow repository `AGENTS.md`, run meaningful focused tests plus the requested full suite/build/audit/browser/API checks where appropriate, and reconcile `HANDOFF.md`, `IMPLEMENTATION-STATUS.md`, `goal.md`, `work.md` §17 and supporting evidence notes.

## P5 Costco public dated-deal source — 2026-11-09 01:26 UTC

Added an opt-in distinct from Costco membership terms to read the official [Costco Travel Weekly Deals](https://www.costcotravel.ca/Travel-Offers/Spotlight?localeCode=en_CA) page. The application fetch path observed one current dated listing, a Virgin Voyages launch deal with a booking deadline of 2026-11-25. The parser accepts only same-host HTTPS Costco package/cruise offer paths, a valid future `Book by` date and the expected page heading. It omits expired dates and marks markup changes unverified. This does not validate eligibility, a selected itinerary, travel dates, package price, membership, availability, taxes/fees or comparable totals; it applies no discount and uses no account. The offer was a public cruise listing, not a comparable hotel or airfare quote. Focused tests passed 15/15; full `npm test` passed 536/536; build passed; audit found 0 vulnerabilities. Rebuilt `check:member-offers` rendered the official dated listing using an intercepted fixture and reported zero browser errors; `check:accessible-controls` reported 112 named controls, no duplicate IDs/broken references, and keyboard disclosure working; the updated `check:separate-ticket-results` also passed. P5/§17 remain Partial; exact live-source evidence is in [the member-offer note](docs/member-offer-checks.md).

## P3 route-pair coverage correction and bounded live comparison — 2026-11-09 01:02–01:17 UTC

A bounded local-worker Ignav check searched YHZ–LAX, Nov 12–19, one adult, no children, economy, CAD. The selected fresh round trip was CAD 1,039 (AC 613/793 outbound; AC 790/600 return). The comparison issued 7 of 10 allowed requests, searched YUL–LAX and YYZ–LAX, found 2 eligible groupings and 4 exact blocks, priced 2 blocks, and produced no complete plans. Across route responses 427 of 428 returned candidates matched; 8 were shown and 419 omitted. Provider completion was known but at least one response was incomplete. Both alternate pairs returned without a stop status; search remained bounded and non-exhaustive. No simultaneous inventory, seller issuance, baggage, mandatory charges, transfers or payable total was verified; no booking flow was attempted. See [the dated evidence record](docs/separate-ticket-live-check-2026-11-09-0102.md).

Review identified a misleading word in the route-coverage UI: a provider-stopped request was included in the “refreshed” count. The executor now exposes separately attempted pair requests, responses without provider stop, stopped pairs and unattempted pairs. The UI shows exact pairs and makes no success claim for a stopped request. A rate-limit regression proves the failed pair is attempted/stopped while the following pair remains unsearched. Verification: focused comparison suite 49/49; full `npm test` 534/534; build passed; audit 0 vulnerabilities; rebuilt loopback `check:separate-ticket-results` passed with provider/job calls intercepted, off-origin requests blocked, zero page errors. This fixes coverage wording, not live completeness. P3/§17 stay Partial.

## P2 exact-age infant ticket-block regression — 2026-11-09 00:56 UTC

Added a separate-ticket regression for a lap infant whose second birthday occurs between departure and arrival on an overnight segment. The fake supplier returns an unsafe lap-fare quote if called; the optimizer must skip it, make no ticket-block request, return no plan, and report one skipped fare-category transition. The regression passes. Focused traveler/carrier/separate-ticket tests passed 78/78, full `npm test` passed 533/533, production build passed and audit found zero vulnerabilities. This is fixture-only safety evidence; live carrier/seller acceptance and age-specific pricing remain unverified.

United's two official child-travel pages were rechecked with the public viewer at 2026-11-09 00:53 UTC. Both showed only the JavaScript-required shell; United Vacations results were excluded as a different product. No current United airline age, infant, route, fee or partner rule was inferred. UA remains `unverified`; see [the dated access note](docs/united-policy-access-recheck-2026-11-08.md).

## P1 Expedia-via-Omkar live duration probe — 2026-11-09 00:42 UTC

Made one bounded YHZ–LAX one-way economy invocation of the configured `searchOmkarExpedia` provider adapter for November 12, 2026. The source call ended with HTTP 500 and `temporarily_unavailable` before any itinerary/fare data; no offsets, segment times, or durations were returned. The shared safe-fetch policy may retry a 5xx once; this direct call ran outside job transport metrics, so actual HTTP attempt count is unknown. No additional manual invocation or seller/booking flow was started. Direct Expedia partner access remains unconfigured. Existing tests cover offset-aware end-to-end duration including layovers, but live Expedia duration remains unverified. See [the probe evidence](docs/omkar-expedia-live-duration-2026-11-09.md).

## P7 guarded Air Canada handoff-link probe — 2026-11-09 00:37 UTC

Opened one fresh provider-reported Air Canada handoff link using a single read-only page GET in headless Chromium. Its starting route was `/booking/meta-redirect`; it reached `/booking/ca/en/aco/error` with HTTP 200. No exact itinerary flight references or prices rendered. Baggage and tax/fee wording in generic page text does not verify the selected offer's details.

The browser safety guard blocked 19 non-GET requests and seven off-domain requests. Those blocks may have interrupted the flow, so this does not establish that Air Canada's handoff itself is broken. No CAPTCHA appeared. No click, form submission, checkout, reservation or purchase was performed. Full URL and authorization query values were not logged. Availability, exact itinerary, baggage and mandatory charges remain unverified. P7/§17 remains Partial; see the detailed [Ignav evidence note](docs/ignav-live-yhz-lax-2026-11-08.md).

## P7 fresh exact-query Ignav fare and handoff — 2026-11-09 00:32 UTC

Through the local job API and worker, submitted one bounded exact YHZ–LAX round trip for Nov 12–19, one adult, zero children, economy and Ignav only. The job completed successfully with 42 fares received and 32 accepted. The lowest fresh accepted quote was CAD 1,033, observed at `2026-11-09T00:32:06.275596Z`.

One read-only Ignav handoff returned a matching itinerary and five provider-reported CAD options covering outbound and inbound: Air Canada 1,033 / 1,138 / 1,400 / 1,610; United 1,676. Seller availability was `not_checked`, link specificity was unknown, baggage was absent, mandatory charges were `not_itemized`, and the seller response had no `observedAt`. No seller URL was opened; no checkout, reservation or purchase occurred. Post-request health at `2026-11-09T00:32:29.999Z` was `ok`, one live worker, queue depth 0, and no expired leases or deadlines. This is current source evidence for that exact query, not Expedia pricing or a confirmed all-in seller total. P7/§17 remains Partial. Details: [live evidence note](docs/ignav-live-yhz-lax-2026-11-08.md).

## P8 Europe popularity coverage through merge and source outage — 2026-11-09 00:26 UTC

Review found that the production resolver's two-directory merge dropped the popularity-exclusion limit, number of passenger-ranked candidates, and shortfall from the Wikidata resolver result. `mergeAirportSources` now carries those fields into the merged response. If Wikidata is unavailable, the result explicitly reports limit 3, zero ranked candidates, and shortfall 3; directory status remains unavailable. The region cache namespace was bumped from v11 to v12 so old cached data cannot hide this metadata.

Regressions failed before both changes and pass after. Verification: focused geography/search tests 32/32; full `npm test` 531/531; `npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities; rebuilt local production `check:region-coverage` passed on port 3101 with provider/job requests intercepted. No live geography/fare lookup occurred. This repairs coverage disclosure only; P8 remains Partial due upstream caps, incomplete geographic data and no live pair/fare completeness evidence. Overall `work.md` §17 remains incomplete.

## Geographic coverage wording correction — 2026-11-08 23:46 UTC

Review found that single-region searches described every selected candidate as a “Wikidata airport,” although the live resolver merges OurAirports and Wikidata. Changed the limitation text to say “selected airport candidates from the resolved location”; the coverage method and per-candidate source fields continue to identify available evidence. The regression failed before the wording change and passed afterward. `npm test` passed 525/525, `npm run build` passed, `npm audit --audit-level=low` found 0 vulnerabilities, and rebuilt-loopback `check:region-coverage` passed with provider calls intercepted. No live geographic/supplier lookup was made. This corrects attribution wording only; airport directories remain bounded and incomplete and geographic/fare coverage remains Partial.

## Latest live P3 evidence — bounded separate-ticket comparison (2026-11-08 23:38 UTC)

One current Ignav-only YHZ–LAX one-adult economy round trip (Nov 12–19) returned 42 results and accepted 32. The selected CAD 1,033 connection itinerary was compared with contiguous same-flight ticket blocks under a 12-search cap; 5 searches ran, four blocks priced, and two complete round-trip plans matched all four exact flights. The plans were CAD 1,176 (2 tickets) and CAD 1,630 (3 tickets), both more than the observed through fare. The selected offer's observation was 23:33 UTC and its quote window ends at 23:48 UTC; recheck after expiry and treat the prices as historical. No alternate airport pairs were searched (`routeSearchLimit: 0`), no seller links were opened, and seller issuance, inventory simultaneity, baggage, charges, transfer feasibility and protection remain unverified. See [the bounded live evidence note](docs/separate-ticket-live-check-2026-11-08-2338.md). P3 remains Partial.

## Latest implementation update — Ignav local/UTC consistency (2026-11-08 23:20 UTC)

The previous review identified that Ignav local wall times and offset-aware UTC timestamps could conflict while still producing an accepted fare. The adapter now checks every segment's local departure/arrival against the corresponding UTC instant using the provider-declared IANA timezone. Missing/invalid zones or conflicting values fail closed. Exact handoff identity also includes the local timestamps. Evidence and contract reference: [Ignav timezone validation note](docs/ignav-timezone-validation-2026-11-08.md), [Ignav response format](https://ignav.com/docs/response-format).

The mismatch regression reproduced the prior acceptance before implementation and passed afterward. Focused Ignav/timezone/worker tests passed 37/37; full `npm test` passed 524/524; build passed; audit found zero vulnerabilities; rebuilt loopback `check:booking-links` passed with external requests blocked and zero browser errors. No live supplier/seller call occurred. The IANA zone is still provider-declared; its relationship to the airport code is not independently checked. Expedia timestamp evidence, airline/seller acceptance, child/infant fare eligibility and the other open work.md items remain incomplete. Acceptance remains Partial.

## Purpose and stopping point

This document is the current continuation guide for `/home/rayyan/Projects/travel-hunter-pro`. It summarizes the repository state and evidence as rechecked on 2026-11-08 and compares it with `work.md`, especially §17. The user previously paused implementation after a documentation handoff; an explicit directive resumed the completion goal on 2026-11-08. Implementation is active and acceptance remains incomplete.

Treat `work.md` §17 as the acceptance contract. A feature is not complete because a mock, fixture, UI check, or historical claim passes. Do not promote the project as complete unless every applicable criterion has fresh, reproducible evidence at its specified scope. Keep the site local-only until deployment gates pass.

## Repository state and operating boundaries

- Project root: `/home/rayyan/Projects/travel-hunter-pro`.
- The repository has no `.git` directory in this workspace. Do not assume a branch, clean tree, or commit history; preserve existing files and use direct diff/backups if later changes need review.
- Read `AGENTS.md` before code changes. It requires consulting the installed Next.js guides before changing Next-specific code. No product code was changed during this documentation-only handoff turn.
- Runtime is Next.js 16 / React 19, Node 22.13+, `api-anything`, and a durable SQLite-backed worker. `npm run dev:stack` is a local convenience. Server and worker are expected to remain bound to loopback (`127.0.0.1`); do not deploy publicly.
- `.env.local` exists. Never print, paste, or commit credentials or private captures. The credential audit checked names/nonempty presence only; only `IGNAV_API_KEY` was present among inspected prefixes. Booking Demand token/affiliate ID and checked Expedia, Skyscanner, Air Canada, GDS, HotelRunner and Stayify variables were absent. This does not prove public access is unavailable or that every adapter requires a key.
- User stated written permission for requested sources. Respect its exact scope and rate limits. Do not bypass CAPTCHAs, create accounts, submit credentials to unapproved endpoints, accept paid commitments, open checkout, reserve, purchase, or deploy without separate explicit authorization.
- Live prices are observations with source-specific limits. Keep distinct: synthetic test fixture, provider observation, refreshed quote, seller-verified offer, and completed booking. No booking was made.

## Current implementation and latest verified work

### P7 — exact party required before saved-offer seller handoff

Review found that the explicit Ignav live-check script matched the expected route, dates, cabin, and one adult but could still select a saved query with a child or identified travelers. `lib/ignav-seller-selection.mjs` now exports `isExactIgnavSellerQuery`; it requires the expected YHZ–LAX Nov 12–19 economy round trip, exactly one adult, zero children, an explicit empty child-age list, and no identified traveler field. `scripts/check-ignav-seller-handoff-live.mjs` applies this guard before selecting an offer. Regression tests reject children, inconsistent/unknown ages, missing party metadata, and identified parties. Focused tests pass 3/3; full suite passes 522/522; build passes; audit reports zero vulnerabilities. No live seller request was made. This is a read-only script guard, not proof of seller acceptance; P7 remains partial.

### P1 — Expedia journey duration

The Expedia partner adapter derives elapsed duration from validated, offset-aware departure and arrival timestamps, includes layovers, and rejects invalid chronology. Expedia-via-Omkar only derives elapsed time when ordered timestamps exist for each segment; local-time-only shapes remain price-only. Regression tests exist. No live Expedia inventory or timestamp-bearing Omkar response was verified here.

### P2 — Exact ages, infants, eligibility, guardian safety

DOBs are handled locally and ages are derived per travel date where the supported flow accepts identity details. Infant lap/seat intent, guardian identity, category-boundary validation, and a guardian picker/server check exist. Split-party cards identify travelers and guardian co-location without rendering full DOBs. Ticket cards now derive the displayed age from the local departure date(s) on that exact ticket’s segments; outbound-only tickets no longer show unrelated return-date ages, and missing segment dates are shown as unavailable. Rebuilt browser evidence passes for a child turning 10 between outbound and return, with guardian displayed and DOB hidden. Carrier advisories link official sources for Air Canada, WestJet, Delta, American, Porter, Air Transat, Flair, Lufthansa, Qatar, British Airways, Air France, Southwest, United, KLM and Emirates. Source conflicts and inaccessible/ambiguous rules remain explicit; eligibility is `unverified`. No ages or eligibility may be invented.

Latest local fare-category check: the official [ITA Matrix search UI](https://matrix.itasoftware.com/help) labels Adults 18–61 and Seniors 62+. Added regression coverage that ages 61/62 map to the corresponding Matrix categories and a 62nd birthday across an outbound/return pair is refused. Focused Matrix tests passed 24/24; full suite passed 528/528, build passed, audit found zero vulnerabilities. This verifies Matrix request categories only, not carrier/fare/seller acceptance.

Next: establish live carrier and seller evidence for each affected itinerary/fare basis, including operating carrier/codeshare, age bands, infant seat price, guardian/service rules and exact party acceptance. Until then these are advisories and safe local modeling, not a confirmed eligible booking.

United's official policy access was rechecked at 22:52 UTC on 2026-11-08. The current U.S. and Canadian child-travel/unaccompanied-minor pages exposed only a JavaScript-required shell, and the contract-of-carriage page provided no usable current rule. No age bands or eligibility rules were inferred from United Vacations or third-party summaries. Keep UA at `unverified`; see [the dated access note](docs/united-policy-access-recheck-2026-11-08.md).

### P3 — Bounded route and separate-ticket optimization

The optimizer supports exact flight identities, bounded alternative airport pairs, contiguous segment blocks, one-way and round-trip construction, traveler partitions where permitted, request budgets, freshness, cabin matching, chronology and coverage disclosures. Alternate pair metadata cannot overwrite the original query. It shows searched and unsearched pairs and avoids exhaustive-coverage claims.

Next: verify on live expanded routes and exact segment blocks; check seller acceptance, current seat availability, transfer feasibility, self-transfer risk/cost, baggage and separate-ticket protections. Preserve currency, party assignments, quote age, exact flights and every search budget. No simultaneous-inventory claim without provider evidence.

### P4 — Flight + Hotel and official booking handoff

Booking.com browser observations and Demand API products use strict occupancy/property/destination/stay/currency/freshness checks. A Demand multi-room subtotal requires exact adult/child-age echoes, exact CAD-cent product sum and matching expected total. The UI says products were observed in one response; simultaneous availability remains unverified. Partner credentials are missing, so the current child multi-room UI evidence is fixture-backed.

Latest Reservit fix: multi-room aggregation preserves each room’s tax and cancellation text; no `undefined` term is rendered. Its direct booking URL carries stay dates and total guest count but does not distinguish adults from children. The result tells travelers to re-enter exact ages and does not send undocumented query parameters. Official docs state North American Best Price totals are before tax and European totals are tax-inclusive; other regional treatment, property extras, final fees and checkout totals remain unknown. Evidence link: [Reservit official tool documentation](https://help.reservit.com/EN/presentation-of-our-tools-for-web-agencies).

Next: obtain authorized Booking Demand access if available; make bounded live searches; verify equivalent rooms, property match, exact stay/occupancy, mandatory and conditional charges, current availability, seller acceptance and checkout totals. Expand official engine support only with a real property and documented/tested adapter.

### P5 — Member offers

Seven CAA club pages, BCAA, AMA Alberta, Costco, and Visa program checks are selectable. BCAA's official Rewards hotel-category page is currently inaccessible to the app's text fetcher: its HTTP 200 response is a 121-character JavaScript shell, so the source reports `unverified`. Search-index snippets are not counted as application evidence. No discount is applied without verified terms and eligibility. AMA also returned `unverified`; Saskatchewan evidence is from Fall 2025, not proof of a current offer. No traveler membership/card details were supplied or verified.

Next: make BCAA/AMA content available through an authorized text source or leave them unverified; broaden remaining CAA club coverage; verify current terms, membership/card eligibility, booking channel, dates, room and comparable rate/inclusions. Apply no discount based on a checkbox or historic promotion claim alone.

Fresh Visa check (2026-11-09 00:09 UTC): the actual paced source checker still observed up to 8% / USD 230 in future Booking.com Travel Credits and observed general Visa terms. Eligibility is unverified; Booking-specific terms, property/date conditions, and the user's eligible Canadian card remain unknown. No discount or credit was applied. The official RLP API for BCAA requires CAA National-issued credentials and assigned offer scope, absent from the configured environment. See [member-offer evidence](docs/member-offer-checks.md).

### P6 — Air Canada Vacations

Current live website/worker evidence (read-only): YHZ–Barcelona/BCN, 2027-04-15 to 2027-04-25, one adult + child age 7, one room, four-star minimum, maximum two stops, 20-card inspection cap. The provider returned 20 cards/panels, 19 accepted; more results remained beyond the cap. Lowest observation: Exe Barbera Parc, CAD 3,225.53 at `2026-11-08T18:07:53.871Z`; provider card described four stars, Room Only, taxes/fees included, non-refundable, one stop each direction. It is an estimated package observation. Exact address, full inclusions, local fees, child acceptance, seller availability and checkout total are unverified. The live widget flow does not support children plus multiple rooms in the tested flow.

Next: repair or accurately fail closed on the widget occupancy limitation; validate location IDs, occupancy and filters end-to-end; verify property and total at seller handoff. Never construct synthetic package combinations.

P6 occupancy recheck (2026-11-09 00:04 UTC): a new read-only browser probe confirmed the live widget retained two rooms but disabled Add child; at one room it enabled child selection and retained age 7. No package search or checkout was submitted. The local rebuilt browser regression now verifies two-room + child is shown as unsupported and starts no job, then checks the one-room age-7 fixture flow. `TRAVEL_CHECK_URL=http://127.0.0.1:3101 npm run check:package-infant-guidance` passed with provider requests intercepted and zero browser errors. This is a confirmed provider limitation rather than multi-room child support; see [ACV widget evidence](docs/air-canada-vacations-probe.md).

### P7 — Seller handoff

A guarded exact-party Ignav query through the local website/job API completed at 22:47 UTC for YHZ–LAX, Nov 12–19, one adult, no children, economy. It returned 42 accepted CAD complete offers; the lowest was CAD 1,033 at `2026-11-08T22:47:20.382264Z`. One read-only seller-handoff refresh matched this exact itinerary, returned a provider-reported itinerary price of CAD 1,033 and five airline options with reported prices CAD 1,033 / 1,138 / 1,400 / 1,610 / 1,676. The handoff declared complete leg mapping, not seller availability.

The response still reports `sellerAvailabilityStatus: not_checked`, link specificity unknown, baggage absent, mandatory charges not itemized, and no refreshed `observedAt`. No seller URL was opened; no checkout, reservation, or purchase occurred. The exact-query and freshness guards are regression-tested. This is not Expedia verification or a confirmed all-in seller total. See [the detailed live record](docs/ignav-live-yhz-lax-2026-11-08.md).

Next: verify exact itinerary, seller link specificity, current availability, baggage and mandatory charges with timestamp, then represent the correct quote/handoff state. Do not book.

Latest P7 exact-party selector increment verification: focused selector tests 3/3, full `npm test` **522/522**, `npm run build` passed, and audit reported zero vulnerabilities. A subsequent fresh exact-query seller handoff is recorded above; it matched the itinerary but left availability, baggage, mandatory charges and refresh time unverified.

After that refresh, `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:booking-links` passed the rebuilt cabin-mismatch safety scenario. It confirmed owner capability use, mismatch explanation, and suppression of seller links, with zero browser errors and external requests blocked. This is fixture UI evidence; the live airline pages were not opened.

The browser check was then expanded to cover a matched offer too: it asserts the CAD itinerary and link prices, provider-reported price scope, matched-flight status, `seller availability: not checked`, `booking status: not booked`, and the mandatory-charges caveat, while retaining the mismatch/suppression case. The rerun passed with zero browser errors and external requests blocked. It uses a synthetic fixture exclusively in the test harness and is not live inventory evidence.

The handoff now exposes the normalized destination host from each accepted HTTPS seller URL beside its provider label. This is a transparency aid, not a domain verification claim or allowlist. `tests/ignav.test.mjs` asserts host extraction, and rebuilt loopback Chromium `check:booking-links` confirms `Air Canada (www.aircanada.com)` renders with the provider-reported price/caveats; mismatch links remain suppressed. Full suite/build/audit passed (522/522, success, zero vulnerabilities). The check passed on temporary rebuilt port 3001 and then on the restarted primary preview at port 3000; both runs blocked external traffic. Root is HTTP 200 and the worker is healthy.

### P8–P14 — Scope and overall status

The authoritative 14-row status matrix and `work.md` §17 table are in [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md). In summary: geographic region policies are versioned and bounded but live coverage is not exhaustive; Matrix is an unofficial price-observation channel with zero accepted complete itineraries in the latest exact YHZ–LAX run; hotel-engine expansion, provider access and multi-airport calendar evidence remain partial; security/operations are local-only; UI checks are smoke tests, not full WCAG certification; documentation is now cross-linked but must track future code/evidence.

### Latest implementation continuation — exact-age ticket display

Identified-party comparison cards derive age only from the local departure date(s) recorded on the exact ticket’s segments. Outbound-only tickets no longer show a return-date age; multi-day ticket blocks show each distinct segment departure date. Missing or malformed segment dates show age as unavailable rather than falling back to the overall trip dates. The rebuilt browser check covers a child turning 10 between outbound and return, a ticket missing segment dates, guardian co-location, and DOB privacy. P2 remains Partial because carrier eligibility and seller acceptance are unverified.

Verification for the prior exact-age increment: `npm test` **519/519**, `npm run build`, `npm audit --audit-level=low` (zero vulnerabilities), and `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:party-partition` all passed. The Chromium check intercepted job/provider calls and blocked external traffic.

### Previous implementation continuation — shared provider filter metrics

The dispatcher now recomputes `accepted` and `filterRejected` for provider search status rows that carry a valid `received` count. This covers native Google statuses, which previously omitted `accepted`, while leaving diagnostic rows without `received` unchanged. Public-dispatch regressions cover Google round-trip filtering, diagnostic preservation, and separate one-way `search`/`top` counts; the second regression caught and fixed an initial double-counting defect. Focused verification: `node --test tests/providers.test.mjs` passed 9/9. Fixture evidence only; Google live filter behavior is not established. Full verification is now complete: `npm test` 519/519, build passed, and audit found zero vulnerabilities.

## Current verification evidence

Latest implementation checkpoint (2026-11-08; current):

- `npm test`: **522/522 passed** after the P7 exact-party query guard.
- `npm run build`: passed.
- `npm audit --audit-level=low`: zero vulnerabilities.
- A current Ignav-only job returned 42/42 accepted CAD complete offers for the exact YHZ–LAX one-adult query. The guarded read-only seller refresh matched the lowest CAD 1,033 itinerary but did not verify seller availability, baggage, mandatory charges or refresh time.
- UI checks passed against rebuilt loopback page with provider traffic blocked/intercepted: `check:party-partition` after the exact-age ticket display correction, plus the earlier `check:hotel-room-handoff`, `check:hotel-occupancy`, `check:accessible-controls`, `check:responsive-ui`, `check:theme-contrast`, `check:flight-hotel-demand`, and `check:local-stack` checks.
- Accessibility smoke: 108 named controls, no duplicate IDs/broken references, eight fieldsets with legends, one main landmark, keyboard-operable settings disclosure, zero browser errors.
- Responsive smoke: 320, 375 and 768 CSS px; no horizontal overflow and theme persisted through reload.
- Contrast smoke: 159 visible text elements/theme; minimum computed ratios 5.27:1 dark and 5.53:1 light. Not a complete WCAG, device, gradient-pixel, zoom or assistive-technology audit.
- The production site was restarted after rebuilding and `check:party-partition` passed against `http://127.0.0.1:3000`; the existing worker was left running. Same-origin health at `2026-11-08T22:28:48.719Z` returned `ok`, one live worker, queue 0, and no expired leases/deadlines; historical stale/stopped worker records remain visible.
- Live read-only ACV/Ignav observations are in `docs/acv-live-package-check-2026-11-08-1807.md` and `docs/ignav-live-yhz-lax-2026-11-08.md`. These files explain their limits and contain no credentials/private captures.

Commands for a future authorized engineering session:

```sh
npm test
npm run build
npm audit --audit-level=low
TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:hotel-room-handoff
TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:hotel-occupancy
TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:accessible-controls
TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:responsive-ui
TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:theme-contrast
TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:party-partition
```

The full suite, production build, dependency audit, and relevant party-partition browser check have now been rerun successfully for the current UI change. Other listed browser checks were not repeated. For live requests, use the narrow opt-in script and one approved source/query at a time. Never expose API responses containing private links or tokens.

## Documentation map

- [`goal.md`](goal.md): active objective, full priority checklist and proof required.
- [`work.md`](work.md): specification/work history; §17 is the acceptance contract.
- [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md): current priority and §17 status tables plus dated implementation evidence.
- [`HANDOFF.md`](HANDOFF.md): uppercase chronological handoff log, newest entries first.
- [`docs/README.md`](docs/README.md): dated supporting research and verification index.
- [`ITA_MATRIX_INTEGRATION.md`](ITA_MATRIX_INTEGRATION.md): unofficial Matrix protocol/adapter reference; implementation code and current evidence take precedence over historical payload sketches.
- [`integration.md`](integration.md): historical Expedia/Omkar/Selenium proposal; Selenium remains unimplemented.
- [`README.md`](README.md): local setup and high-level current scope.

Dated investigations are preserved as snapshots. If old text reports a historical test count, query or capability, interpret it at that date; use the newest dated entries and the status tables for present implementation state. Documentation in this pass was link-checked; no code changed.

## Immediate next actions

1. Start by re-reading `AGENTS.md`, `goal.md`, `work.md` §17, this handoff, and the current code/tests; verify live process state before touching the running stack.
2. Continue through priorities rather than stopping after one feature. For each item: reproduce current behavior, implement smallest complete change through callers/UI/worker, add meaningful test, run full checks, and collect live evidence only through allowed, bounded sources.
3. Resolve P2 exact-age seller acceptance and P4/P6 occupancy/fees next where credentials/provider flow permit; document exact blockers and continue independent work.
4. Keep deployment blocked/local-only until P12 gates are evidenced. No purchase, reservation, CAPTCHA bypass, account creation, paid commitment or public deployment.
5. Update this handoff, `HANDOFF.md`, `IMPLEMENTATION-STATUS.md`, `work.md` and affected supporting docs after each substantive milestone.

## Current-session continuation — 2026-11-08

- Re-read repository instructions, the current goal/handoff/status docs, and `work.md` §17. The workspace has no Git metadata; no credential values were read. The configured key names are Ignav, Omkar, and Google round-trip. Booking Demand credentials remain absent.
- Current checks: `npm test` **519/519 passed** after the operation-scoped provider filter-metrics correction; `npm run build` passed; `npm audit --audit-level=low` found **0 vulnerabilities**. The local production page returned HTTP 200; same-origin health reported `ok`, one live worker, queue depth 0, and no expired leases/deadlines.
- Reproduced and fixed a controlled-browser harness mismatch: `WorkerStatus` polls `/api/health`, but `scripts/check-flight-default-ui.mjs` treated the legitimate poll as an unexpected API. The harness now intercepts a valid local health response. Production `check:flight-default` passed: one normal flight start, no automatic comparison, no reload re-enqueue, and explicit comparison opt-in.
- Fresh controlled production-browser checks passed: `check:accessible-controls` (108 named controls, no duplicate IDs/broken ARIA refs, 8 fieldsets with legends), `check:responsive-ui` (320/375/768 px, no overflow), `check:theme-contrast` (159 text elements/theme; minimum 5.27:1 dark and 5.53:1 light), `check:search-settings`, `check:region-coverage`, `check:hotel-occupancy`, `check:hotel-room-handoff`, `check:separate-ticket-results`, `check:party-partition`, `check:route-settings`, `check:calendar-source`, `check:calendar-ranges`, `check:worker-status`, `check:member-offers`, `check:flight-hotel-demand`, and `check:package-infant-guidance`. Provider/job calls in these UI checks were intercepted; fixture results are not live inventory evidence.
- `npm run check:job-recovery` passed against an isolated disposable database: backup/verification/restore passed, completed work was preserved, two active fixture jobs were interrupted without replay, backup permissions were `0600`, the production database was untouched, and no provider requests were made. This is local drill evidence, not off-site or production recovery.
- A production build replaced the previously running development server. The loopback production server and worker were restored (`npm start`, `npm run worker`); root and health were rechecked. Browser checks accidentally started against the temporary development server were not counted; the relevant checks were rerun against production.
- One authorized exact YHZ–LAX round-trip query (2026-11-12/19, one adult, economy) ran through configured eligible Google Flights, Ignav, and ITA Matrix sources at 19:52 UTC: 46 complete offers were accepted from Google/Ignav and 36 Matrix price-only observations were kept separate. Expedia/Skyscanner lacked credentials; Air Canada NDC and Omkar were unsupported for round trips. Fixed the live handoff script to select the lowest CAD Ignav offer rather than the cheapest cross-provider result; its self-check and a single read-only rerun passed, matching the current 19:53 Ignav observation. Seller availability remains `not_checked`, baggage absent, charges `not_itemized`, and no refresh timestamp. No seller link or checkout was opened. Membership/card eligibility and deployment were not verified; §17 remains **Partial** and the app local-only.
- Historical retrospective at 20:08 UTC applied shared filters to stored Google/Ignav offers; those counts are retained as historical only because the observations are now beyond the 15-minute freshness limit. This did not test source-native enforcement.

## Fresh exact-query filter verification — 2026-11-08 20:32–20:37 UTC

- Resolved uncertainty about the seven-case filtered run by inspecting persisted job records read-only. All seven jobs completed; none remained queued/running. Each used the exact saved YHZ–LAX query for 2026-11-12/19, one adult, economy, source `ignav`. Each received 39 offers. Retained results: include AC 16/39; nonstop 0/39; max CAD 1,044 1/39; max 720 minutes per direction 18/39; departure 18:00–24:00 0/39; exclude AC 8/39; exclude Canada (`CA`) 1/39; layovers 90–360 minutes 14/39.
- Source `accepted` matched final offers, `filterRejected` matched shared filter coverage, and source-normalization rejects were zero. These are fresh supplier-response jobs with shared application filtering, not evidence of source-native enforcement or consistency on Google/Matrix/other sources; Matrix price-only rows are excluded. Their quote freshness window is 15 minutes; recheck before presenting any result as actionable now.
- Same-origin health at `2026-11-08T20:37:04.425Z` was `ok`, one live worker, queue depth 0, and zero expired leases/deadlines. No retry/replay was made after the earlier poll error, no owner token was recovered or used, and no code or service state changed. This resolves the status-poll ambiguity. §17 remains Partial; blockers are reconciled in `goal.md`, `work.md`, `IMPLEMENTATION-STATUS.md`, and this handoff.

## P4 hotel flight-switch status follow-up — 2026-11-13

The controlled browser check for stale hotel room allocations now also covers an in-progress hotel job. It starts a job for one selected flight, changes the selected flight, and asserts the UI identifies the job as belonging to the previous flight while retaining its Cancel search control. This prevents the progress indicator from being mistaken for a search on the newly selected flight. Browser/job/provider traffic was intercepted; zero page errors. Full suite: `npm test` 547/547; isolated `TRAVEL_NEXT_DIST_DIR=.next-hotel-flight-running-build npm run build` passed; `npm audit` found zero vulnerabilities. The build directory was moved to `/tmp`. Local root and health returned HTTP 200; health was `ok`, queue 0, and no expired leases/deadlines. No live hotel query occurred. P4 remains Partial; see [the focused note](docs/hotel-flight-party-reset-2026-11-13.md).

## P2 mixed-itinerary carrier identity coverage — 2026-11-13 04:05 UTC

Carrier advisories now identify each segment missing marketing and/or operating carrier identity rather than allowing known-carrier guidance to imply whole-itinerary coverage. Eligibility remains unverified. API regression 39/39; full suite 548/548; isolated production build and zero-vulnerability audit passed. Controlled Chromium rendered the warning, intercepted provider/job traffic, blocked external requests, and had zero page errors. Local site/health were HTTP 200/`ok`, queue 0, worker available, no expired leases/deadlines. No supplier query. P2 remains Partial; see [carrier age guidance](docs/carrier-age-guidance.md).
