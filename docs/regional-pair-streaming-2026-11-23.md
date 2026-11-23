# Bounded regional airport-pair overlap — 2026-11-23

## Change

Two-region searches previously waited for every selected source on one exact airport pair before starting the next pair. They now allow at most two airport pairs in flight for region searches that are one-way, count-only, and adult-only. These query shapes use HTTP-backed provider paths; each provider still passes through its existing shared pacing/cooldown. Routes with children, youths, seniors, infants, identified travelers, or round trips remain sequential because they can use browser-backed Matrix or Google session flows. Ordinary multi-airport city/place expansion also remains sequential.

Each result is written into its planned route slot, so final `checked` coverage and combined offers stay in deterministic route order even when a later pair finishes first. Every completion reports accurate `pairsChecked` and `pairsInFlight`; source-stop responses prevent new pair dispatches while allowing already-started requests to finish and appear in coverage. Existing exact route constraints, filters, per-route checkpoints, response streaming, and unsearched-pair accounting remain in place.

## Verification

- `node --test tests/search.test.mjs tests/location-search.test.mjs tests/location-search-streaming.test.mjs tests/flight-worker-result.test.mjs`: **36/36 passed**.
- Full `npm test`: **665/665 passed**.
- `npm run build`: passed after retrying Next.js 16.4.3's security reminder.
- `npm audit --audit-level=low`: one moderate Next.js 16.4.3 advisory remains; the forced fix installs 16.4.6 outside the declared range, so no dependency update was made.
- `git diff --check`: clean before publication.
- Added delayed-pair regression proves the third route begins before an earlier route completes and checks deterministic final coverage order.
- Added party regression proves child-party regional searches remain sequential. Source-stop regression verifies no additional routes are dispatched after a refusal, beyond the already-active pair.
- No live provider request or browser query was made. These tests prove scheduling behavior, not a real provider speedup or latency percentile.

## Limits

The active cap is two airport pairs, and every provider retains its shared local pacing and cooldown. An active pair may complete after another pair triggers a stop; that route is included in checked coverage. Region selection remains bounded by `airportLimit`, resolver caps, and the provider adapters selected/configured by the request. Reverse-endpoint completeness and `work.md` §17 remain open.
