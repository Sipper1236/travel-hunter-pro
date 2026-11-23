# Air Canada Vacations browser discovery

## Live child/room widget limit — 2026-11-08

The public Flight + Hotel widget was opened in headless Chromium through ordinary UI interaction. With its default adult count, selecting a second room produced a retained two-room count and disabled the widget's **Add child** control. Returning to one room re-enabled child occupancy; selecting one child at age 7 was retained by the age dropdown. No package search was submitted and checkout was not opened.

Reproduce with `node scripts/probe-vacation-occupancy-limits.mjs`. The probe passed initially at `2026-11-08T16:21:01.095Z` and was rechecked at `2026-11-09T00:04:39.781Z`: the widget retained two rooms with Add child disabled, then enabled a one-room child age-7 selection. `scripts/check-package-infant-guidance-ui.mjs` now also guards the app behavior: setting two rooms and a child displays the one-room limit, keeps the room input constrained, and submits zero package jobs; after resetting to one room the exact-age fixture flow continues. `TRAVEL_CHECK_URL=http://127.0.0.1:3101 npm run check:package-infant-guidance` passed with zero real provider calls and four intercepted job calls. `lib/vacation-query.mjs`, `lib/vacation-form.mjs`, and the visible website reject child/infant parties assigned to multiple rooms. Keep this source limitation explicit. This observation does not establish whether separate package bookings can be combined safely, whether they share exact flights, or their simultaneous availability; the app must not sum them as one package without matching seller evidence.

## Verified location text replacement — 2026-10-31

A controlled live initialized-widget comparison successfully typed `YHZ` and then the full Halifax label; both produced HTTP 200 suggestions containing the exact Halifax origin, which was selected. Full-label lookup is supported in this observation. The remaining intermittent failure is not explained by unsupported search text alone.

Added shared `typeVacationLocation` to both suggestion lookup and exact-label selection. It checks the input value immediately after ordinary Ctrl+A/type replacement. If the widget overwrote the term, it repeats that interaction once; persistent corruption fails explicitly. It does not retry provider HTTP refusals or bypass challenges. Exact suggestion selection and label retention checks remain required. A regression covers a default restored on the first attempt and persistent corruption, with a strict two-attempt cap.

Verification: 277 tests passed, production build passed, npm audit found zero vulnerabilities. The live comparative probe preceded the helper change; the new bounded retry is covered by tests, not a new end-to-end live package result. No fare or booking was submitted. Next: rerun the full optional package UI check against the rebuilt application; preserve source refusal and timeout evidence, and verify the actual resulting cards before advancing package acceptance.

## Origin reselection: readiness experiment — 2026-10-31

A fresh real-provider probe reproduced the origin reselection failure. Before typing, the visible origin input was empty. After typing the full Halifax label and waiting 15 seconds for its exact suggestion, the input contained `Toronto Pearson Intl. Airport (YYZ)` and no matching suggestion response was observed. The provider's late initialization can overwrite entered text; visible input alone is not reliable readiness evidence.

A second controlled probe changed only readiness: it waited until the origin input held a nonempty provider default before calling the existing selector with the full Halifax label. That probe still timed out waiting for the exact Halifax suggestion. Therefore waiting for a nonempty default alone is NOT an established fix. No production behavior was changed on this evidence, no search was submitted, and both probe browsers closed.

Next: capture final input and sanitized suggestion query/returned labels immediately after typing into the initialized widget; compare short airport-code search with full-label search while retaining exact-label selection. Verify any change through the live website/worker before claiming reliable packages. The direct-overwrite implementation remains tested but not reliably live-verified. This continuation added diagnostic evidence only; the 276-test/build/audit checkpoint remains the latest application verification.

## Full package UI attempt: origin reselection failure — 2026-10-31

Extended `scripts/check-package-location-ui.mjs` with optional explicit `TRAVEL_PACKAGE_DATE` and `TRAVEL_PACKAGE_RETURN` variables. When both are supplied it selects real provider locations, submits a one-adult/one-room YHZ–Barcelona query, waits for terminal job status, and requires rendered package cards. Without those variables it remains a location-only check. It never enters checkout or booking.

