# Flight worker source-evidence integrity — 2026-11-14

## Change

The durable flight-result validator now checks that every displayed priced offer and each ITA Matrix price-only observation is backed by a corresponding successful source row. It verifies provider identity, supported successful status, operation where supplied, positive accepted/price-observation counts, and that those counts do not exceed received observations.

For regional searches, evidence must be attached to the exact airport-pair route in `coverage.checked`. A top-level source row cannot replace missing route-level evidence. This prevents a worker result from presenting an itinerary or Matrix price observation as covered when its source status belongs to another route or does not show an accepted result.

The Google Flights native adapter now reports accepted offer counts so its actual result shape satisfies the strengthened contract.

## Regression coverage

Added checks for absent source rows, provider mismatch, blocked status, zero accepted evidence, accepted counts exceeding received counts, missing exact-route evidence despite a global row, and Matrix observations without positive price-observation evidence.

## Verification

- Focused command: `node --test tests/flight-worker-result.test.mjs tests/providers.test.mjs tests/google-native.test.mjs tests/region-search.test.mjs tests/regions.test.mjs` — 26/26 passed.
- Full command: `npm test` — 598/598 passed in 180.2 seconds.
- Build: `TRAVEL_NEXT_DIST_DIR=.next-flight-source-coverage npm run build` — passed on Next.js 16.4.3.
- Audit: `npm audit --audit-level=low` — 0 vulnerabilities.
- Fresh-build browser checks: `check:flight-default` and `check:region-coverage` passed against loopback port 3001. Provider calls were intercepted; browser error count and CSP violations were 0. The flight check confirmed one normal search start, no automatic comparison or reload enqueue, and explicit comparison; region checks confirmed M49 policy, popularity shortfall, unknown traffic, omitted airport boundaries, unsearched airports and outside-pair counts.
- Temporary server stopped; ports 3000 and 3001 were clear after verification.
- No live fare/provider request was made.

## Limits and next work

This validates consistency of the worker envelope, not the truth or currentness of a provider response. It does not establish full offset-aware journey chronology, seller availability or issueability, baggage, mandatory charges, exact-age carrier eligibility, simultaneous inventory, or exhaustive geographic coverage. P0 and `work.md` §17 remain Partial; the application remains local-only. Continue with the highest-priority open acceptance items in `work.md` and attach live evidence only when obtained through authorized source behavior.
