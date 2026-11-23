# Progressive fare-calendar offers and provider progress — 2026-11-13

## Change

The regional fare calendar previously streamed only the best fresh offer in each departure-date cell. Each cell now retains every validated fresh offer from provider responses received so far and renders those offers while the durable search is still running. The best fare remains highlighted, and lower observations can replace it as more routes/providers complete. The offer list stays open during a partial search and can be opened after completion.

The running progress now separately shows provider responses received/planned and completed airport-pair/date batches. This matters when an early provider has returned offers but remaining providers or airport pairs are still running: a provider reply is not presented as a complete route/date search. Coverage rows deduplicate by provider and exact airport pair, do not count suppressed calls as received, and do not copy traveler data into the row.

Offers are kept source-specific, so the same flights returned by different providers remain separately visible. Invalid or stale observations remain excluded. A partial airport-pair scan still does not present a lowest-route price as complete; it can show the actual provider observations already received. Each row carries its provider, exact airport pair, observation time when supplied, source details and the existing quote freshness guard.

Progress travels through the existing durable job progress channel and is read by the browser's one-second owner-bound status polling. It therefore appears on the next poll after a provider response is accepted; the change does not make an upstream provider return sooner or stream individual cards from inside an unfinished provider response.

## Verification

- Red/green backend regression: `node --test --test-name-pattern='streams every accepted offer|publishes the first route fare|all-source calendar publishes' tests/calendar-search.test.mjs` passed 3/3 after first failing because the live preview had no all-offers field.
- Follow-up backend regression: `node --test --test-name-pattern='all-source calendar keeps earlier offers' tests/calendar-search.test.mjs` passed 1/1, retaining a successful provider's fare and exposing a later provider failure in coverage.
- At the initial all-offer implementation checkpoint, `npm test` passed 542/542; the later provider-progress follow-up and its final verification are recorded below.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:calendar-streaming` passed against the running local site. The controlled browser saw CAD 500 and CAD 510 as two separate observations while the job was running, then saw CAD 400 replace the highlighted best fare after completion. Provider and job requests were intercepted; page errors: 0.
- `TRAVEL_NEXT_DIST_DIR=.next-stream-build npm run build` passed.
- `npm audit --audit-level=low` reported zero vulnerabilities.

These are fixture/browser checks, not a new live fare search. No provider request, booking, seller availability check, CAPTCHA action or checkout occurred for this change. The latest bounded real YYZ→Europe calendar evidence remains at [the 2026-11-13 multi-airport live check](calendar-multi-airport-live-2026-11-13.md), with its unsearched airport/date/provider coverage and seller limitations.

## Provider-response progress follow-up — 2026-11-13

The preview now exposes `providerResponsesReceived` and `providerResponsesPlanned` independently of `pairQueriesChecked` and `pairQueriesPlanned`. A response row is keyed by provider and exact airport pair, recorded once, excludes suppressed requests from received counts, and contains no duplicated traveler details. A red/green regression observed 2/7 provider replies with 0/1 route/date batch complete while Expedia remained pending; after all source work finished, the received and planned response counts matched. `node --test tests/calendar-search.test.mjs` passed 43/43; full `npm test` passed 545/545; isolated production build passed; audit reported zero vulnerabilities. The loopback Chromium check showed the counter and streaming offer list during execution, then the CAD 400 best at completion; provider/job requests were intercepted and page errors were zero. This is controlled evidence, not a live provider query or proof of complete market coverage.

## Verification refresh — 2026-11-13 23:56 UTC

- `node --test tests/calendar-search.test.mjs` passed 44/44 against the current tree. The cases cover provisional route results, per-provider offer streaming, source failure retention, exact query constraints, and omission accounting.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:calendar-streaming` passed against the currently running loopback site. Chromium displayed provisional CAD 500 and CAD 510 observations during the running state, then highlighted CAD 400 after completion. All provider and job calls were intercepted; there were two status polls and zero page errors.
- Same-origin health at `2026-11-13T23:56:13.046Z` returned `ok`, queue depth 0, one live worker, zero expired leases/deadlines, nine stale and eight stopped historical worker records. A direct curl without `Origin` returned 403 as required by `localRequest`; adding the same-origin header produced the health response.
- Full verification after the refresh: `npm test` passed 557/557 (84.2 seconds); isolated `TRAVEL_NEXT_DIST_DIR=.next-audit-resume-build npm run build` passed on Next.js 16.4.3; `npm audit --audit-level=low` found zero vulnerabilities. The isolated build did not replace the running site's `.next` output.
- No fare provider was contacted. This verifies progressive rendering, current code tests/build/dependencies, and local worker health only; live fare freshness, completeness, seller availability and purchase totals remain unverified.
