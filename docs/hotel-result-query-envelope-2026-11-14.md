# Hotel result query-envelope validation — 2026-11-14

## Finding and fix

The hotel result validator checked every non-empty offer against the submitted stay, but returned early for an empty result. That allowed a hotel worker to persist an empty envelope whose query had different stay dates, even though it could not falsify a price. Added a root query-preservation check before the empty-result branch. It compares every canonical validated field and permits only the known city normalization performed after the destination resolver; when a verified destination is present, the returned city must equal that canonical destination. Added a regression for the mismatched empty-result envelope.

The package guard also rejects malformed null offer entries without throwing while inspecting them, and accepts an explicit `currency_unverified` empty result. Both worker validators remain fail-closed for priced results.

## Verification

- Hotel validator plus the actual official Reservit worker: 9/9 passed.
- Package result validator: 5/5 passed.
- Full `npm test`: 590/590 passed (85.7 seconds).
- `TRAVEL_NEXT_DIST_DIR=.next-hotel-package-final npm run build`: passed (Next.js 16.4.3).
- `npm audit --audit-level=low`: zero vulnerabilities.
- Fresh-build loopback Chromium `check:hotel-occupancy`, `check:hotel-room-handoff`, and `check:package-infant-guidance` passed on port 3001. Provider calls were intercepted; no DOB was sent; no browser errors were reported. The temporary server was stopped; existing port 3000 was not changed.

These checks validate application/result consistency. They do not establish supplier inventory, seller availability, exact hotel room type, simultaneous multi-room supply, final charges, package property address, or checkout price. §17 remains Partial and local-only.
