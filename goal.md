# Goal — Complete Travel Hunter Pro against `work.md`

## 2026-11-23 continuation — ACV structured pagination

Extended the ordinary-widget ACV adapter to validate one or two sequential 20-result pages for supported party shapes, up to the user-selected 40-result limit. The worker repeats query, page-range, total, identity, observation, link and rendered-card checks. Two prior normal-widget requests confirmed the live offset-0/20 shape and dynamic `totalAvailable` values; a post-change adapter attempt could not load the provider form and submitted no search. Full suite passed 710/710 and focused package suites passed 45/45 after the refusal-handling guard. Production build passed on the final code state; audit found 0 vulnerabilities. Production browser coverage-message and responsive fixture checks passed with provider traffic intercepted. Current website-to-worker evidence is still open. See [ACV pagination evidence](docs/acv-structured-pagination-2026-11-23.md).

Earlier verification refresh — 2026-11-23, before this ACV continuation: `npm test` 642/642; the prior tree's build passed after retrying past the Next.js security reminder; its audit report described the then-installed Next.js version. The current ACV continuation's final build and zero-finding audit are recorded above.

## 2026-11-23 continuation — Omkar Expedia recheck

One authorized read-only YHZ–LAX one-way request to the locally configured Omkar wrapper returned HTTP 200 with 80 flight rows, but no verified fares or price observations; the old combined rejection counter reported 227 route/fare rejections. The first sampled record lacked currency metadata and offset-bearing timestamps; the formatted price text was not inspected. The provider's official interface has no currency parameter, and its published examples do not establish CAD or absolute segment instants. Added aggregate, low-cardinality diagnostics and taught shared 429 handling to honor documented quota-reset headers when remaining quota is zero. Focused tests passed 35/35. The source remains live but has no proven CAD-price shape; direct Expedia partner access is unconfigured and the broader goal remains open.

## 2026-11-23 continuation — ACV adult multi-room

Implemented the ACV structured JSON path for adult parties in multiple rooms, using provider-observed `r0..rN` listing parameters as exact occupancy evidence. The live two-adult/two-room response had 20 packages; weighted per-passenger totals reconciled for all 20, and the adapter accepted all 20 through the worker validator. The results UI displays verified room allocations. Focused suite 40/40; full suite 641/641; production build passed after the Next.js security reminder retry. Audit still reports one moderate Next.js vulnerability, with a fix outside the declared dependency range. The overall goal remains incomplete: child multi-room/infant support, durable UI proof, >20 results, complete segment chronology, final availability and fees remain open.

## ACV structured three-child continuation — 2026-11-22

Extended ACV's fast ordinary-widget response path to three exact-age children in one room. A live widget request used a comma-separated age value and all 20 sampled packages had one adult plus three child passenger rows; 20/20 normalized results passed the worker guard for ages 7, 12 and 15. Exact age order, listing ages, `r0` allocation, passenger counts and totals are preserved. Focused tests pass 38/38 and the full suite 639/639; the build passes after the Next.js reminder. Audit reports one moderate Next.js issue; no upgrade was applied. A one-adult/eight-child UI query was refused before package search, so the provider's max count is unknown. Four-plus children and infants remain off the structured path; no durable UI/job run, complete flight segments, seller availability or checkout total was verified. Overall reverse-endpoint and §17 goals remain active and incomplete.

## ACV structured child-party continuation — 2026-11-23

Implemented one-child structured ACV package support: exact age is bound by the widget request, listing URL and room assignment; adult and child passenger price rows must match counts and reconcile to the CAD group total. The live ordinary widget returned 20 records for one adult plus age-7 child; 20/20 normalized and passed the package worker validator. Focused ACV tests passed 36/36. This is not a durable website/UI check because `next dev` stopped with a Next.js 16.4.3 security-upgrade prompt; the upgrade was not run. Other child counts, infants, pages >20, multi-room allocation, complete offset-aware package flights, seller availability and all-in checkout remain open. Overall goal remains active and incomplete.

## ACV endpoint continuation — 2026-11-14

Hardened the adult-only Air Canada Vacations JSON path against the current ordinary widget schema: economy request/segment code `Y`, hotel destination ID matching request `dest`, inclusive zero-based page end, and adult passenger marker `A` with exact adult counts and totals. The worker rechecks these joins. Live local website-to-worker evidence: 20/20 records accepted and rendered in structured mode, CAD displayed, 78 provider listings reported, more remain outside page one; one job took 24.955 seconds. Focused ACV tests passed 34/34. P6 and the reverse-endpoint goal remain active; child/infant and 40-result shapes still use the rendered-card path, and package segment chronology, seller availability, per-room allocation, mandatory charges and checkout totals are not verified.

## Reverse-endpoint progress — 2026-11-14