Attempted command (local app and worker must share the isolated database):

```sh
TRAVEL_CHECK_URL=http://127.0.0.1:3457 TRAVEL_PACKAGE_DATE=2027-04-15 TRAVEL_PACKAGE_RETURN=2027-04-25 node scripts/check-package-location-ui.mjs
```

The origin lookup returned HTTP 200 and one choice at `2026-10-31T00:58:22.326Z`. Destination lookup then failed while reselecting the origin in its fresh provider browser: the exact `Halifax Stanfield Intl. Airport (YHZ)` listbox entry did not become visible within 15 seconds. No package job was submitted and no new price was obtained. This is a distinct, narrower failure than an initial suggestion-response timeout. Stop/restart and the direct-overwrite change have not established reliable origin reselection. App and worker were stopped after the attempt.

Next: instrument `selectVacationLocation` during the fresh-session origin reselection; compare the actual input, emitted suggestion query, and returned labels with the requested exact label. Preserve the same live flow and use a regression grounded in that evidence before changing selection semantics. The optional full-search branch has not yet reached submission in a successful live run. No application source changed here; the existing 276-test/build/audit checkpoint was not rerun for this diagnostic-script/documentation change. Full specification acceptance remains incomplete.

## Updated-build website location verification — 2026-10-31

Restarted the production app and worker against the isolated audit DB. The initial location check timed out waiting 75 seconds for the local API response; its instrumentation did not establish whether a request was sent. Enhanced `scripts/check-package-location-ui.mjs` to distinguish a missing client request from a sent request without a response, and to handle both wait failures without unhandled promise rejection.

The rerun confirmed both local requests were sent. Origin returned HTTP 200 and one choice at `2026-10-31T00:57:17.419Z`; destination returned HTTP 200 and 12 choices at `2026-10-31T00:57:31.933Z`. Both exact provider choices were selected through the updated website. This is live UI evidence for the direct-overwrite input change, with an unresolved initial timeout; it does not prove consistent reliability. No package fare job was submitted. Temporary app and worker were stopped afterward.

Next: complete one full real package query through the website/worker and verify the 20-panel observations on screen. Full-package acceptance, child-party live evidence, checkout and local charges remain open. This continuation changed only the diagnostic script and documents; the previous 276-test/build/audit verification applies to the application source and was not rerun.

## Package input replacement follow-up — 2026-10-31

Following the observed `YHZToronto Pearson Intl. Airport (YYZ)` request, a controlled live probe removed only the Backspace step after Ctrl+A. Typing directly over the selected default produced an exact `query=YHZ` request and returned one Halifax provider suggestion. This supports the hypothesis that an empty-field transition lets the widget restore its preset; a single success does not prove the intermittent problem is eliminated.

Both `lib/vacation-form.mjs` and `lib/vacation-suggestions.mjs` now type over the selected text without Backspace. The interaction regression rejects the empty-field clearing step. Full suite passed 276 tests, production build passed, and npm audit found zero vulnerabilities. No fare search, reservation or purchase occurred. Next: rerun the website location check against a freshly restarted build, then complete a real website/worker package query. Current evidence is a live suggestion lookup only; the latest 20-card package result still lacks current website rendering proof.

## Interrupted live package attempt — 2026-10-31

A full website search attempt failed before job submission. The API returned `provider_suggestion_timeout` for the origin. A redacted Playwright probe then found the decisive signal: the actual widget request was `query=YHZToronto Pearson Intl. Airport (YYZ)` with `journeyType=origin`, rather than the requested exact term `YHZ`. This indicates the provider page retained/appended its preset Toronto label despite the adapter's Ctrl+A/Backspace sequence. Earlier lookups did succeed, so this is an intermittent widget-state issue. No HTTP refusal was seen in this failed attempt; it is premature to attribute it to throttling.

