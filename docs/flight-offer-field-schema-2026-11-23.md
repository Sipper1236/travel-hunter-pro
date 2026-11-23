# Flight offer top-level field schema — 2026-11-23

## Change

The shared `flightOfferError` boundary now rejects offer properties outside the top-level fields emitted by the configured flight adapters. This closes a gap where a field such as `sellerConfirmed: true` could be added to an otherwise valid fare and silently pass validation. Existing explicit booking-claim checks still run first, preserving their specific failure reason. Provider metadata currently used by Google Flights, Expedia, Ignav, ITA Matrix, Skyscanner, Air Canada NDC, and Expedia via Omkar remains allowed.

The regression was added at the public flight-worker result boundary in `tests/flight-worker-result.test.mjs`. Before the validator change, the targeted test failed because `sellerConfirmed` was accepted. Afterward, the cross-provider regression run passed 195/195 and the complete `npm test` run passed 740/740.

## Verification

- `npm test` — 740/740 passed.
- `TRAVEL_NEXT_DIST_DIR=.next-flight-offer-field-schema-build npm run build` — passed on Next.js 16.4.6.
- `npm audit --audit-level=low` — zero vulnerabilities.
- `npm run check:flight-default` — passed against the loopback app. Provider and job endpoints were intercepted; one normal search was submitted, no automatic comparison ran, reload did not enqueue a second search, and the explicit comparison control remained operable. Browser errors and application CSP violations: zero. The check separately counted 33 Next.js devtools inline-style CSP events.
- The local site returned HTTP 200 at `http://127.0.0.1:3000`; the existing `dev:stack` and worker were already running. The page was opened locally. No live fare, seller, reservation, or booking request was made.

## Limits

This is a top-level key allowlist, not a recursive schema. Nested segment, inbound-leg, time-evidence, provider-selection, and other metadata values are not all recursively validated by this change. The allowlist also does not establish that an adapter's claimed fare, currency, traveler eligibility, live inventory, baggage, taxes, seller acceptance, or checkout total is true. The broader `work.md` §17 criteria remain open.
