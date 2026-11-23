# Flight worker source-row field boundary — 2026-11-23

## Change

The flight-worker validator now rejects unrecognized fields on provider status rows, including nested rows in regional airport-pair coverage. The allowlist retains fields used by current adapters and orchestration: provider/status, operation, response and acceptance counts, reason/provider refusal metadata, route, native Google coverage, Matrix timing/detail coverage, Skyscanner polling, Omkar diagnostics, Ignav rejection counts, filter rejections, cache state, and suppression state.

A regression showed a source row with otherwise valid accepted flight coverage and an injected `sellerVerified: true` was accepted. It now fails validation. This complements the already-added top-level result allowlist and offer booking-claim guard.

This validates source-row field names and count fields only. Nested telemetry objects, source-status values for empty results, price-observation metadata, coverage subtrees, and provider-specific evidence still need field-by-field validation. No live provider call or seller check was performed.

## Verification

- Focused flight-worker and cross-provider suites: **99/99 passed**.
- Full `npm test`: **739/739 passed**.
- Isolated production build: `TRAVEL_NEXT_DIST_DIR=.next-flight-source-schema-build npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:markdown-links`: all 147 tracked and untracked Markdown files passed.
- Controlled Playwright flight-default check passed with provider/job calls intercepted, zero browser errors, and zero application CSP violations.
- No provider request, seller refresh, booking, or reservation was made.
