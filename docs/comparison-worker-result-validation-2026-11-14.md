# Comparison worker result validation — 2026-11-14

## Change

The comparison child worker now validates passenger-split and separate-ticket results before publishing them to the durable job store. The returned query must exactly match `validateComparisonQuery()`, request counters must fit the server-selected budget, and every displayed plan must have a fresh CAD total equal to the sum of its fresh ticket observations. Count-based party plans must account for the full adult party. Identified plans must assign each traveler exactly once per booking group and keep every minor with the submitted guardian. Separate-ticket plans must cover each direction's exact flights from the submitted itinerary key, in contiguous blocks, without gaps or substitution. Bounded alternate-route coverage must reconcile its planned, attempted, searched, stopped and unsearched airport pairs, preserve the display bound, and remain explicitly non-exhaustive.

This validation checks the structure and evidence carried in the comparison result. It does not prove that a provider's observed inventory is simultaneous, that the seller can issue the tickets, or that fare eligibility, baggage, mandatory charges, connection protection, or worldwide route coverage are complete. The worker continues to make no booking or reservation. Hotel and vacation-package result schemas remain outside this guard.

## Evidence

- `node --test tests/comparison-worker-result.test.mjs tests/comparison-worker.test.mjs`: **8/8 passed**; includes malformed totals, stale ticket quotes, changed query constraints, unsafe minor partition, request-budget overflow, exact segment coverage, alternate-route omission/exhaustiveness checks, worker recovery, and guardian-safe comparison.
- Full `npm test`: **577/577 passed** in 94.5 seconds.
- `TRAVEL_NEXT_DIST_DIR=.next-comparison-worker-final-build npm run build`: passed with Next.js 16.4.3.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- Fresh final production build on loopback port 3001 passed `check:party-partition` and `check:separate-ticket-results`; provider/job calls were intercepted, external requests were blocked, and page errors were 0. In the preceding flight-result guard increment, the fresh production build also passed `check:flight-default`. The party-partition check first ran against the already-running port-3000 server and exposed that it served a stale no-plan heading. That server was left untouched; checks were rerun against the isolated current production build and passed.
- Same-origin POST health on port 3001 before shutdown: HTTP 200, `ok`, queue 0, worker available, one live worker, zero expired leases/deadlines. Temporary port-3001 server stopped; the user's port-3000 server was not stopped.

No live fare query, seller lookup, or booking was made for this change. The controlled browser checks establish current production UI behavior with intercepted APIs; actual durable-worker tests exercise successful comparison persistence and guardian assignments.
