# Worker recovery retry status UI — 2026-11-13 18:50 UTC

## Change

Persisted `next_attempt_at` is exposed as `retryAt` in queued job status while a worker recovery is waiting. The flight search, fare calendar, and comparison status views render when the next worker attempt is scheduled. Once the retry becomes claimable, the timestamp is omitted. This gives the job owner a concrete recovery status instead of an unexplained queued state.

The status endpoint remains owner-capability protected. This UI does not change provider retry behavior, request budgets, or recovery limits. The underlying durable lease policy remains bounded to two flight/comparison/calendar recoveries with 1s, then 2s delays (30s maximum); package/hotel browser leases still do not replay.

## Current verification

- `npm test`: **551 passed, 0 failed** (85.5 seconds).
- `TRAVEL_NEXT_DIST_DIR=.next-worker-retry-status-build npm run build`: passed; Next.js 16.4.3 compiled, type-checked, generated all 20 static pages, and completed route optimization.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:worker-retry-status` rerun at 19:04 UTC: passed on production Chromium; retry notices were visible for queued flight and comparison jobs, provider requests were intercepted, and there were no browser or application CSP errors. The calendar notice is present in the component but does not yet have an independent browser assertion.
- `npm run check:flight-default` rerun at 19:04 UTC: passed; ordinary search still starts one flight job, reload does not re-enqueue, and no automatic comparison starts.
- `npm run check:accessible-controls`: passed with 112 named controls, no duplicate IDs/broken ARIA references, 8 labeled fieldsets, keyboard airline suggestion behavior, and 85 rendered Tab targets traversed. No live search was submitted.
- Fresh local production server and worker are running at `http://127.0.0.1:3000`. Same-origin POST `/api/health` returned `ok`, queue depth 0, one live worker, 0 expired leases, and 0 expired deadlines. The health response contains nine stale historical worker records; they are not live.

All browser checks used controlled fixtures/intercepts; no supplier search was run. This evidence closes the visible retry-time status behavior only. P12 remains **Partial**: provider-level retry policy, deployment authentication, monitoring, off-host recovery, abuse/security gates, and other `work.md` acceptance criteria remain open. The site remains loopback-only; no booking, reservation, public deployment, or purchase occurred.
