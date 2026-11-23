# ITA Matrix detailed-itinerary expansion — 2026-11-14

## Implemented

- Added the validated `expandDetailedItineraries` Matrix option and exposed it in the web search controls. It remains opt-in for all-source searches; Matrix-only economy searches automatically request detail expansion when the extra-stop setting is at most two.
- The native Matrix website flow applies the requested extra-stop limit and airport-change setting, then expands no more than three connecting or mixed-carrier summaries per exact-airport, fixed-date search. Regional/city airport-pair fanout does not expand details, and the calendar API rejects detail expansion to prevent multiplying work across date/pair budgets.
- Detailed data is attached only when the Matrix session, solution set, and selected solution ID match. Existing itinerary validation checks route, exact segments, cabin, timestamps/chronology, layover, traveler categories, and group total. Incomplete results remain separate CAD price observations and are never promoted to complete flight offers.
- Unsupported cabins, stop settings above the native UI's observed two-extra-stop limit, and detail requests without the native browser path fail closed.

## Verification

- `npm test`: **562/562 passed** (90.3 seconds).
- `TRAVEL_NEXT_DIST_DIR=.next-matrix-bounded-final-build npm run build`: passed on Next.js 16.4.3 after the route/calendar fanout guard.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3004 npm run check:search-settings`: passed on the final production build. It verified exact-route eligibility, Matrix-only auto-expansion, all-source opt-in, regional/calendar disabling, and exact route/filter settings in the submitted payload; provider/job calls were intercepted.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3004 npm run check:matrix-price-observation`: passed on the final production build. CAD label and price-only/seller caveats rendered; provider calls were intercepted; zero browser errors.
- One bounded live adapter search for YHZ–LAX, 2026-12-15 to 2026-12-22, one adult, economy, CAD, two extra stops, airport changes disabled, returned 25 Matrix results. The adapter requested 3 details, received 3/3, and accepted 3 complete itinerary offers. The other 22 remained distinct Matrix-reported CAD price observations. Observation time: `2026-11-14T00:46:27.282Z`.
- One separate production-build website-to-worker search with the same query completed on an isolated loopback server/database. It reported 25 Matrix results, `detailCoverage` 3 requested / 3 received / 0 failed, 3 accepted offers, and 22 price observations. The rendered UI showed Matrix source and the unverified price-only caveat. Chromium recorded zero page errors and zero off-origin browser requests. Temporary server and worker were stopped after verification; the existing local app/worker were left running.
- After the fixed-route/flexible-calendar guard was added, the current production build repeated the actual website-to-worker YHZ–LAX search at 01:07 UTC. It again completed with 3 accepted offers, 22 price observations, 3/3 detail responses and zero failures; the UI showed the Matrix source and price-only caveat. Chromium recorded zero page errors and zero off-origin requests. The temporary server/worker were stopped afterward.
- The current rebuilt UI settings check also asserts detail expansion is disabled and unchecked until an exact fixed-date airport pair is entered; it disables the control for regional searches and flexible calendars, restores the Matrix-only default for an eligible exact route, and verifies the submitted Matrix options. The Matrix price-observation UI check again passed with intercepted provider calls and zero browser errors.

## Limits

This was one route/date/party/cabin/settings case and does not establish exhaustive Matrix result coverage, seller availability, fare rules, baggage, mandatory charges, checkout totals, or bookability. Detail expansion is capped at three results, so the remaining 22 prices are not validated itineraries and may not satisfy filters. Matrix uses an unofficial reverse-engineered interface that can change or refuse access. No CAPTCHA was bypassed, and no booking, reservation, or purchase was made. Overall `work.md` §17 remains **Partial**; the project stays local-only.