This is stronger evidence than the prior generic timeout. The next fix should make the location selection wait for the input to equal the intended term and inspect the resulting request query before accepting a suggestion. If the widget retains a preset, use its ordinary visible clear control or reinitialise the widget session before typing; don't manually edit the readonly date fields or bypass provider controls. Keep a regression for concatenated text and rerun the same UI probe before attempting another fare search. The previous worker and app use a separate audit DB at `/tmp/travel-package-audit-20261031/jobs.sqlite`; no package job was submitted. The app and worker launched for this attempt may still be running after interruption; check their process/session state and stop them after inspection. Temporary DB/captures must not enter the repository.

## Package suggestion failure diagnostics — 2026-10-30 (UTC October 31)

The previous goal turn produced live evidence and a repeatable browser check, so it was progress. A minimal direct lookup probe now observed the exact YHZ suggestion request at 6,679 ms and HTTP 200 at 6,739 ms; it returned one provider origin at `2026-10-31T00:29:12.452Z`. The intermittent failure did not reproduce in this probe. This rules out neither widget initialization races nor intermittent provider refusal; no root-cause fix is claimed.

Previously, lookup timeouts and all non-200 provider responses became the same generic error. `lib/vacation-suggestions.mjs` now distinguishes response timeout, other browser-wait failure, and provider refusal. The local location route returns the diagnostic code and provider HTTP status when known; upstream 429 remains HTTP 429, other upstream failures use 502. No response body, credential or session data is exposed. The website already displays the error message. No retry or challenge bypass was introduced.

A regression failed before the change and now verifies timeout, HTTP 401, HTTP 429, and browser cleanup. Full test/build/audit checks passed; npm audit reported zero vulnerabilities. These failure cases use test transports. The real intermittent lookup remains unresolved. Next run `scripts/check-package-location-ui.mjs` against the local app and use the new failure category to select the next diagnostic probe before changing widget timing; then finish live package rendering through the worker. No fare search or booking was submitted during this continuation.

## Live package location UI recheck — 2026-10-30 (UTC October 31)

Read-only Chromium checks against the current local production website successfully selected the provider's YHZ origin and Barcelona city destination. Origin returned HTTP 200 at `2026-10-31T00:27:35.543Z`; destination returned HTTP 200 with 12 suggestions at `2026-10-31T00:27:47.282Z`, and the browser selected `Barcelona, Spain`. These were real website-to-provider lookups, not intercepted fixtures. An earlier standalone origin check also succeeded.

Added `scripts/check-package-location-ui.mjs` to reproduce that exact flow with `TRAVEL_CHECK_URL=http://127.0.0.1:3000 node scripts/check-package-location-ui.mjs` while the app is running. It uses ordinary provider suggestion requests, checks the exact returned choices, and never submits a fare search. Its subsequent live rerun failed at origin lookup with “Provider location suggestions are temporarily unavailable.” Consequently the earlier failure is intermittent, not proven resolved; further automatic retries were stopped. The script detects the failure correctly. No package fare search, checkout, reservation or purchase was submitted in this check.

Next: diagnose provider widget readiness/response timing on the intermittent origin failure without bypassing challenges, then complete one actual website/worker package query and verify all displayed 20-panel observations. Existing 20-result evidence remains direct-adapter-only. No application source changed in this continuation; prior 275-test/build/audit results are historical verification, and this new live script has both successful equivalent interaction evidence and a failed recorded rerun. Keep package acceptance partial.

## Current follow-up — 2026-10-30

A live `searchVacation` run exposed an autocomplete mismatch: the adapter typed the selected airport code YHZ but waited for the full provider location label. `vacationLocationSelection` now searches with the exact provider label for both origin and destination, and the destination suggestion flow reselects the exact origin label. The new regression and package suggestion tests pass.

