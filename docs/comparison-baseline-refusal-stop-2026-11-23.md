# Separate-ticket baseline refusal guard — 2026-11-23

## Finding

The separate-ticket optimizer already stopped after provider refusals during alternate-route and ticket-block searches. It did not inspect stop statuses on its initial baseline response. A regression with a fresh baseline offer plus `rate_limited` status showed the optimizer sent a second fare request after the provider had signaled that work should stop.

## Change

- A refusal or deferral on the baseline request now returns `source_unavailable` before route or ticket-block searches.
- If the refused response includes the selected fresh itinerary, the result may retain other valid fresh route alternatives observed in that same response. It marks provider completion incomplete and identifies every alternate pair that was not searched.
- If the response has no selected fresh itinerary, the result still reports `source_unavailable`, rather than implying the itinerary was absent from a successful refresh.
- Route coverage UI only says every alternate pair returned a response when all planned pairs were attempted and searched without a stop. Unsearched pairs remain explicitly listed.

## Verification

- The new red regression reproduced two calls before the fix; after the change, the focused comparison/search/worker tests pass **61/61**.
- `npm test` passes **734/734**.
- `TRAVEL_NEXT_DIST_DIR=.next-comparison-refusal-build npm run build` passes on Next.js 16.4.6.
- `npm audit --audit-level=low` reports **0 vulnerabilities**.
- `npm run check:separate-ticket-results` passes in Chromium. It verifies the refusal notice, a partial route observation, all three unsearched airport pairs, and no false claim that those pairs returned responses. All job/provider calls are intercepted, external browser requests are blocked, and page errors are zero.
- `git diff --check` passes.

No live provider request, seller check, reservation, or purchase was made. This closes one refusal-handling defect only; route coverage remains bounded, and live availability, overlapping inventory, ticket issuance, carrier eligibility, baggage, transfers, mandatory charges, and final totals remain unverified.
