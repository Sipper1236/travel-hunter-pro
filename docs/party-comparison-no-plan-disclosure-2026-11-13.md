# Same-flight party comparison no-plan wording — 2026-11-13

## Finding and change

The same-flight party-split panel headed an empty plan list with “No current exact-flight plans found.” That wording could be read as a supplier-inventory conclusion even when a party query was refused or incomplete. The result already carries a source-specific limitation; the heading now says “No complete same-flight booking plan was priced,” which describes the observed comparison outcome without claiming availability.

The separate-ticket panel is not affected: its per-block disclosure already says missing quotes are not evidence that a flight is unavailable for sale.

## Verification

- Added the no-plan/provider-refusal case to `scripts/check-party-partition-ui.mjs`. It failed against the old production UI because the new label was absent, then passed after the UI update.
- `TRAVEL_NEXT_DIST_DIR=.next-party-partition-status-build npm run build` — passed on Next.js 16.4.3.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3002 npm run check:party-partition` — passed on the isolated production build. The browser displayed both a priced guardian-linked plan and a second provider-refused comparison with no complete plan; provider/job calls were intercepted, off-origin requests were blocked, and there were zero page errors.
- `npm test` — 557/557 passed.
- `npm audit --audit-level=low` — zero vulnerabilities.

This is fixture/UI evidence. It does not establish supplier inventory, fare eligibility, simultaneous seats, seller availability, or booking acceptance. No live supplier request or booking action occurred. P2/P3 and `work.md` §17 remain Partial.
