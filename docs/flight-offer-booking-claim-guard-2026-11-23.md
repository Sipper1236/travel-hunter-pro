# Flight offer booking-claim guard — 2026-11-23

## Change

The shared flight-offer validator now rejects unsupported completion or seller-verification properties (`booked`, `bookingCompleted`, `reservationCompleted`, `reserved`, `ticketed`, `sellerVerified`, `checkoutVerified`, and `availabilityVerified`). It also rejects affirmative `bookingStatus` wording such as “booked,” “ticketed,” “reserved,” “booking complete,” or “reservation confirmed.” Explicitly non-completed observations such as “Not booked; seller not rechecked” remain valid.

Before the fix, an otherwise valid observed itinerary with `booked: true`, `sellerVerified: true`, or `bookingStatus: "Booked and ticketed"` passed `flightWorkerResultError`. Regressions now reject all three and accept the clear not-booked status. This protects the worker boundary against unsupported claims. It does not verify seller availability or establish that any offer is currently bookable; no booking or reservation is made by this path.

## Verification

- Focused flight-worker result tests: **13/13 passed**.
- Full `npm test`: **739/739 passed**.
- Isolated production build: `TRAVEL_NEXT_DIST_DIR=.next-flight-booking-claim-build npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:markdown-links`: all 146 tracked and untracked Markdown files passed.
- Controlled Playwright flight-default check passed with provider/job calls intercepted, zero browser errors, and zero application CSP violations.
- No provider request, seller refresh, purchase, or reservation was made.

The broad worker-schema, live quote, seller handoff, availability, baggage, mandatory-charge, and all-in checkout acceptance items remain open.
