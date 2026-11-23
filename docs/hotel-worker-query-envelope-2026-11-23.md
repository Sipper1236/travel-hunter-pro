# Hotel worker query envelope — 2026-11-23

## Finding

`hotelWorkerResultError` compared every normalized submitted field with the result query, but it did not reject additional keys. An adapter or malformed worker payload could therefore persist an unrequested source or other query metadata without changing any submitted constraint.

## Change

The guard now rejects unknown result-query keys. It permits the two fields added by destination resolution (`destination` and, for the browser Booking.com path, `cityId`); when the latter is present it must match the resolved destination's `cityId`. Existing submitted constraints and city normalization checks still run.

## Verification

- Test-first regression: before the change, an injected `unrequestedSource` field was accepted.
- `node --test tests/hotel-worker-result.test.mjs` passed **14/14** after the change.
- Full `npm test` passed **725/725**.
- `npm run build` passed on Next.js 16.4.6; `npm audit --audit-level=low` found **0 vulnerabilities**.
- `npm run check:markdown-links` checked **137 files** with no broken links; `git diff --check` passed.
- This is fixture evidence. No hotel provider request was made; destination/property evidence, simultaneous availability, mandatory charges, and checkout totals remain separate open acceptance items.