After the correction, a live adult-only YHZ–Barcelona query for April 15–25, 2027 returned 20 CAD package observations and inspected all 20 visible cards and flight panels at `2026-10-30T22:15:26.039Z`. This is direct adapter evidence. The prior local website/worker run rendered five observations at `2026-10-30T21:45:32.051Z`; a later attempt to re-run the form did not complete provider suggestion selection, so the 20-result output was not re-rendered through the site UI. No child fare, infant fare, checkout availability, local-charge verification, all-page coverage, or purchase is established. The provider's listing had 80 results, so 60 were beyond the visible page.

The expanded panel budget is therefore live-tested for the direct adapter, while current local website rendering for 20 results is still open. Do not treat these observations as checkout-confirmed prices.

## Live website verification — 2026-10-29

The initial guest dialog allowed child and infant counts but exposed no visible age fields in the observed controls. Two attempts to reach a child listing stopped at the guest interaction, so no exact-age child fare was established. The adapter continues to reject child/infant parties. Hotel class and CAD group-budget controls now filter matching normalized package observations; those new filters have controlled test/browser evidence, not a new live filtered-fare verification.

The website now provides live provider-session origin/destination suggestions. A browser selected YHZ and Barcelona suggestions, supplied BCN as the expected arrival airport, and completed the actual local queued package search with five displayed observations and no page errors. Direct unauthenticated calls to the suggestion endpoint returned 401; lookup uses the ordinary provider widget session and the eventual search reselects the exact label. The airport is independently checked against observed flight panels. Children/infants and complete result coverage remain unverified.

The provider widget loaded again. The first current live adapter run failed because each product card exposed duplicate flight-details controls. The adapter now selects an unambiguous visible control targeting the same panel. A subsequent direct run inspected five of 20 visible cards and accepted five matching CAD estimated package observations. A separate actual local website/queue/worker run for YHZ to Barcelona, 2027-04-15–25, one adult and one room, rendered five observations with the coverage limitation and zero JavaScript errors. No checkout or reservation was made. Live observations are time-sensitive; eligibility, final availability, all mandatory charges and checkout totals are not established. Children/infants, a user-facing verified suggestion picker and coverage beyond five flight panels remain open.

Public source: https://vacations.aircanada.com/en/all-booking-options/flight-hotel/

Live Chromium probe from this workspace found the package search widget after DOMContentLoaded plus eight seconds. An immediate homepage probe did not expose it. Do not conclude that the widget is absent from initial HTML alone.

Observed public selectors:

- Origin: `#flight_hotel_tab-from-input`
- Destination: `#flight_hotel_tab-to-input`
- Departure: `#flight_hotel_tab-departureDateId`
- Return: `#flight_hotel_tab-returnDateId`
- Guests: `#flight_hotel_tab-Guests`

No package query was submitted, no price observed and no booking operation performed. The discovered fields do not prove autocomplete selections, date entry format, guest allocation or package result extraction. Next adapter work must verify those ordinary UI interactions, capture the genuine search/result flow via api-anything, and normalize exact itinerary, hotel, occupancy, inclusions, CAD group totals and seller URL. Stop for any provider challenge and retain human interaction rather than bypassing it.

The public product page describes round-trip economy flight, hotel, taxes and fees, and conditional baggage inclusions. Those marketing descriptions must not automatically be assigned to any individual quote; quote-specific inclusions still require evidence. Do not substitute advertised discounts for an actual priced result.

## Verified form interaction

After waiting for hydration and accepting the visible cookie dialog, ordinary sequential typing of `Halifax` into the origin combobox produced the listbox entry `Halifax Stanfield Intl. Airport (YHZ)`. The listbox selector is `#flight_hotel_tab-from-listbox`. A plain immediate fill during initial loading had not retained the value.

Clicking `#flight_hotel_tab-Guests` opened the real occupancy dialog. It labels adults 18+, children 2–17 and infants under 2, and provides room count. Its preset occupancy was two adults and one room; these are provider defaults, not user-supplied travelers, and must be explicitly replaced and checked before any submitted search. The dialog directs 7–9 travelers to telephone and 10+ to Group Travel. Do not apply Ignav age categories to this provider.

