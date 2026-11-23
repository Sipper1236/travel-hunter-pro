# Comparison worker status guard — 2026-11-23

## Finding

The comparison worker checked itinerary plans, exact query data, and request budgets but did not validate the top-level status. It accepted invented values such as `booked`, and it accepted a segment-comparison result with no status even though `compareSeparateTickets` always returns one.

## Change

Segment-mode results now require a status emitted by the segment comparison producer: `observed`, `baseline_unavailable`, `itinerary_ineligible`, `filter_ineligible`, `connection_ineligible`, `budget_exceeded`, `source_unavailable`, `baseline_expired`, or `segment_unavailable`; the outer execution wrapper may replace these with `budget_exhausted`. Party-split results may omit status, as their producer does, or carry only the wrapper's `budget_exhausted` status. Existing validation still prevents an exhausted result from claiming plans.

## Verification

- Test-first regressions reproduced acceptance of an invented `booked` status and a missing segment-mode status.
- Focused comparison endpoint, runner, search, worker, result-guard, and separate-ticket suites passed **62/62**.
- Full `npm test` passed **725/725**.
- `npm run build` passed on Next.js 16.4.6; `npm audit --audit-level=low` found **0 vulnerabilities**.
- `npm run check:markdown-links` checked **139 files** with no broken links; `git diff --check` passed.
- No provider or seller request was made.