Extended the experimental Google Flights `GetCalendarPicker` integration to fixed-return round trips and preserved the return date in exact-date UI follow-up. A bounded ordinary YHZ–LAX Dec 1–8, 2026 request with fixed return Dec 8 returned 8/8 price rows and visibly confirmed CAD. The values remain price-only, without segments, seller availability, baggage or final charges. A separate one-way request failed closed with numeric marker 4; the adapter stays opt-in. Focused tests pass 61/61; full `TMPDIR=/dev/shm npm test` passes 631/631; build passes; `npm audit` reports 0 vulnerabilities. Added the [all-source reverse-endpoint implementation map](docs/reverse-endpoint-full-implementation-plan.md). Broader reverse-endpoint access, stability, credentials, performance and `work.md` §17 criteria remain open. [Inventory](docs/reverse-endpoint-implementation.md) · [Evidence](docs/reverse-endpoint-progressive-results-2026-11-14.md#google-flights-date-grid-integration--2026-11-14).

## P13 progressive calendar announcement — 2026-11-14

One polite screen-reader announcement now tracks actual streamed result changes; detailed polling status remains visual. The fresh-build streaming browser check, 599/599 unit/integration tests, build, and zero-vulnerability audit passed. Manual screen-reader validation remains open. Current Omkar Expedia recheck failed with HTTP 500 after its bounded retry, leaving dependent calendar coverage incomplete. [Evidence](docs/calendar-live-announcement-2026-11-14.md).

## P13 mobile touch targets — 2026-11-14

Frequently used compact controls now have a 44px minimum, enforced by the responsive browser check. Fresh-build check passed with 17 designated controls meeting 44px and all 66 sampled visible initial-page targets meeting 44px at 320px. Broader AT/dynamic/physical-device validation remains open. [Evidence](docs/frontend-accessibility-audit-2026-11-14.md).

## P13 theme-token follow-up — 2026-11-14

Core dark/light palette now uses 48 referenced semantic CSS custom properties; fresh build and browser checks passed, including dark/light contrast of 5.27:1 / 5.53:1. Full suite passed 599/599; audit found 0 vulnerabilities. The subsequent touch-target change raised all 66 sampled initial-page controls to at least 44px at 320px. P13 remains partial while dynamic/AT/device coverage is incomplete. [Evidence](docs/frontend-accessibility-audit-2026-11-14.md).

## P13 frontend audit — 2026-11-14

The initial browser audit scored 14/20 (Good); after palette tokens it scored 15/20. The initial 12/66 mobile target-size gap has since been fixed: all 66 sampled visible controls meet 44px at 320px. Complete assistive-technology/device validation remains open. [Audit](docs/frontend-accessibility-audit-2026-11-14.md).

## P5 official public-offer recheck — 2026-11-14 17:40–17:43 UTC

Current official CAA/Costco/Visa pages were reviewed. They do not verify personal eligibility or a comparable rate; Visa's Booking.com benefit is future Travel Credit and Costco Executive reward is after travel, so no discount was applied. [Evidence](docs/member-offer-current-check-2026-11-14-1743.md).

## P2 United rule access remains unresolved — 2026-11-14 17:39 UTC

Rechecked official United customer pages and official-domain search. They still provide no readable policy details, so the code correctly keeps United-specific age and fare eligibility `unverified`. [Evidence](docs/united-policy-access-recheck-2026-11-13.md).

## P6 fresh ACV live package result — 2026-11-14 17:16–17:19 UTC

Current website-to-worker evidence: 19 supported estimated CAD results from 20 inspected panels for YHZ–Barcelona/BCN, Apr 15–25 2027, one adult and the supplied age-7 child, one room, four stars, up to two stops. Display range CAD 3,235.95–5,890.72; more listings remained unsearched. Checkout, exact property, local charges and child fare acceptance remain open. [Evidence](docs/acv-live-package-refresh-2026-11-14-1719.md).

Current 17:44 UTC widget recheck: the actual package form disabled child entry with two rooms and re-enabled it at one room. No search or checkout was submitted; child multi-room packages remain unsupported. [Evidence](docs/acv-party-ui-recheck-2026-11-13.md).

## P12 encrypted-backup key-reader hardening — 2026-11-14 17:12 UTC

Encrypted-backup keys are opened without following symlinks, checked for type/owner/mode and read with a 129-byte cap; archives are opened once without following symlinks and decrypted from that same descriptor. Oversized and symlink regressions pass. Focused backup tests 3/3, isolated recovery drill, full suite 599/599, isolated Next build and zero-vulnerability audit passed. See [evidence](docs/encrypted-job-backups-2026-11-14.md). Scheduled/offsite backups, escrow, production restore and external monitoring remain open.

## P12 local credential-file permissions — 2026-11-14 16:55 UTC

The local secrets review found `.env.local` at `0644`; changed it to owner-only `0600`. No credential contents were printed. This is not encryption or credential rotation. P12 remains Partial/local-only; see [security evidence](docs/encrypted-job-backups-2026-11-14.md).

## P12 encrypted recovery checkpoint — 2026-11-14 16:53 UTC

Added an opt-in AES-256-GCM backup/verify/restore CLI using a separate generated owner-only key file. Restore writes to a new database and never replays incomplete jobs. The recovery drill now exercises plaintext and encrypted flows; wrong-key, tag-tamper, unsafe-permission and overwrite tests pass. Full suite 599/599, isolated production build, audit 0 vulnerabilities, `check:job-recovery` and `check:local-stack` all passed. No production DB or provider calls. Key custody, automated offsite scheduling, production recovery, external monitoring and deployment security remain open. See [encrypted backup evidence](docs/encrypted-job-backups-2026-11-14.md); overall goal remains active and incomplete.

## P0/P11 calendar worker result guard — 2026-11-14 01:31–01:43 UTC

The calendar child worker now validates the final date grid, exact route pairs, CAD price-to-offer consistency, offer freshness/segments, and request/coverage counters before sending a result for persistence. Invalid envelopes become sanitized worker errors. Focused calendar-validator and actual durable-worker tests passed 11/11; full `npm test` passed 566/566; isolated Next.js 16.4.3 build passed; `npm audit --audit-level=low` found zero vulnerabilities. Rebuilt Chromium streaming and region-selected calendar checks passed with provider/job calls intercepted; no live fare query ran. This closes only the calendar result boundary. Flight, comparison, hotel and package result schemas plus complete cross-provider chronology evidence remain open. [Evidence and limits](docs/calendar-worker-result-validation-2026-11-14.md).

## P11 calendar candidate-limit validation — 2026-11-14 01:18–01:27 UTC

`validateCalendarQuery` now rejects pre-resolved origin or destination lists longer than the selected per-location airport limit. A regression reproduced the mismatch and now covers overflow on either side while preserving the 20-candidate case. The calendar API returned HTTP 400 before job creation for an over-limit request. Full `npm test` passed 562/562; an isolated Next.js 16.4.3 build passed; `npm audit --audit-level=low` found zero vulnerabilities; rebuilt loopback Chromium calendar-range checks passed for both explicit-airport and region-selected forms with capability/job calls intercepted. This does not expand airport discovery or live fare coverage; P11 and §17 remain Partial. [Evidence](docs/calendar-airport-candidate-limit-2026-11-14.md).

P10 access recheck (2026-11-14): current official hotel rates use Reservit only; Booking.com Demand credentials are absent and Mews/Cloudbeds production/property access is not configured. Current vendor docs require authorization/certification, so no additional polling adapter was added. P10 remains open pending approved access. [Evidence](docs/official-hotel-access-recheck-2026-11-14.md).

Latest P5 check (2026-11-14 00:23–00:25 UTC): CAA Atlantic and Visa general pages/terms were observed through the paced endpoint; Costco current deals were blocked again and have a cooldown until 00:29:56.450 UTC. No member eligibility or discount was inferred. [Evidence](docs/member-offers-recheck-2026-11-14-0025.md). Overall goal remains active and incomplete.

Latest current-tree checkpoint: 2026-11-14 00:15–00:21 UTC. Full suite 557/557, isolated production build and zero-vulnerability audit passed; the loopback regional-coverage browser check passed with provider/job traffic intercepted. Expedia's 12+ fare boundary guard is already implemented and tested. Same-origin health was `ok`, queue empty, one live worker. One paced Costco deal request was blocked, with cooldown until 00:24:43.422 UTC. No code changed and no live regional fare search occurred. The completion objective remains active and incomplete; see [checkpoint evidence](docs/current-audit-checkpoint-2026-11-14-0020.md).

Latest P6 live package evidence (2026-11-14 00:05–00:07 UTC): the real website/worker flow selected provider YHZ, Barcelona and BCN and rendered 20 ACV estimated package observations for one adult plus the previously supplied actual age-7 child, one room, Apr 15–25 2027, four stars, at most two stops. CAD examples ranged 3,235.54–5,890.92; more listings remained beyond the inspected cap. The check-script response-body race was fixed, and same-origin worker health afterward was `ok`. Seller availability, exact property/room, child fare acceptance, full charges, checkout and multi-room child support remain open; P6 is Partial. [Evidence](docs/acv-live-package-check-2026-11-14.md).

Latest P11 verification refresh (2026-11-13 23:56–23:59 UTC): current-tree calendar tests passed 44/44; the controlled production browser check displayed provisional CAD 500/510 while running and CAD 400 after completion, with provider/job calls intercepted, two status polls, and zero browser errors. Same-origin health was `ok`, queue 0, one live worker, zero expired leases/deadlines, nine stale and eight stopped historical worker records. Full `npm test` passed 557/557, isolated Next.js 16.4.3 build passed, and audit found zero vulnerabilities. No live fare query ran. P11 remains Partial; see [the evidence refresh](docs/calendar-all-offers-streaming-2026-11-13.md#verification-refresh--2026-11-13-2356-utc).

Latest P4 implementation evidence (2026-11-13 23:34 UTC): Booking.com Demand search distinguishes explicitly empty, priced, and missing/incalculable conditional charges. The UI preserves observed charge IDs, calculation modes, condition IDs, and `chargeable_online` flags without guessing their meanings or collection location. `npm test` passed 557/557; isolated production build passed; `npm audit --audit-level=low` found zero vulnerabilities; the controlled two-room production browser check passed with provider traffic intercepted and no browser errors. The loopback app returned HTTP 200 and same-origin health `ok`, queue depth 0, one live worker and nine stale historical worker records. No live Demand API credentials are configured, so this is implementation evidence only. [Details](docs/booking-demand-conditional-charge-disclosure-2026-11-13.md). Overall goal remains active and incomplete.

Latest P3 coverage audit (2026-11-13 00:30–02:16 UTC): the detailed live records confirm four alternate YHZ–Europe pairs and three YYZ–FRA round-trip alternatives were actually queried; these are not current quotes. One one-way split plan cost CAD 539 more than its through observation before extras; the round trip had only 2/6 exact ticket blocks priced and no complete plan. `IMPLEMENTATION-STATUS.md`, `HANDOFF.md`, and the P3 acceptance row in `work.md` now describe this evidence accurately. Seller issuance, concurrent inventory, child split fares, and transfer/mandatory costs remain unverified. See [one-way evidence](docs/separate-ticket-europe-live-2026-11-13-0030.md) and [round-trip evidence](docs/separate-ticket-roundtrip-live-check-2026-11-13.md).

Latest P3 UI correction (2026-11-13 23:50 UTC): the same-flight split panel now reports “No complete same-flight booking plan was priced” when its plan list is empty, rather than language that could imply supplier inventory was checked. The red/green production browser regression covers both a guardian-linked priced plan and a source-refused no-plan result. Full suite 557/557, isolated build, and zero-vulnerability audit passed. No live query was made. [Evidence](docs/party-comparison-no-plan-disclosure-2026-11-13.md). Overall goal remains active and incomplete.

Latest P5 source evidence (2026-11-13 23:16–23:45 UTC): the app observed Visa's public Canadian offer and general terms, while a separate official-source review confirmed those pages omit Booking.com promotion dates, property/rate eligibility, credit timing/calculation, and cancellation terms. The Visa link to Booking.com reached a JS/robot-verification page; no challenge was attempted. Costco's normal public-page request was blocked and not retried. No discount or member/card eligibility was inferred. See [member evidence](docs/member-offer-checks.md) and the [official terms audit](docs/visa-booking-travel-credit-terms-2026-11-13.md). The overall `work.md` goal remains active and incomplete.

Latest P13 evidence (2026-11-13 23:01 UTC): current production Chromium measured 80 initial-page touch targets at 320px and 1280px; all met 24×24 CSS pixels, including the focused skip link. Dynamic states and physical devices remain open. See [audit note](docs/p13-touch-target-audit-2026-11-13.md). Overall goal remains active and incomplete.

Latest P6 evidence (2026-11-13): the ACV result page now discloses that its widget does not provide adult assignment per room for adult-only multi-room totals. Focused package tests passed 23/23; controlled loopback Chromium passed with providers intercepted (0 provider calls). Fresh full verification passed `npm test` 556/556, an isolated production build, and `npm audit --audit-level=low` with zero vulnerabilities. The full package acceptance remains open for room-level allocation, equivalent properties, current availability, fees, and checkout. See [evidence](docs/acv-adult-multiroom-allocation-disclosure-2026-11-13.md). The overall `work.md` goal remains active and incomplete.


Latest implementation checkpoint: 2026-11-13 22:57 UTC. P13 responsive reflow now wraps the search-summary pill under enlarged text and spacing overrides. Production Chromium passed; full tests 555/555; build passed; audit 0 vulnerabilities. The refreshed local site is running at `http://127.0.0.1:3000` with healthy local API status. Overall objective remains active and incomplete. See [P13 evidence](docs/p13-text-spacing-reflow-2026-11-13.md).

Latest checkpoint: 2026-11-13 22:46 UTC. Current-tree verification passed `npm test` 555/555, isolated production build, `npm audit --audit-level=low` (0 vulnerabilities), and controlled production-browser Flight + Hotel/room-handoff checks. The objective remains active and incomplete. See [`docs/current-tree-verification-2026-11-13-2246.md`](docs/current-tree-verification-2026-11-13-2246.md) for exact scope and limitations.

## P8 exact outside-selected pair counts — 2026-11-13 22:34 UTC

Regional pair search now accounts for the full resolver-returned code sets and reports exact outside-selected pair counts; large results use a bounded code-set representation. Controlled 40×40 case: 1,600 possible, 16 selected, 1,584 omitted. Tests 555/555, build, audit and UI check passed. This does not prove resolver completeness or fare coverage; [details](docs/region-pair-coverage-bounds-2026-11-13.md).

## P11 calendar coverage update — 2026-11-13 22:27 UTC

Calendar completed results now list all resolver-returned omitted airport codes; progress keeps a marked 20-code sample. Resolver-hidden airports and provider/date exclusions remain bounded and disclosed. The 44 focused calendar tests, 554 full tests, isolated production build, audit, and controlled UI check passed. This does not close the full calendar or geography criteria; [evidence](docs/calendar-full-airport-omissions-2026-11-13.md).

## P8 all-region resolver recheck — 2026-11-13 22:16 UTC

All 28 work.md regions resolved through the production cached resolver; no fare sources ran. Counts matched the previous audit; Europe returned 100 of 843 known airport candidates, excluding 261 outside the documented coordinate box and excluding LHR/CDG/MAD from the selected candidate list. Cached source timestamps are recorded in the [audit](docs/region-resolver-recheck-2026-11-13-2216.md). This is not exhaustive airport or fare coverage; P8 remains Partial.

## P7 seller verification recheck — 2026-11-13 22:10 UTC

One fresh Canadian CAD Ignav website query and owner-bound handoff matched YYZ–YUL Dec 18 at provider-reported CAD 233. The returned Porter link yielded HTTP 403 / `Just a moment...` to one normal GET. No challenge interaction or bypass occurred. Seller availability, baggage, fees and checkout price remain unverified, so P7 stays Partial. See [evidence](docs/ignav-live-p7-seller-recheck-2026-11-13-2210.md).

## P9 provider configuration recheck — 2026-11-13 22:00 UTC

The current loopback capability endpoint reports Ignav, Google, ITA Matrix and Expedia via Omkar eligible for a one-adult/economy YHZ–YYZ one-way query; Expedia partner API, Skyscanner and Air Canada NDC are unconfigured. No fare source was queried. Configuration does not establish permitted use, inventory or seller pricing. P9 remains Partial; see [snapshot](docs/provider-capability-snapshot-2026-11-13.md).

## P6 package-party UI recheck — 2026-11-13 22:01 UTC

The rebuilt site passed its controlled package-party check: child/infant searches remain limited to one room, infant DOB stays in the browser, provider calls were intercepted, and no browser errors occurred. The previously observed widget limitation still prevents multi-room child packages; no separate packages are combined. P6 remains Partial for live occupancy acceptance, property/address matching, availability, fees, and checkout. [Evidence](docs/acv-party-ui-recheck-2026-11-13.md).

## P4 count-based child Flight + Hotel UI — 2026-11-13 21:53 UTC

The flight result now offers **+ Hotel** for a validated count-based child party with actual child ages entered. The rebuilt loopback browser check passed a controlled two-room child occupancy search and showed only a fixture subtotal (CAD 1,530; CAD 510 per traveler). No live hotel query was made; room availability, fees and seller total remain open. Focused tests passed 30/30; build passed; audit found 0 vulnerabilities. The first full-suite run alongside the build timed out one unrelated worker test (552/553); the test passed alone, then the clean full rerun passed 553/553 in 122.9 seconds. See [evidence](docs/flight-hotel-count-based-child-ui-2026-11-13.md).

## P13 current UI evidence — 2026-11-13 21:34 UTC

Against the current production loopback site, accessible-controls, responsive-ui, and theme-contrast checks passed. The UI has 112 named controls, eight labeled fieldsets and 85 traversed keyboard targets; no overflow at 320/375/768 CSS pixels; light-theme preference survives reload; 162 visible text samples per theme passed contrast sampling. No provider traffic or search was allowed. These checks are not a WCAG/assistive-technology audit. See [updated evidence](docs/ui-quality-smoke-checks-2026-11-13.md).

## P2 United policy source recheck — 2026-11-13 21:35 UTC

The current United Airlines customer child/UM pages again provided no readable policy content: the page viewer showed a JavaScript shell, and normal headless browser attempts failed with HTTP/2 errors before content. No challenge or restricted path was used. Keep United's advisory `unverified`; exact rules require accessible first-party documentation. [Evidence](docs/united-policy-access-recheck-2026-11-13.md).

## Current audit and P7 live handoff — 2026-11-13 21:21–21:29 UTC

Current Expedia code already derives elapsed journey duration from validated offset-aware first departure and final arrival timestamps, including layovers. `node --test tests/expedia.test.mjs` passed 8/8. The traveler/guardian/carrier/split suites passed 96/96; live eligibility remains unverified. The first read-only job-store check found no fresh handoff quote, so no request was made then. A later single real website-to-worker YYZ–YUL Dec 16 one-way economy Ignav search returned 23/23 accepted prices; the owner-bound handoff matched the selected fresh CAD 169 provider observation. Seller availability was `not_checked`, baggage absent, mandatory charges `not_itemized`, seller timestamp absent and link specificity unknown. No seller URL, checkout, reservation or purchase was opened. See [P1/P2 audit](docs/current-audit-2026-11-13-2121.md) and [P7 live handoff](docs/ignav-live-p7-handoff-2026-11-13-2128.md).

Current verification: `npm test` 552/552; `npm run build` passed; `npm audit --audit-level=low` reported zero vulnerabilities; production browser checks `check:flight-default` and `check:booking-links` passed, provider operations intercepted in the controlled checks, with zero browser errors/CSP violations. Live handoff/browser observations were separately bounded as described above. The broader `work.md` scope remains incomplete.

## P6 fresh live ACV package check — 2026-11-13 21:12–21:15 UTC

The running local website and worker completed a real ACV query with provider-selected Halifax, Barcelona city and BCN airport; one adult plus exact age-7 child; one room; Apr 15–25, 2027; four-star minimum, ≤2 stops and 20-result cap. It rendered 20 supported estimated package observations from 20 panels; more remained beyond the cap. Example observations: CAD 3,235.54 and CAD 5,890.92. Health afterward was `ok`, queue 0, worker available; focused ACV tests passed 28/28. This demonstrates one query path, not seller checkout, child acceptance, exact room/property, all charges, all pages, or multi-room children. [Evidence](docs/acv-live-package-check-2026-11-13.md).

## P0 Skyscanner timezone/duration integrity — 2026-11-13 20:58–21:02 UTC

Normal Skyscanner search and refresh now mandate airport-timezone evidence on the server, load it before provider requests, validate segment chronology in UTC, and require source duration to match elapsed UTC time including layovers. The client cannot disable refresh validation. Regressions cover missing evidence, attempted bypass, duration mismatch, and valid date-line arrival. Verification: full suite 552/552, isolated production build, zero-vulnerability audit, and two controlled production Chromium checks passed; all provider calls were intercepted. No live source evidence. This resolves that one implementation gap but not live seller validation or the overall `work.md` acceptance criteria. [Evidence](docs/skyscanner-timezone-integrity-2026-11-13.md).

## P5 current public member-source recheck — 2026-11-13 21:05 UTC

The paced application checker freshly observed CAA Atlantic public hotel information plus membership terms, and Visa Infinite's public future-stay-credit offer plus general terms; neither proves traveler eligibility or a comparable property/date rate. Costco's current-deals page remained `blocked` after one request beyond its cooldown and returned a new retry time of 21:15:59 UTC. No listing was counted or discount applied; no further request was made. [Evidence](docs/member-offer-checks.md).

`node --test tests/member-offers.test.mjs` passed 15/15; these offline tests verify fail-closed parsing and pacing, not account eligibility or current inventory.

## P0 flight-result completeness gate — 2026-11-13 20:31 UTC

Complete flight-price cards now require identified provider/source/traveler scope and exact segment evidence (connected route, carrier and flight identifiers, timestamps, and matching displayed endpoints/times). Route-only Google results without segments fail closed; incomplete Matrix rows remain price-only observations. At this 20:31 checkpoint `npm test` passed 551/551; isolated production build, audit and controlled Chromium checks passed. The Skyscanner timezone gap named here was closed by the 20:58 follow-up; other worker schemas, live source verification, and seller checks remain open. [Segment evidence](docs/strict-flight-offer-validation-2026-11-13.md); [Skyscanner follow-up](docs/skyscanner-timezone-integrity-2026-11-13.md).

## P0 live backend adapter check — 2026-11-13 19:09 UTC

One exact Canadian YYZ–YUL Dec 15 one-way economy, one-adult query through the real local job API/worker and Ignav returned 20 CAD offers; 20/20 passed shared validation. Lowest observation: CAD 169 on WS 916. A separate Dec 16 Chromium UI query rendered 23/23 real Ignav offers, CAD 169 first. Together these establish one live UI-to-worker-to-provider result path. Seller availability and all-in charges remain unverified; other date/party/source shapes and broader coverage remain open. [Evidence](docs/ignav-live-yyz-yul-2026-11-13.md).

Follow-up 19:11 UTC: real Chromium submitted YYZ–YUL Dec 16, one-way/economy/one adult/Ignav. The UI rendered 23 observed fares, all 23 usable, CAD 169 first; no page errors or off-origin browser requests. This verifies one live website-to-worker-to-provider-to-card path, not all query shapes, seller bookability, fees, or broad coverage. [Combined evidence](docs/ignav-live-yyz-yul-2026-11-13.md).

## P12 retry-time status UI and current verification — 2026-11-13 19:04 UTC

Queued flight/calendar/comparison jobs expose persisted `retryAt`; each corresponding status UI renders the recovery schedule. Controlled Chromium directly verified flight and comparison notices; the calendar view still lacks its own browser assertion. Full tests passed 551/551, isolated production build passed, audit found zero vulnerabilities. Latest controlled retry-status/default-flight browser checks passed at 19:04; accessible-controls passed at 18:50. Provider calls were intercepted; no search was started. The local production app/worker at `http://127.0.0.1:3000` report health `ok`, queue 0, one live worker, no expired leases/deadlines, and nine stale historical records. P12 remains Partial, and the complete `work.md` goal remains active. See [current evidence](docs/worker-recovery-retry-ui-2026-11-13.md).

## P12 durable worker-recovery backoff — 2026-11-13 05:52 UTC

Expired flight/comparison/calendar worker leases now requeue with durable exponential delays (1s, then 2s, capped at 30s); repeated crashes remain bounded at two recoveries before the job fails. SQLite restart retains the scheduled delay and prior checkpoint, and stale lease tokens cannot publish. Package/hotel browser-session leases still fail rather than replaying an unrecoverable browser. Intentional pause/resume is unchanged. `npm test` 551/551; isolated production build passed; audit 0 vulnerabilities; disposable backup/restore drill passed with no provider calls. Local production server and worker were restarted; root and same-origin health pass, queue 0, one live worker, no expired leases/deadlines. P12 remains Partial. Evidence: [worker recovery backoff](docs/worker-recovery-backoff-2026-11-13.md).

Local state at 05:52 UTC: current production build is running at `http://127.0.0.1:3000`; health `ok`, queue depth 0, one live worker, nine stale historical worker records, zero expired leases/deadlines. No search was started.


## P13 keyboard skip link — 2026-11-13 05:41 UTC

Added the first-keyboard-stop skip link to Flight Search. Fresh isolated-production Chromium checks verified first Tab focus, Enter focus transfer, dynamic airline suggestions announced/operated by keyboard with state exposed; 85 rendered-order Tab targets traversed (native date input internal steps allowed); responsive 320/375/768px widths, and accessible-control integrity. Theme contrast sampled 162 visible text items per theme with no failures. Full tests passed 550/550, production build passed, audit found zero vulnerabilities. All provider traffic was blocked. At 05:30 UTC the local production site was restored at `http://127.0.0.1:3000`; operational health showed one live worker, queue depth zero, and zero expired leases/deadlines. Nine historical worker records are stale. P13 and the overall project remain partial; actual browser zoom, assistive-technology checks, and all other open `work.md` criteria remain outstanding. Evidence: [P13 skip-link note](docs/p13-keyboard-skip-link-2026-11-13.md).



## P4 check-in age reset and identified-party coverage — 2026-11-13 05:16 UTC

Hotel check-in child ages no longer carry forward from a prior stay when the selected flight party changes. The extended browser check validated a DOB-identified age-7 child: age 8 was blocked, age 7 was accepted, and DOBs were not sent to the hotel job. It also verified count mismatch rejection and existing room/stale-job behavior. Full suite 550/550, isolated production build and audit passed; two controlled hotel browser checks passed. No live query; hotel availability, room equivalence, fees and seller totals remain open.

## P4 selected-flight hotel party matching — 2026-11-13 04:57 UTC

The Flight + Hotel UI blocks a hotel guest total that does not match its selected flight. When DOBs are supplied, it validates check-in adult/child categories and exact ages; count-only parties match total size and require the traveler to provide actual stay ages. Controlled browser party-reset and exact two-room child occupancy checks passed with intercepted providers and zero page errors. Full suite 550/550, build and audit passed. No live hotel query; P4 remains Partial for live inventory, room equivalence, charges and seller totals.

## P4 hotel failure and room coverage semantics — 2026-11-13 04:45 UTC

Hotel provider failures are distinct from inventory: known source states are preserved, generic failures are `error`, and planned rooms after an early stop are `not_searched`. Coverage distinguishes failed, attempted and unattempted rooms. Focused hotel/comparator tests 27/27, full suite 550/550, isolated build and audit (0 vulnerabilities) passed. No live query. P4 and §17 remain Partial for real availability, equivalent room inventory, complete charges and seller totals.

## P2 carrier-to-segment role mapping — 2026-11-13 04:35 UTC

Child/youth carrier advisories now name which outbound/return segment each marketing or operating carrier role covers. Recognized segment names still work without codes; missing/malformed identity remains disclosed. Focused carrier tests 40/40, full suite 549/549, isolated production build and audit (0 vulnerabilities) passed. Controlled Chromium verified the rendered mapping and missing segment, with provider/job calls intercepted and external requests blocked. Local production health is `ok`, worker available, queue 0. No fare query. P2 remains Partial.

## P2 per-segment carrier name resolution — 2026-11-13 04:17 UTC

Recognized airline names on individual segments now produce source-linked guidance when codes are absent, preserving operating/marketing roles. Missing or malformed identities remain disclosed and eligibility stays `unverified`. Focused carrier tests 40/40, full suite 549/549, isolated build and zero-vulnerability audit passed; controlled Chromium verified the warning with provider requests intercepted and external requests blocked. Local root/health were HTTP 200/`ok`, queue 0, worker available. No fare query. P2 remains Partial. [Evidence](docs/carrier-age-guidance.md).

## P2 mixed-itinerary carrier identity disclosure — 2026-11-13 04:05 UTC

Fixed an omission in child/youth advisories: every segment is checked for marketing/operating identity, and missing roles are explicitly named by direction and segment. Known carrier rules stay labeled `unverified` and do not cover unidentified segments. API regression and loopback `check:party-partition` passed with provider/job requests intercepted and external traffic blocked. Full suite 548/548, isolated build, and audit (zero vulnerabilities) passed; local root/health returned 200/`ok`, queue 0, worker available. No fare query. P2 remains Partial. [Evidence](docs/carrier-age-guidance.md).

## P5 current promotion checks — 2026-11-13 03:27 UTC

Visa's current public offer and general terms were observed through the local paced source checker; the future credit and general card conditions are not a trip-specific discount or proof of this user's eligibility. Costco's current-deals page returned `blocked`; it was not retried or bypassed. No discount was applied. The fixture-backed member UI browser check passed with source requests intercepted; the live Costco result remains blocked. [Evidence and limits](docs/member-offer-checks.md#current-public-source-recheck--2026-11-13-0327-utc).

## P7 seller-check harness update — 2026-11-13 03:06 UTC

The read-only Ignav seller-handoff helper now targets explicit exact route/date/one-way or return queries instead of the stale hard-coded Nov 12–19 round trip. It remains limited to one adult in economy without children and selects only a fresh matching CAD quote; it makes no handoff call when none exists. Tests 4/4, `npm test` 547/547, isolated production build and `npm audit` (zero vulnerabilities) passed. A bounded YHZ–LAX Dec 15 live search returned `temporarily_unavailable`; no seller request or retry followed. P7 and §17 remain partial. [Evidence](docs/ignav-live-p7-availability-attempt-2026-11-13.md).

## P7 live seller-handoff prerequisite attempt — 2026-11-13 03:05 UTC

A bounded YHZ–LAX Dec 15, one-adult/economy Ignav search returned `temporarily_unavailable`, with no fare. No seller handoff or manual retry followed. The local app recovered healthy. This does not establish no inventory and provides no seller availability, baggage, fees or checkout evidence. [Details](docs/ignav-live-p7-availability-attempt-2026-11-13.md).

## P4 selected-flight room-state isolation — 2026-11-13 02:52 UTC

Fixed hotel room/age allocations persisting when the selected flight changed, and prevented a prior hotel result from appearing against a different flight. The controlled browser regression submitted two rooms with adult ages 39/37 for YYZ–FRA, switched to YYZ–BCN, and confirmed one room, zero allocation fields, a stale-result notice, and zero page errors; all provider and job calls were intercepted. `npm test` passed 546/546, isolated production build passed, `npm audit` found zero vulnerabilities; site HTTP 200 and worker available. This establishes UI state isolation only. P4 and §17 remain partial pending live hotel inventory, partner access, fees, and simultaneous availability. [Evidence](docs/hotel-flight-party-reset-2026-11-13.md).

## P3 bounded YYZ–FRA round-trip check — 2026-11-13 02:03–02:05 UTC

One local all-source search returned 183 Ignav fare records and 15 accepted Matrix price observations; Google failed its native return evidence check and other round-trip adapters were unavailable/unsupported. The lowest selected Ignav itinerary was CAD 1,591, two segments each way. Its exact contiguous-block refresh/comparison used 7/20 requests, zero alternate airport pairs; only two of six blocks were priceable, yielding no complete split plan. The same-pair refresh found 182 matching alternatives, with only eight shown and provider completion false. P3 remains Partial. [Evidence](docs/separate-ticket-roundtrip-live-check-2026-11-13.md).

Added per-block flight identity, timestamps, fare request and accepted-quote counts, and bounded source responses to separate-ticket job output, with an expandable UI summary that distinguishes “no qualifying quote” from “unavailable inventory.” Focused tests 31/31, full suite 545/545, controlled browser check passed, isolated production build passed, audit zero vulnerabilities. The active app remains healthy locally. P3 and §17 stay open for complete exact-flight quotes, seller evidence, fees/baggage and inventory continuity.

A bounded 12-request round-trip continuation searched exactly YYZ–FCO, YYZ–BCN and YYZ–MUC: all three returned; 10 total fare requests, 413 matching alternatives (8 shown, 405 omitted), provider completion false. Only BA98+BA906 outbound and TP261 inbound-alone priced against the selected exact chain; 4/6 blocks were unpriced, and no plan/savings resulted. The status wording now says `unpriced`. [Full evidence](docs/separate-ticket-roundtrip-live-check-2026-11-13.md).

Final post-label verification at 02:23 UTC: focused tests 31/31, full suite 545/545, separate-ticket browser check passed with provider routes intercepted, isolated build passed, audit zero vulnerabilities. Local site HTTP 200; worker healthy, queue empty, no expired leases/deadlines.

Added ticket-block coverage to early refusal and budget-failure results: status distinguishes priced, unpriced after a request, and not searched; provider refusal details persist. The failure-path regression and browser disclosure pass; final full suite 545/545, isolated build, and audit passed. P3 remains open for seller/live-inventory verification and complete exact-flight pricing.

Partial split-party blocks now separately report when some group fares qualified before the provider stopped. Final verification at 02:36 UTC: focused 32/32, full suite 546/546, browser fixture, isolated production build, and zero-vulnerability audit passed. Local health: HTTP 200, worker `ok`, queue 0.

**Repository:** `/home/rayyan/Projects/travel-hunter-pro`  
**Status:** **Active (resumed by explicit user directive on 2026-11-08).** Acceptance is incomplete; this is not a completion declaration.  
**Acceptance authority:** `work.md`, especially §17.  
**Continuation guide:** [`handoff.md`](handoff.md).

## P13 web settings and accessibility evidence — 2026-11-13 01:18 UTC

Fresh loopback Chromium checks found 112 named controls with no unnamed/duplicate/broken references, eight labeled fieldsets, working keyboard disclosure, no overflow at 320/375/768 px, restored light-theme preference, and no contrast failures in 161 visible samples per theme (min 5.27:1 dark, 5.53:1 light). Matrix settings and one airline suggestion were shown with provider calls intercepted. `check:flight-default` passes on dev and production after tightening its nonce/CSP audit around Next devtools; app violations were 0. These checks do not prove full WCAG/device support; P13 remains partial. See [UI evidence](docs/ui-quality-smoke-checks-2026-11-13.md).

## P11 incremental all-offer rendering — 2026-11-13 01:05 UTC

Each calendar date now keeps and displays every validated fresh offer received so far while the job is running; the highlighted best price updates as later responses arrive. The browser regression showed CAD 500 and CAD 510 during the running state, followed by CAD 400 at completion. `npm test` passed 542/542, isolated build passed, and audit found zero vulnerabilities. This is controlled UI evidence and made no live provider call. Existing one-second polling shows an accepted result on the next poll; the provider must first finish its own response. P11 remains Partial because regional searches, source coverage and seller verification remain incomplete. See [the evidence note](docs/calendar-all-offers-streaming-2026-11-13.md).

## P11/P12 live calendar and database-poll fix — 2026-11-13 00:36–00:41 UTC

One real YYZ→Europe all-source calendar covered four selected airport pairs with a 16-request cap and returned a price-only CAD 516.62 ITA Matrix observation; Omkar failed on every pair, and coverage stayed incomplete. One status poll hit SQLite `database is locked`. Reduced write amplification in `job-store.get()` by throttling global expiry cleanup and updating only expired requested jobs. The regression failed before and passed after; job-store tests 18/18, focused error/job-store tests 29/29, and final full suite 541/541. SQLite busy/locked errors now return generic 503 with `Retry-After: 1`. `npm audit fix` updated Hono 4.13.14→4.13.18; audit reports zero vulnerabilities and the isolated production build passes. Final local smoke at 00:53:34 UTC: site HTTP 200; health `ok`, one live worker, empty queue, and no expired leases/deadlines. See [`docs/calendar-multi-airport-live-2026-11-13.md`](docs/calendar-multi-airport-live-2026-11-13.md). Goal remains active and §17 incomplete.

## P3 bounded live Europe route check — 2026-11-13 00:30–00:31 UTC

A live YHZ–FRA Dec 15 Ignav comparison queried four alternate Europe pairs within an 8/12 request budget. It reported four of nine pairs searched, five unsearched, 57 matching alternatives returned (8 shown), and provider completeness false. The best completed split plan was CAD 1,532 versus CAD 993 through, CAD 539 higher before extras. No seller check or purchase. P3 remains partial. Details: [`docs/separate-ticket-europe-live-2026-11-13-0030.md`](docs/separate-ticket-europe-live-2026-11-13-0030.md).

## P1 Expedia duration recheck — 2026-11-13 00:28 UTC

The current Expedia adapter uses validated, offset-aware segment timestamps and computes elapsed duration from the journey's first departure to final arrival. The regression passed 8/8, including layovers and invalid chronology/offset cases (`node --test tests/expedia.test.mjs`). This is fixture evidence; Expedia credentials remain unconfigured and the Omkar live endpoint previously returned HTTP 500. P1 remains partial until live provider evidence exists.

## P7 fresh YHZ–LAX handoff evidence — 2026-11-12 20:22 -04

One owner-bound read-only Ignav handoff matched the fresh CAD 302 YHZ–YYZ–LAX observation and complete outbound leg. It returned five provider-priced seller choices, but link specificity is unknown and the response did not refresh the quote. Availability, baggage, mandatory charges, seller timestamp and booking remain unverified. No seller URL was opened. P7 remains partial; see [`docs/ignav-live-handoff-2026-11-12-2022.md`](docs/ignav-live-handoff-2026-11-12-2022.md).

## P10 Cloudbeds access review — 2026-11-12 23:55 UTC

Cloudbeds documents guest links with dates and adult/child counts, but its inventory API needs an authorized integration and property-granted access. A read-only GET confirmed a public guest page only; no four-star inventory or exact-age/multi-room pricing was demonstrated. No adapter was added. Reservit remains the only configured hotel engine. See [the access note](docs/cloudbeds-official-hotel-access-2026-11-12.md); continue with independent implementation work.

## P8 region resolver coverage — 2026-11-12 23:55 UTC

All 28 named regions resolved successfully from the current cached OurAirports/Wikidata snapshots and live M49 catalog. Airport output is capped at 100 per region and most regions have additional known candidates; Europe has the documented top-three and coordinate exclusions. No fare sources or calendars ran. See [the dated counts and limits](docs/region-airport-coverage-2026-11-12.md). P8/P11 remain open pending bounded airport-pair and live calendar evidence.

## P8/P11 resumed regional calendar sample — 2026-11-12 20:01–20:07 -04

Completed the nine remaining one-pair regional calendar jobs. Together with the prior 19, all 28 labels now have a bounded sample: 27 produced a dated observed fare; Greenland & St. Pierre did not. Every job is incomplete because Expedia via Omkar returned HTTP 500; each region's other airports, provider gaps and all seller/checkout requirements remain open. See [the full audit](docs/calendar-region-live-audit-2026-11-09.md).

## P8 calendar popularity-exclusion UI disclosure — 2026-11-12 20:15 -04

`FareCalendar` now displays the popularity-excluded airport codes/names and ranking count/shortfall already carried by its region coverage response. Red/green Chromium regression passed; full tests 539/539, build passed, audit zero. Regional and seller coverage remain partial.

An actual YYZ→Europe local-site Chromium submission showed selected FRA/FCO/BCN/MUC and excluded LHR/CDG/MAD before the first pair; the check was cancelled at 0/4 pairs without fare requests. Existing live regional fare evidence remains bounded and incomplete.

## P3 fresh exact-flight comparison — 2026-11-12 20:20 -04

One fresh Ignav YHZ–LAX observation compared a CAD 302 through itinerary against CAD 194 + CAD 273 for its exact two segments (CAD 467 total, no savings before extras), within 3/12 searches. Same-flight matching and chronology were validated; seller availability/issuance, fees, baggage and inventory continuity remain unverified. The quote expired at 00:35:48 UTC. See [dated evidence](docs/separate-ticket-live-check-2026-11-12-2020.md).

## P7 live Ignav handoff follow-up — 2026-11-12 23:30 UTC

A single read-only handoff request matched the fresh YYZ–FRA CAD 760 selected itinerary and returned two outbound seller options (CAD 760 / CAD 860). The response still leaves availability unchecked, baggage absent, mandatory charges unitemized, and seller refresh time missing; no seller URL was opened. P7 remains partial. See [dated evidence](docs/ignav-live-yhz-lax-2026-11-08.md).

## P7 Google price-only page check — 2026-11-12 23:48 UTC

The fresh Google YYZ→FRA Nov 14 CAD 760 source observation linked to a Google-hosted page returning HTTP 200; visible text included route, date and `760`, but the page currency and exact flights were not verified. Thirteen non-GET/off-host requests were blocked. No challenge or interaction occurred. This is not seller availability or a checkout quote; P7 remains open. See [dated evidence](docs/google-handoff-live-2026-11-12.md).

## Progressive calendar UI consistency fix — 2026-11-12

Visible calendar prices now show their observation time and seller-verification limits. Partial progress no longer says “0 fare observations checked” beside a streamed offer; the browser regression passes. Full suite passed 539/539 after a concurrent build had caused one timing-sensitive worker test to fail once; the isolated calendar-worker file passed 7/7. Build passed and audit found zero vulnerabilities. See [calendar evidence](docs/calendar-progressive-results-2026-11-12.md).

## P12 dependency audit follow-up — 2026-11-12 23:13 UTC

Updated the lockfile-resolved transitive `@hono/node-server` from vulnerable 2.1.5 to 2.1.8. Afterward, `npm audit` found zero vulnerabilities, the full suite passed 539/539, the isolated build passed, and the package occupancy UI check made zero supplier calls. Same-origin health showed one live worker and an empty queue. This does not clear deployment gates. See [audit evidence](docs/dependency-audit-2026-11-12.md).

## P6 current live package evidence — 2026-11-12 23:01 UTC

The live ACV website/worker completed a bounded YHZ–Barcelona child search (one adult, age-7 child, one room, Apr 15–25 2027): 20 cards/panels inspected, 19 supported offers, with more listings beyond the 20-result cap. The amounts are observed estimates only. Property address, room/child acceptance, mandatory/local charges, checkout refresh, and multi-room child support remain open. A temporary inline evidence collector errored after the search; the completed results were recovered from the persisted job. See [dated evidence](docs/acv-live-package-check-2026-11-12.md). P6 remains Partial.

## P2 United carrier-policy recheck — 2026-11-12

Official United customer policy pages still expose only a JavaScript shell through the available public viewer, and the accessible booking page only links to them. The advisory now states that exact ages, infant seating, UM eligibility, route rules and fees are unverified without asserting a threshold. United Vacations and partner sources were excluded. See [dated source evidence](docs/united-policy-access-recheck-2026-11-12.md); P2 remains partial pending usable first-party policy text.

## P12 local-stack smoke-check isolation — 2026-11-12

Fixed the recovery check's collision with an already-running Next dev site by isolating its temporary Next output directory. The smoke check passed without stopping the current site; the full suite passed 539/539, build passed, and audit found zero vulnerabilities. This does not pass public deployment gates. See [implementation status](IMPLEMENTATION-STATUS.md) and [dated evidence](docs/local-stack-smoke-check-2026-11-12.md).

## Progressive calendar live progress check — 2026-11-12

A bounded YYZ→Europe all-compatible calendar initially showed a still-fresh earlier observation. After the UI fix, a new Chromium run displayed a contemporaneous Google Flights CAD 760 YYZ→FRA quote at 23:45:45 UTC while four provider requests were underway and 0/7 date combinations complete; it showed the observation time and provisional status without a contradictory zero count. The run was cancelled after the first cell, leaving six dates unsearched. Coverage, seller availability and current checkout price remain open. See [dated evidence](docs/calendar-progressive-results-2026-11-12.md).

## P5 Costco public deal coverage — 2026-11-09 01:26 UTC

Added an independent Costco Travel current dated-offer check alongside membership terms. The real paced application fetch observed a Virgin Voyages public listing with booking deadline 2026-11-25. Same-host official offer URLs and live future deadlines are required; eligibility and trip-level cost remain unverified, and no discount is applied. Focused tests passed 15/15; full suite 536/536, production build and audit passed; rebuilt member-offers UI, accessibility and separate-ticket checks passed with provider requests intercepted. P5/§17 remain Partial. See [member-offer evidence](docs/member-offer-checks.md).

## P3 route-pair coverage correction — 2026-11-09 01:02–01:17 UTC

The bounded live YHZ–LAX Ignav comparison used 7/10 requests, searched YUL–LAX and YYZ–LAX, found no complete separate-ticket plan, and returned incomplete provider coverage; all counts and fare limits are documented in [the evidence note](docs/separate-ticket-live-check-2026-11-09-0102.md). Fixed coverage reporting to distinguish pair requests attempted, provider responses without a stop, stopped pairs, and unattempted pairs. Rate-limit regression and UI fixture check added. Full tests passed 534/534, production build passed, audit found zero vulnerabilities, rebuilt loopback results check passed. Seller availability, baggage, charges, simultaneous inventory, exact issuance, and all P3/§17 acceptance remain open.

## P2 exact-age safety regression — 2026-11-09 00:56 UTC

Added a separate-ticket regression proving a lap infant who turns two between departure and arrival of an overnight segment is not quoted under the lap-infant category; the optimizer records the exclusion and sends no ticket-block fare request. Focused traveler/carrier/separate-ticket tests passed 78/78; full `npm test` passed 533/533; production build passed; `npm audit --audit-level=low` found zero vulnerabilities. This proves fail-closed code behavior only. A 00:53 UTC recheck of United's two official child-travel pages returned JavaScript-required shells, so no United rules were inferred. P2 and §17 remain Partial; carrier and seller acceptance remain open. See [United access note](docs/united-policy-access-recheck-2026-11-08.md).

## Previous implementation — 2026-11-09 00:26 UTC

Fixed Europe popularity-coverage disclosure through the merged resolver and the Wikidata-outage path. The merged result now carries the limit, ranked count, and shortfall; when Wikidata is unavailable it reports zero ranked candidates and a 3-of-3 shortfall. Bumped the region cache namespace to v12. Regressions failed before the changes. Full `npm test` passed 531/531; build passed; audit found zero vulnerabilities; rebuilt loopback `check:region-coverage` passed with provider/job calls intercepted. No live lookup occurred. P8 coverage and overall §17 acceptance remain open.

## Latest source check — 2026-11-09 00:42 UTC

One bounded one-way YHZ–LAX economy invocation of the configured Expedia-via-Omkar adapter ended with HTTP 500 before results. No timestamp/duration evidence was available. The shared safe-fetch policy can retry a 5xx once; this direct call was outside job transport metrics, so the actual HTTP attempt count is unknown. No additional manual invocation was made. The adapter remains tested for offset-aware end-to-end elapsed duration including layovers, but live Expedia duration and direct Expedia partner access remain unverified. See [the probe note](docs/omkar-expedia-live-duration-2026-11-09.md).

## Latest live evidence — 2026-11-09 00:32 UTC

One bounded local-worker Ignav query for YHZ–LAX, Nov 12–19, round trip, one adult, no children, economy returned 42 fares and accepted 32. Lowest fresh observed fare: CAD 1,033 at `2026-11-09T00:32:06.275596Z`. One read-only handoff matched and returned five provider-reported prices for both legs. Availability remains unchecked, baggage absent, mandatory charges unitemized, link specificity unknown and seller timestamp absent. No checkout/reservation/purchase occurred. Post-query health was `ok`, one worker, no queue or expired work. This is not Expedia verification or all-in seller confirmation. See [the evidence note](docs/ignav-live-yhz-lax-2026-11-08.md); P7/§17 remains Partial.

Follow-up seller-link probe (00:37 UTC): one Air Canada link reached an ACO error page without exact itinerary or prices. The read-only guard blocked 19 non-GET and seven off-domain requests, which may have interrupted redirection. No CAPTCHA appeared; no click or transaction was attempted. Treat as inconclusive. See the same evidence note.

## Historical live evidence — 2026-11-08 23:38 UTC

One authorized bounded Ignav YHZ–LAX round trip completed through the local app; exact-flight contiguous ticket comparison used 5/12 logical requests and produced two plans (CAD 1,176 and CAD 1,630) above the CAD 1,033 through observation. No alternate airport pairs were searched; the observation's quote window ended at 23:48:14 UTC and must be rechecked after expiry. Seller availability, issuance, baggage, charges, connection safety and protections remain unverified. See [the evidence note](docs/separate-ticket-live-check-2026-11-08-2338.md). This advances but does not satisfy P3/§17; continue implementation.

## Objective

Audit and complete the application against the current requirements in `work.md`. Preserve existing work, use real authorized sources for production behavior, and establish the actual state before relying on prior notes. Complete every actionable requirement. Where credentials, approvals, membership, paid access, or provider limitations prevent completion, record the exact blocker and continue independent requirements. The product remains local-only until public deployment security/recovery gates pass.

Do not claim complete based on fixtures, mocks, directory links, unconfigured adapters, stale observations, or estimated totals. Never invent ages or traveler eligibility, synthetic production fares, exhaustive geographic coverage, or simultaneous availability. Do not bypass CAPTCHA, create accounts, accept paid commitments, deploy publicly, reserve, or purchase without explicit authorization.

## Priority checklist

| # | Requirement | Current status | Completion evidence still needed |
|---|---|---|---|
| 1 | Expedia elapsed journey duration includes layovers from validated offset-aware timestamps. | Implemented for validated timestamps; live coverage partial. | Regression exists. The latest bounded Expedia-via-Omkar one-way request returned HTTP 500 before timestamps or fares; direct Expedia partner access is unconfigured. Recheck when an authorized source returns timestamp-bearing results; invalid/local-time-only shapes stay excluded from duration claims. |
| 2 | Exact-age travelers, infant seating, youth/child carrier eligibility and guardian-safe booking partitions. | Partial. | Fixture regression now proves a lap infant turning two during an overnight ticket block is not quoted as lap-held; it does not prove seller behavior. Live supplier/seller acceptance for exact ages, seat/lap status, age transitions, operating carrier, fare basis, guardian and UM rules remains open. United's current official policy pages still expose only a JavaScript shell. No assumed eligibility. |
| 3 | Bounded alternative route and separate-ticket optimization, contiguous blocks and round trips. | Partial. | Live exact-flight quotes, chronology, currency, party assignment, freshness, budget and complete searched/unsearched coverage; seller acceptance, transfer feasibility, charges and no unsupported inventory simultaneity claims. |
| 4 | Flight + Hotel for children/multiple rooms with room/property/destination/stay/fee/total validation. | Partial. | Authorized live partner evidence; equivalent room types, exact allocation, current availability, all mandatory/conditional fees, seller/checkout totals. Reservit links require age re-entry. |
| 5 | CAA, Costco, current Visa offers. | Partial; BCAA opt-in added but app fetch returns unverified JS shell. | Current offer terms + verified membership/card eligibility + comparable property/date/room/rate. No discount before verification. Broaden club coverage and resolve BCAA/AMA source access. |
| 6 | Air Canada Vacations live package search with verified locations, occupancy, filters, real results. | Partial. | Resolve children plus multi-room widget limitation; verify exact package/property, inclusions, availability, fees and checkout with seller. Current bounded one-room live observation is not checkout verification. |
| 7 | Seller handoff, itinerary, current availability, baggage, mandatory charges. | Partial. | Fresh exact seller response and explicit state for all required fields. A guarded Air Canada handoff-link GET ended at an ACO error page, but blocked non-GET/off-domain requests may have interrupted it; result is inconclusive. No purchase/reservation. |
| 8 | All work.md regions including overlap/transcontinental conventions. | Partial. | Validate aliases/policies and list every candidate/pair searched, omitted and unsearched; no exhaustive worldwide claim. |
| 9 | Approved provider trip/party support and agency integrations. | Partial. | Authorized access/credentials and real query evidence. Distinguish mocks, directory links and unconfigured adapters. |
| 10 | More official hotel engines than Reservit. | Partial. | Authorized sandbox/property access, real discovered property, tested source adapter, exact occupancy/currency/fees/availability and checkout comparison. |
| 11 | Exact fare calendars for multi-airport/region searches. | Partial. | Repeatable live queries preserving all constraints and bounded costs; suppress regional minimum when coverage incomplete. |
| 12 | Deployment-grade auth, ownership, abuse controls, monitoring, recovery, security. | Partial; local-only. | Local owner capabilities, quotas, CSP/SSRF boundaries, authenticated-encrypted backup/restore drills, and `.env.local` mode `0600` exist. Deployment threat review, independent key escrow, automated offsite schedule/retention, production restore, external monitoring/alerts, credential rotation/keyring storage and deployment SLO/security evidence remain open. Keep public deployment disabled. |
| 13 | Dark/light themes, live airline suggestions, accessible organized advanced controls. | Partial. | Controlled UI/accessibility/responsive/contrast smoke checks exist. Fresh exact-query Ignav jobs (2026-11-08 20:32–20:35 UTC) each received 39 results and applied include AC (16 retained), exclude AC (8), exclude CA (1), layover 90–360 min (14), max 720 min/direction (18), max price CAD 1,044 (1), nonstop only (0), and local departure 18:00–24:00 (0). Counts and filter-rejection metrics matched final offers. This is shared post-normalization filtering on fresh Ignav responses, not proof of provider-native enforcement or broader source consistency. Complete WCAG-relevant keyboard, screen-reader, zoom/reflow and browser/device testing remains open. |
| 14 | Reconcile docs with current code/evidence. | Documentation checkpoint updated; ongoing. | Maintain cross-document status/evidence after every code milestone; prove each applicable §17 criterion rather than relying on narrative claims. |

## Required work loop

For each feature, reproduce its current behavior, make the smallest complete implementation through all affected callers/UI/workers, add meaningful regression/integration coverage, and verify relevant APIs/browser behavior. Run `npm test`, `npm run build`, and `npm audit --audit-level=low` for substantive code milestones. For live evidence, use bounded authorized requests and redact private values. Keep historical notes dated and label stale evidence as historical.

## Latest verified implementation checkpoint

P5 public-source refresh (2026-11-09 00:09 UTC): the app's actual paced checker observed Visa's current Infinite page and linked general terms (`information_observed`, `general_terms_observed`, `eligibility: unverified`). The source still advertises up to 8%/USD 230 in future Booking.com Travel Credits, not a payable-price reduction. Booking-specific terms, exact stay/property conditions and user/card eligibility remain open; no discount was applied. BCAA's official Rewards API requires CAA National credentials and assigned offer privileges, absent from `.env.local`; the public portal shell remains unverified.

P6 live occupancy recheck (2026-11-09 00:04 UTC): the Air Canada Vacations widget retained two rooms while disabling Add child; returning to one room enabled an exact age-7 selection. No fare search or checkout was submitted. The rebuilt local package UI regression verifies two rooms + child shows the provider limit and starts no job, and the valid one-room child flow continues. `check:package-infant-guidance` passed with provider traffic intercepted. P6 remains Partial because the supplier does not support child/infant multi-room searches in the observed widget flow.

P2 continuation on 2026-11-08 23:58 UTC: the official Matrix search UI shows Adults (18–61) and Seniors (62+). Added a regression for the boundary: 61 maps to adults, 62 maps to seniors, and a 62nd birthday between round-trip dates is refused. Focused `node --test tests/ita-matrix.test.mjs` passed 24/24; full `npm test` passed 528/528; build passed; audit found 0 vulnerabilities. No fare/seller eligibility was asserted.

Historical P5 checkpoint (2026-11-08 23:50 UTC): a BCAA British Columbia/Yukon hotel-source opt-in was added. The official Rewards portal has current indexed hotel-offer content, but the app's actual safe fetch returns HTTP 200 with a 121-character JavaScript shell and no offer text. The checker remains fail-closed as `unverified`. The official CAA Rewards RLP API requires a CAA National-issued key and assigned offer privileges; no such credential variable is configured in `.env.local`. Focused member-source tests passed 13/13; full `npm test` passed 527/527; build passed; audit found 0 vulnerabilities; rebuilt loopback `check:member-offers` passed with requests intercepted; `check:accessible-controls` reported 109 named controls and no accessibility reference errors. P5 remains Partial; no discount was applied.


Historical checkpoint (2026-11-08 23:20 UTC): `npm test` 524/524 passed; build passed; audit reported zero vulnerabilities. Ignav normalization now requires every segment's provider-declared IANA airport timezone, local wall time, and UTC instant to agree; seller-handoff matching also includes local timestamps. The regression fails before and passes after the fix. Focused backend/worker tests passed 37/37, and rebuilt loopback `check:booking-links` passed with external requests blocked. No live supplier/seller request occurred during this increment. The provider timezone is not independently checked against an airport directory. A fresh exact YHZ–LAX one-adult Ignav query returned 42 accepted CAD offers, lowest CAD 1,033. One guarded read-only seller handoff matched that itinerary and returned five provider-reported airline prices. Seller availability remains unchecked, link specificity unknown, baggage absent, mandatory charges unitemized, and seller refresh timestamp absent. The booking-links UI now shows normalized seller-link hosts beside seller names; rebuilt fixture Chromium verifies matched price/host/caveats and mismatch suppression on the primary loopback page. United's current official U.S./Canadian child and unaccompanied-minor pages still expose only a JavaScript shell; no policy rules were inferred. No seller link, checkout, booking, account creation, CAPTCHA bypass, or public deployment occurred. Other §17 gaps remain open; this checkpoint is not completion. Details and exact commands are in [`handoff.md`](handoff.md), [`HANDOFF.md`](HANDOFF.md), [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md), and dated `docs/` records.

This checkpoint does not satisfy all of `work.md` §17. Continue from the specific open evidence listed in the current status matrix; do not treat the latest test suite as acceptance of live travel functionality.
## P2 TAP Air Portugal carrier guidance — 2026-11-13 01:25–01:39 UTC

Added `TP` recognition from segment codes and airline names plus source-linked advisory rules for child/infant seating and accompanying adults. TAP's UM age/companion wording differs by locale, so the result remains `unverified` and does not decide a specific itinerary or fare. Focused tests passed 2/2; carrier tests passed 38/38; final full `npm test` passed 545/545 in 142.0 seconds; isolated production build passed; audit found zero vulnerabilities. Updated loopback Chromium check confirmed TAP guidance and source links, with providers intercepted and zero browser errors. No live fare/seller check. P2 remains Partial. See [carrier age guidance](docs/carrier-age-guidance.md).

## P11 calendar provider-response progress — 2026-11-13 01:51–01:56 UTC

Added separate received-provider-response counts next to completed route/date batches. The browser now distinguishes a source reply from a fully completed exact airport-pair/date query while offers appear progressively. Rows deduplicate per provider/pair, ignore suppressed calls, and do not copy traveler details. Calendar tests 43/43; full suite 545/545; isolated production build and audit passed (zero vulnerabilities). Controlled Chromium confirmed streaming offers and the response counter, with provider/job traffic intercepted and zero browser errors. No live query. P11 remains Partial for live coverage and seller evidence.

## P4 running-job flight-switch safety — 2026-11-13

Expanded the hotel flight-switch browser regression to start a pending hotel search, switch selected flights, and verify the UI says the job still belongs to the previous flight and retains Cancel search. Provider/job traffic was intercepted; zero page errors. Full `npm test` passed 547/547; isolated `TRAVEL_NEXT_DIST_DIR=.next-hotel-flight-running-build npm run build` passed; `npm audit` found zero vulnerabilities. Local root and health both returned HTTP 200; health `ok`, queue 0, expired leases/deadlines 0. The isolated build directory was moved to `/tmp`. No live hotel search was made. P4 remains Partial; see [`docs/hotel-flight-party-reset-2026-11-13.md`](docs/hotel-flight-party-reset-2026-11-13.md).

Latest Matrix progress (2026-11-14 00:46–01:07 UTC): bounded native-browser detail expansion now works for up to three connecting/mixed-carrier results only on fixed-date exact-airport searches; regional fanout suppresses expansion and calendars reject it. A live YHZ–LAX round trip returned 3 validated itinerary offers and 22 price-only observations, and the current production website-to-worker run reproduced the counts with no browser errors or off-origin browser requests. `npm test` 562/562, production build passed, audit 0 vulnerabilities. Seller verification and most other work.md §17 evidence remain open; this goal is still active and the app remains local-only. [Evidence](docs/matrix-detailed-expansion-live-2026-11-14.md).

P3 continuation (2026-11-14 01:12 UTC): one fresh bounded live YHZ–LAX round-trip comparison priced all 6 exact ticket blocks and found a CAD 772 split plan against a CAD 777 refreshed baseline. It searched one alternate airport pair, reported 98 matching alternatives (8 shown/90 omitted), and kept provider completion incomplete. The CAD 5 difference excludes unverified extras and does not establish seller bookability. Focused tests 50/50 passed. [Evidence](docs/separate-ticket-roundtrip-live-check-2026-11-14.md).

