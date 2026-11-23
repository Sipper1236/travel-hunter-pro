# Flight worker top-level schema boundary — 2026-11-23

## Change

The flight worker result guard now rejects unknown top-level fields. This prevents an adapter or persisted payload from attaching unsupported claims such as `booked: true` or `sellerVerified: true` to an otherwise valid observed itinerary. The allowlist retains fields currently emitted by source adapters, progressive location search, and the job runner, including Matrix `searchUrl`, Air Canada `responseId`, route coverage, source and filter coverage, location evidence, and streaming metadata.

The regression first failed because the validator returned `null` for those unsupported claims. Full-suite testing then found that Skyscanner progressive updates duplicated `filters` outside their canonical `query`; the adapter now keeps the exact filters in `query`, where the worker already validates them, and omits the redundant copy. This avoids accepting an unvalidated second representation.

This increment validates top-level field names only. It does not complete field-by-field nested schemas for offers, sources, coverage, streaming metadata, or all worker result types. It makes no live-price, seller, booking, or inventory claim.

## Verification

- Focused flight-worker and Skyscanner suites: **31/31 passed**.
- Full `npm test`: **738/738 passed** after removing the duplicate Skyscanner field.
- Isolated production build: `TRAVEL_NEXT_DIST_DIR=.next-flight-schema-build npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:markdown-links`: all 145 tracked and untracked Markdown files passed.
- Controlled Playwright flight-default check passed against the local website with provider/job calls intercepted, zero browser errors, and zero application CSP violations. The root returned HTTP 200.
- Same-origin health returned `ok`, one live worker, queue depth 0, and no expired leases or deadlines; stale historical worker records remain present.
- No live provider request, booking, or reservation was made.
