# Progressive fare-calendar results — 2026-11-12

The calendar now publishes validated fresh fare observations into the durable job's progress while the worker continues searching. The web UI polls the existing owner-protected job-status endpoint once per second and renders the best current observation per departure/return date as soon as a provider or airport-pair result arrives. A visible status labels these prices provisional and says coverage is still running. Later results can replace the provisional minimum. The final result replaces the preview when the job completes; incomplete route coverage is not described as a final cheapest-route result.

The worker preserves the existing request budget, query filters, traveler data, quote-freshness checks, provider status and coverage fields. Progress contains the current candidate per date instead of every raw offer. Cached provider responses appear immediately when reused. The UI uses one-second polling, not server-sent events or a push channel.

## Verification

- `node --test tests/calendar-search.test.mjs` — passed 41/41.
- `npm test` — passed 539/539.
- `npm run build` — passed.
- `npm audit` — zero vulnerabilities.
- `npm run check:calendar-streaming` — passed in Chromium against the local site. It intercepted job and supplier traffic, displayed a fixture-backed provisional CAD 500 observation and timestamp, then the completed CAD 400 result; two status polls, zero browser errors.
- Every calendar cell now displays its provider observation time inline and explicitly says seller availability/current checkout price are unconfirmed. Full tests passed 539/539; isolated production build passed; audit found zero vulnerabilities after this UI change.

## Bounded live YYZ–Europe observation

On 2026-11-12, one real calendar job searched YYZ to the app's configured **continental Europe** region, Nov 14–20, 2026, one adult, economy, one-way, source `all`. The destination airport limit was explicitly set to **1** and the request budget to **28**. Capability preflight listed Ignav, Google Flights, ITA Matrix and Expedia via Omkar as query-compatible; Expedia partner API, Skyscanner and Air Canada NDC were unconfigured. Compatibility did not guarantee inventory.

The resolver selected Frankfurt (FRA) as the first candidate. Its snapshot reported 51 countries, 842 other merged airports unchecked beyond FRA, and 261 known country-member airports excluded by the documented coordinate boundary. It excluded the three traffic-ranked airports LHR, CDG and MAD before selecting FRA. This is a one-airport sample, not Europe-wide fare coverage.

The job-status progress stream changed while the job remained `running`:

| Departure | Provisional observation | Source | Provider observation time (UTC) | State at cancellation |
|---|---:|---|---|---|
| 2026-11-14 | CAD 760.00 | Ignav live fare API | 2026-11-12 22:39:51.197 | Observed; seller availability not rechecked |
| 2026-11-15 | CAD 747.00, later replaced by CAD 589.62 | Initial source not retained in the progress log; lower observation from ITA Matrix unofficial endpoint | 2026-11-12 22:41:40.533 for the lower observation | Observed; Matrix research link only, seller availability unconfirmed |
| 2026-11-16 | CAD 381.00 | Ignav live fare API | 2026-11-12 22:41:45.505 | Partial route coverage; remained provisional |

At 150 seconds the bounded observer cancelled the still-running job. The last durable progress record showed 12 of 28 logical fare requests started, 2 of 7 airport/date pairs checked, 2 departure dates checked, 3 dates with quotes, and 5 pairs / 4 dates not scanned. The worker returned to healthy idle state. This timeout was the observer's explicit bound, not a provider error or a completed calendar search.

This is live backend progress evidence, including a lower observation replacing an earlier one while the job ran. The browser rendering check above remains fixture-backed; this live run was observed through the real owner-protected job-status API, not through a browser page. The observations are historical and must be refreshed before display as current prices. No seller availability, inventory continuity, final fees, baggage, or bookability was verified. Do not treat the sample as a lowest Europe fare or exhaustive coverage.

The local app and worker remained available at `http://127.0.0.1:3000` after verification.

## Live browser rendering check — 2026-11-12 23:20 UTC

Used Chromium against the actual loopback website. Query: YYZ → Europe, one adult, zero children, economy, one-way, Nov 14–20 2026, four airport candidates and a 31 provider/date request budget. The browser was run once with the default Ignav-only source and again with **All compatible providers** selected. In both runs the site displayed a provisional CAD 760 YYZ→FRA cell before the calendar completed; Chromium reported zero page errors. The all-compatible job had started four provider requests while the browser showed that the search had not completed.

The all-compatible persisted job was cancelled after the first visible cell to keep the live check bounded. It reported 0/7 date combinations checked, one quote-bearing date, four fare requests started and six dates/7 route-date combinations unscanned. The displayed offer retained its original observation time, 2026-11-12 23:19:20 UTC, from the preceding Ignav run. This demonstrates progressive display of a still-fresh observation during ongoing work, not that the second job refreshed it. The first Ignav-only browser run showed the result within nine seconds; its durable observation time was 23:19:20 UTC.

This closes the specific gap “progressive rendering only fixture-verified” for one real browser session. The fixture check remains useful for deterministic replacement behavior (CAD 500 → CAD 400). Provider-specific live timing, regional completeness and seller refresh remain unverified.

The live all-provider cell briefly showed a streamed fare beside `0 fare observations checked`, because the observation arrived before the route/date query's aggregate response count finalized. The calendar now suppresses that zero counter during partial progress; nonzero counts are labeled as observations from completed route/date queries. The browser regression forces this exact state and asserts the misleading zero line is absent. `npm run check:calendar-streaming` passed after the change with zero page errors.

## Fresh all-source browser observation after the UI fix — 2026-11-12 23:45 UTC

Re-ran the same bounded real website flow through Chromium on the updated code: YYZ → automatic continental Europe, Nov 14–20 2026, one adult, zero children, economy, one-way, all compatible providers, airport limit 4, request budget 31. The resolver and request budget reduced this to FRA as the selected destination airport; 842 other merged airport candidates remained unchecked and 261 fell outside the airport-level coordinate boundary.

At 2026-11-12 23:45:45.194 UTC, the website rendered a **fresh Google Flights CAD 760** observation for YYZ→FRA on Nov 14. At that point the owner-protected job had started four provider requests but completed 0/7 date combinations; six dates and the remaining route/date work were unscanned. Chromium showed the observation timestamp, provisional/coverage-in-progress notice, and seller-availability/current-checkout caveat, with zero page errors. The rendered cell did not show the misleading “0 fare observations checked” text. The job was cancelled after this first fresh cell to keep the check bounded.

Unlike the earlier 23:20 display, this offer's observed time was contemporaneous with the current run, so the UI demonstration did not rely on the preceding job's still-fresh quote. This establishes that an actual provider response can appear in the website before the all-source/date query completes. It still does not prove complete Europe coverage, a lowest regional fare, seller availability, baggage, mandatory charges or checkout price.

Final verification after these UI changes: `TRAVEL_NEXT_DIST_DIR=.next-audit-build npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities; `npm test` passed 539/539; `node --test tests/calendar-worker.test.mjs` passed 7/7. The first full-suite invocation ran concurrently with the build and had one timing-sensitive calendar-worker failure; the isolated worker file and subsequent full-suite rerun passed without a concurrent build.

## Remaining work

This is one calendar UX improvement, not completion of `work.md` §17. Expedia's live duration source remains unavailable; seller availability, baggage and mandatory charges are unverified; family/carrier eligibility still needs seller evidence; multi-room package and hotel live coverage remain limited; geographic candidate lists remain bounded; provider credentials and partner access remain incomplete; public deployment gates are not passed. Continue with the open acceptance rows and preserve the documented coverage and access limits.
