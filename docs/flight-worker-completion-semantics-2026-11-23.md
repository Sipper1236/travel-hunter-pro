# Flight worker completion semantics — 2026-11-23

## Change

The flight-worker boundary no longer accepts `complete: true` when its source rows include a failed, partial, suppressed, or missing source result. If route coverage is present, a completed result must also account for every planned selected airport pair and every checked route must be marked complete. One-region coverage likewise cannot be complete while any checked airport is incomplete.

A red regression reproduced that an empty search with a provider error could still be marked complete. A second regression reproduced acceptance of a completed regional result that had checked only one of two planned airport pairs. Both now fail closed. These checks describe only the submitted bounded search; they do not claim exhaustive worldwide coverage or seller availability.

## Verification

- Focused flight-worker, location-streaming, and search suites: **35/35 passed**.
- Full `npm test`: **740/740 passed**.
- Isolated production build: `TRAVEL_NEXT_DIST_DIR=.next-flight-completion-build npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:markdown-links`: all 148 tracked and untracked Markdown files passed.
- Controlled Playwright flight-default check passed with provider/job calls intercepted, zero browser errors, and zero application CSP violations.
- The local root returned HTTP 200; same-origin worker health returned `ok`, one live worker, queue depth 0, and no expired leases or deadlines. Stale historical worker records remain present.
- No provider request, seller refresh, booking, or reservation was made.

Nested telemetry, every worker result schema, live quote freshness, seller confirmation, and all-in cost evidence remain open.
