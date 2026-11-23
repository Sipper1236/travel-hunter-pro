# Flight worker result validation — 2026-11-14

## Change

`scripts/flight-job-runner.mjs` now validates every ordinary flight-search result with `flightWorkerResultError()` before sending it to the durable job worker. Invalid output becomes a generic flight-worker validation failure; it is not sent as a successful result. Calendar validation remains separate, and comparison, hotel, and package workers are not covered by this change.

The guard checks that the returned query preserves route text, travel dates, trip type, cabin and supplied party counts/child ages; establishes eligible airport pairs from exact airport input, resolved locations, or region coverage; and permits offers only on searched pairs. Offers must pass the existing CAD, freshness, traveler-price provenance, route, and segment checks, and their observation time cannot be later than the enclosing result. Region coverage rows and their nested source-status schemas are checked. Matrix price-only observations remain a separate type and must be CAD, match the exact route and dates, have a safe HTTPS source, and remain explicitly `itineraryVerified: false`.

This is a worker-envelope guard, not a proof of source honesty, seller inventory, complete geography, or complete UTC chronology. `flightOfferError()` still permits source-specific local timestamp handling; adapters that require timezone evidence must continue to enforce it themselves. Comparison results were subsequently guarded in [the next audit increment](comparison-worker-result-validation-2026-11-14.md). Hotel and vacation-package result envelopes remain open audit work.

## Evidence

- Initial focused test failed because the referenced result validator did not exist. Added tests for exact route/query preservation, malformed source schemas, stale fares, checked regional routes, and a Matrix group price that remains unverified.
- `node --test tests/flight-worker-result.test.mjs tests/flight-default-worker.test.mjs`: **6/6 passed**.
- Full `npm test`: **571/571 passed** in 95.8 seconds.
- `TRAVEL_NEXT_DIST_DIR=.next-flight-worker-result-build npm run build`: passed with Next.js 16.4.3.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:flight-default`: passed on the existing loopback app; provider/job calls were intercepted, with zero browser errors or application CSP violations.
- Same-origin POST `/api/health` at `2026-11-14T01:52:10.059Z`: status `ok`, queue depth 0, one live worker, zero expired leases/deadlines. Historical worker records were stale/stopped.

No live fare, provider, seller, or booking request was made for this change. The controlled browser fixture does not exercise the server worker-result validator; the durable `flight-default-worker` test exercises the normal worker path and the validator unit tests exercise rejection conditions. Overall work.md §17 remains Partial and the app remains local-only.
