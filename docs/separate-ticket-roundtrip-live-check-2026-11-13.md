# YYZ–FRA round-trip split-ticket live check — 2026-11-13

## Scope

One loopback-worker flight search for YYZ–FRA, 2026-11-14 to 2026-11-20, one adult, economy, CAD. The request selected all adapters; only eligible/configured routes ran. A single fresh Ignav itinerary was then refreshed and compared as contiguous ticket blocks. Alternate airport-pair discovery was explicitly disabled (`routeSearchLimit: 0`); the comparison request budget was 20.

## Flight observation

- Flight job completed at 2026-11-13 02:04:29 UTC with 198 accepted offer records: 183 Ignav and 15 ITA Matrix price observations.
- The selected lowest CAD Ignav itinerary was CAD 1,591, observed 02:03:35 UTC, with two outbound segments and two return segments. Quote freshness was required by the comparison code; no seller lookup or booking action was made.
- Ignav returned 183 offers. ITA Matrix returned 15 matching CAD price observations and reported 6 responses without a supported CAD total or matching route/date evidence.
- Google Flights failed its native round-trip evidence check before an itinerary was accepted. Expedia partner and Skyscanner were unconfigured. Air Canada NDC and Expedia via Omkar reported round trips unsupported.

## Exact-flight split comparison

- The comparison refreshed the selected itinerary and completed 7 fare requests out of its 20-request cap: one baseline refresh plus six unique contiguous outbound/return ticket blocks. There were four eligible combined partition plans.
- Only 2 of 6 ticket blocks received qualifying fresh CAD prices for the exact observed flight segments. The job returned `segment_unavailable`; it produced no complete split plan or component total.
- No alternate airport pairs were searched. The same-pair refresh contained 183 candidate itineraries, 182 matching alternatives; eight were shown, 174 omitted by the display cap. Provider completion was known but `providerReportedComplete` was false, so neither alternatives nor fares are exhaustive.
- Follow-up implementation returns per-block exact flight identities, fare-request counts, qualifying fresh quote counts and sanitized source response statuses. The comparison UI calls blocks with no qualifying exact match `unpriced` and warns that this is not proof of no seller inventory. `node --test tests/separate-tickets.test.mjs tests/comparison-query.test.mjs` passed 31/31.
- Evidence establishes the round-trip baseline refresh and bounded ticket-block search only. Unpriced blocks prevent an optimization claim. Inventory overlap, concurrent seat availability, seller acceptance, ticket issuance, baggage and mandatory extras remain unverified. No seller links were opened; nothing was reserved or purchased.

## Alternate-pair continuation — 2026-11-13 02:15–02:16 UTC

- Submitted the same exact itinerary with three additional destination pairs (YYZ–FCO, YYZ–BCN, YYZ–MUC), contiguous grouping enabled, 180-minute self-transfer buffer, and a 12-request cap. The original itinerary was fresh when submitted. All three pair requests returned; 10 fare requests were used, including baseline refresh, three pair searches and six distinct ticket blocks. Four combined round-trip partitions were eligible.
- Ignav returned 414 candidate itineraries across the baseline and alternate-pair requests; 413 matched the requested round trip, eight were shown and 405 omitted. Provider completion was false. This covers those three exact pairs only and is not exhaustive Europe coverage.
- The exact through itinerary was British Airways BA98 YYZ–LHR and BA906 LHR–FRA outbound; TAP TP6700 FRA–LIS and TP261 LIS–YYZ return. Only the full outbound block (BA98+BA906) and return TP261 alone received qualifying fresh CAD quotes (2/6 blocks). The other four requests each received nonzero Ignav offers, but none matched every exact requested segment; they are labeled **unpriced**, not unavailable. There was no complete split plan and no savings figure.
- Source response counts were: BA98 alone 9/9 accepted; BA906 alone 14/14; TP6700 alone 11/11; TP261 alone 134/136 accepted; TP6700+TP261 9/9; outbound BA98+BA906 124/124. “Accepted” is source-level validation, not proof that the exact target flight was present; `qualifyingQuotes` records the exact-flight comparison separately.
- This live result prompted the UI wording change to `unpriced`. It still cannot establish seller inventory, simultaneous seats, baggage, fees, ticket issuance, through-ticket protection, or booking acceptance. No seller link, checkout, reservation or purchase was attempted.

## Reproduction record

The flight and comparison jobs used the local app at `http://127.0.0.1:3000`, its owner-bound job API, and the running local worker. The comparison payload used `contiguousGroups: true`, `minConnectionMinutes: 180`, `searchLimit: 20`, and `routeSearchLimit: 0`. Read-only SQLite inspection recovered terminal job summaries after an ad-hoc monitor did not retain its owner token. No credentials or owner tokens are recorded here.

Initial verification after the `unpriced` status change at 02:23 UTC: `npm test` passed 545/545; focused separate-ticket/comparison suites passed 31/31; `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:separate-ticket-results` passed with provider/job routes intercepted, off-origin traffic blocked and zero browser errors; `TRAVEL_NEXT_DIST_DIR=.next-p3-roundtrip-final npm run build` passed; `npm audit --audit-level=low` reported zero vulnerabilities. Local root returned HTTP 200 and `/api/health` returned `ok`, worker available, empty queue, zero expired leases/deadlines.

## Stop and request-budget coverage follow-up — 2026-11-13 02:23–02:28 UTC

- Coverage now includes every eligible ticket block on successful, source-stopped and request-budget-exceeded comparisons. Each block is `priced`, `partial` when some group quotes exist but comparison stopped, `unpriced` after requests yield no qualifying exact-flight quote, or `not_searched` if no fare request was dispatched. Refusal status/count is retained; unsearched blocks carry zero requests. The UI summary counts each state and explains the difference.
- Regressions confirm a rate-limited first ticket request yields an `unpriced` block with its refusal status and later blocks as `not_searched`; a preflight budget overrun marks every block `not_searched`; and partial traveler-group quotes followed by refusal yield `partial`. Focused tests passed 32/32 and the browser check passed with providers intercepted.
- Final verification after this implementation at 02:36 UTC: full `npm test` 546/546; `TRAVEL_NEXT_DIST_DIR=.next-p3-partial-coverage npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities. Local site HTTP 200; health `ok`, worker available, queue 0, zero expired leases/deadlines.

## Remaining P3 work

Repeat only with a new bounded live observation when needed to establish fresh fare coverage; preserve exact segment identity and dates. Extend alternate-route/round-trip checks with a separately budgeted candidate set. Explain unpriced blocks when source evidence permits. Keep seller verification, live simultaneous inventory, baggage, fees, issuance and protection open until independently observed.
