# Comparison worker exact-itinerary validation — 2026-11-23

## Change

The comparison result boundary had two itinerary-integrity gaps:

- Separate-ticket round-trip keys store two serialized direction keys inside one serialized pair. The worker treated them like direct segment arrays, rejected valid plans, and did not compare operating carrier even though the key includes it.
- Party-split plans could pass with placeholder segments and an unrelated itinerary key. Their route, dates, airport-local/UTC agreement, chronology and return summary were not checked before persistence.

The worker now parses exactly two nested direction keys, requires each signature to have exactly nine fields, and compares operating carrier with the marketing carrier, flight number, airports and local/UTC timestamps. Party-split plans are validated against requested endpoints and dates; every segment must have a connected route, offset-aware instants, and local timestamps consistent with its attached IANA timezones. Round-trip returns must follow outbound arrival, preserve their summary fields, and rebuild the exact two-direction itinerary key from observed segments.

## Verification

- Test-first regressions reproduced valid-round-trip rejection, ignored operating-carrier changes, acceptance of unknown signature fields, and acceptance of placeholder party-plan segments. Tests now also reject unrelated keys, local/UTC mismatches, changed return flights and impossible return chronology.
- Focused comparison result and worker suites passed **10/10**.
- Full `npm test` passed **721/721**.
- `npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low` found **0 vulnerabilities**.
- No live provider, seller, or booking request was made; evidence is fixture-based.

## Remaining limits

This closes worker-result integrity gaps only. It does not prove current fare availability, simultaneous inventory, seller issuance, carrier eligibility, or totals after baggage, transfer and mandatory charges. The live separate-ticket and seller-verification acceptance criteria in `work.md` remain open.
