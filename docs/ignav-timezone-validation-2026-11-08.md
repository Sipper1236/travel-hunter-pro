# Ignav local-time and UTC consistency check — 2026-11-08

## Finding

The Ignav adapter required parseable local and offset-aware UTC timestamps, but did not compare them. It used local timestamps for query-date and traveler-age checks, while elapsed-duration calculations used UTC instants. A contradictory provider response could therefore pass with conflicting date/age and elapsed-time evidence. Seller itinerary identity also omitted local wall times.

## Contract evidence

Ignav's [official response format](https://ignav.com/docs/response-format) documents airport-local wall times, nullable IANA timezone fields for departure and arrival, and corresponding UTC timestamps. The contract says clients can use those UTC timestamps rather than deriving elapsed time from local clocks. The adapter now requires the local time/UTC pair to agree in each provider-declared IANA timezone; missing, invalid, or contradictory values cause the itinerary to be excluded. The adapter makes no additional timezone-directory or fare request. The provider-declared timezone is not independently verified against an airport directory.

## Implementation and verification

- `lib/airport-timezones.mjs` now exports a check that renders an instant in an IANA timezone and compares it to the exact airport-local wall time, including seconds and repeated DST-hour cases.
- `lib/ignav.mjs` validates all outbound and inbound segment pairs before normalizing a fare. Booking itinerary identity now includes local departure and arrival timestamps; a seller response changing a local-time claim cannot match the saved selection.
- `tests/ignav.test.mjs` reproduces the previous acceptance of a one-hour local/UTC mismatch, verifies exclusion, and covers seller mismatch behavior. `tests/airport-timezones.test.mjs` checks Halifax offset conversion, mismatches, and both instants in a New York repeated DST hour.
- Red phase: the new Ignav regression failed before the adapter check (`1 !== 0`, one contradictory offer accepted). Green phase: passed after the fix.
- Focused verification: `node --test tests/ignav.test.mjs tests/airport-timezones.test.mjs tests/calendar-worker.test.mjs tests/comparison-worker.test.mjs tests/flight-default-worker.test.mjs` — 37/37 passed.
- Full verification: `npm test` — 524/524 passed; `npm run build` passed; `npm audit --audit-level=low` reported 0 vulnerabilities.
- Rebuilt browser check: `TRAVEL_CHECK_URL=http://127.0.0.1:3001 npm run check:booking-links` passed against the final build, zero browser errors, external requests blocked. This checks seller-handoff presentation and mismatch suppression, not live seller availability.

No live fare or seller request was made for this fix. Expedia's independent elapsed-duration behavior and current provider data consistency remain separate acceptance requirements. Carrier eligibility, seller acceptance and the other open `work.md` §17 criteria remain incomplete; the overall project is not complete.
