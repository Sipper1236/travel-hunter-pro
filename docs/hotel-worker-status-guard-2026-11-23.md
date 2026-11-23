# Hotel worker status guard — 2026-11-23

## Finding

The hotel worker validator accepted arbitrary top-level result statuses, including `booked`. That could let a worker label an observed or empty search with a state the hotel adapters never produce. The Booking.com, multi-room, and official-source paths emit a finite set of search outcomes; none can confirm a completed booking.

## Change

The validator now allows only the statuses emitted by those adapters and shared source transport. If an envelope contains offers, an optional top-level status must be `complete` or `partial`. The guard continues to permit source-failure and explicit no-observation outcomes for empty results.

The same focused run exposed an existing test-isolation error: `createJobStore` accepts an options object, but the official-hotel cache test passed a path string and silently used the default database. The test now uses `createJobStore({path: db})`, keeping cache assertions isolated in its temporary directory.

## Verification

- Test-first regression reproduced acceptance of `status: "booked"`.
- Hotel search, worker, Demand API, official Reservit, and Flight + Hotel suites passed **71/71**.
- Full `npm test` passed **726/726**.
- `npm run build` passed on Next.js 16.4.6; `npm audit --audit-level=low` found **0 vulnerabilities**.
- `npm run check:markdown-links` checked **140 files** with no broken links; `git diff --check` passed.
- No provider or seller request was made.

