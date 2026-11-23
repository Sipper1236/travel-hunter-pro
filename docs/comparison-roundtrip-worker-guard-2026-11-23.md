# Comparison worker round-trip exact-flight guard — 2026-11-23

## Change

The comparison worker previously parsed the round-trip itinerary key as if it contained segment arrays directly. The canonical query stores two serialized direction keys inside one serialized pair, so valid round-trip split-ticket plans were rejected at the persistence boundary. The same validator compared only the marketing-flight fields and did not bind the operating carrier, even though the itinerary key records it.

The validator now parses exactly two nested direction keys for round trips, requires each flight signature to contain all nine fields, and compares the operating-carrier code (including an explicit `null`) alongside the marketing carrier, flight number, airports, and local/UTC timestamps. The regression uses exact outbound and inbound segment blocks, then verifies that changing a return flight or operating carrier is rejected.

## Verification

- Test-first regression reproduced the prior rejection of a valid round-trip plan, then reproduced acceptance of a plan whose operating carrier differed from the selected itinerary.
- Focused comparison/separate-ticket suites passed **41/41**.
- Full `npm test` passed **720/720**.
- `npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low` found **0 vulnerabilities**.
- No live provider, seller, or booking request was made; evidence is fixture-based.

## Remaining limits

This closes one exact-flight persistence bug. It does not prove that split tickets are currently available, concurrently bookable, accepted by carriers for the full party, or valid after baggage, connection, transfer, and mandatory charges. The live separate-ticket and seller-verification acceptance criteria in `work.md` remain open.
