# Flight worker price-observation schema — 2026-11-23

## Change

Flight-worker price-only observations now use an explicit top-level field allowlist: `id`, `provider`, route, departure/return dates, price/currency/scope, traveler/cabin scope, observation time, source URL, link label, `itineraryVerified`, and details. Unknown fields are rejected, including `sellerVerified` and `booked`; an observation must still declare `itineraryVerified: false` and pass the existing exact route/date/CAD/source checks.

Before the change, a valid Matrix price-only observation could carry arbitrary booking or seller-claim fields and still pass worker validation. Regressions now reject those injected fields while preserving valid Matrix and Omkar price-only output.

This is a field-name boundary plus the existing required-field checks; optional observation values do not yet have a complete field-by-field type schema. It does not convert a price-only observation into a flight itinerary or seller-confirmed fare.

## Verification

- Focused flight-worker, ITA Matrix, and Omkar suites: **56/56 passed**.
- Full `npm test`: **740/740 passed**.
- Isolated production build: `TRAVEL_NEXT_DIST_DIR=.next-flight-observation-schema-build npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:markdown-links`: all 149 tracked and untracked Markdown files passed.
- Controlled Playwright flight-default check passed with provider/job calls intercepted, zero browser errors, and zero application CSP violations.
- No provider request, seller refresh, booking, or reservation was made.