The hydrated page also contains preset Toronto-origin package advertisements with per-adult “From” amounts. These do not match a user query, omit necessary pricing context, and must not be imported as verified query results or multiplied into a fabricated group fare.

Reproducible read-only discovery script: `node scripts/probe-vacation-form.mjs`. No search submission or booking writes.

## Destination and calendar discovery

Read-only probe `node scripts/probe-vacation-dates.mjs` selected the actual Halifax/YHZ origin suggestion and typed Barcelona. The destination list contained a city, other nearby cities, landmarks, Barcelona Airport (BCN), and individual hotels. Therefore the adapter must select an explicit exact suggestion; selecting the first text match would silently change destination semantics.

Departure input is readonly: `#flight_hotel_tab-departureDateId`. Clicking opens an ordinary two-month calendar with `Previous month` and `Next month` accessible button names, month/year overlay buttons and a `Select` button. Dates must be chosen through this UI, not injected into readonly fields. The probe opened the calendar but selected no dates and submitted no search.

`lib/vacation-form.mjs` now provides exact-label location selection through ordinary UI typing and listbox clicks, with ambiguity and empty-selection checks. It does not yet constitute a search or pricing adapter.

## Live date selection verified

`selectVacationDates` navigates the actual month buttons, selects nonempty enabled day cells by observed `data-test-id="dp-YYYY-MM-DD"`, then clicks Select. Live read-only probe selected 2027-04-15 through 2027-04-25 and read back `15/04/2027` and `25/04/2027` from the provider inputs. No readonly fields were modified directly, no search was submitted and no occupancy was assumed. Reproduce with `node scripts/probe-vacation-date-selection.mjs`.

## Submitted search reached genuine product listing

The combined ordinary-UI probe selected Halifax/YHZ and Barcelona city, April 15–25, 2027, one adult and one room, and submitted Search. It navigated to `/en/packages/product-listing`. After fifteen seconds the rendered page contained query-result property cards, explicit Flight + Hotel inclusion, per-adult and Total amounts, Taxes & fees incl. text and some Non-refundable rate labels. It reported 1–20 of 80 results.

This proves a real search/result UI path, not final availability, checkout, quote-specific flight identities or CAD currency. Dollar signs alone do not establish CAD. Do not expose amounts as verified CAD before inspecting actual currency evidence and tying cards to the exact query. No property was selected or booked.

The probe now saves private local result HTML/text under `.cache/vacation-probe/` on subsequent runs for api-anything extraction discovery. It no longer logs advertising frame URLs. Those captures may contain session state; do not publish or commit them. Location retention is now checked against the exact suggestion label and dates against exact observed DD/MM/YYYY formatting.

## Price breakdown and flight summary evidence

Live opening of the second card's `.price-popover-link` displayed separate adult package and taxes/fees subtotals, an Estimated Total, and a warning about possible hotel/resort fees. Thus the source total must not be labeled universally all-in or checkout-confirmed.

Clicking `.flight-details-link` opened a sibling region `#flightDetailsAccordion-1`, not content inside `.hotel-item`. The region contains an accessible `.sr-only` departure/return summary and `.accordion-content.outbound` / `.inbound` blocks with airport codes, local dates/times, stop counts, airline and cabin. For this probe it described YHZ–BCN April 15 arriving April 16 and BCN–YHZ April 25. Flight numbers and actual connecting airport were not present in that summary; do not invent them.

Currency evidence: current official terms, https://vacations.aircanada.com/en/terms-conditions, section 16.1 says prices use Canadian currency unless otherwise indicated. Section 16.3 identifies possible excluded local fees. This supports CAD as the provider default, conditional on checking that no individual quote overrides it; currency is not inferred from the dollar sign. These terms were read during this run, not supplied by a test fixture.

Private captured expanded page: `.cache/vacation-probe/details.html`; repeat with `node scripts/probe-vacation-details.mjs`. No room selection or booking was performed.
