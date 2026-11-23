# Shared flight-segment chronology guard — 2026-11-23

## Change

The shared flight-offer validator now checks every segment's elapsed time from explicit offset-aware timestamps. It accepts minute-precision and second-precision ISO timestamps with `Z` or a numeric offset, rejects invalid timestamps and the unknown `-00:00` offset, and rejects disagreement among the segment's supplied local/UTC timestamp fields. A segment must arrive after it departs, and each connection must depart at or after the preceding segment arrives.

If any segment supplies an offset-aware timestamp, every segment must provide both an offset-aware departure and arrival. A multi-segment itinerary with no offset-aware chronology is rejected. Existing one-segment legacy fixtures with only local timestamps remain supported. Round trips additionally require offset-aware outbound arrival and inbound departure, and reject an inbound departure earlier than the outbound arrival.

This is a shared result-integrity boundary; it does not prove that an airport's declared timezone is authoritative, validate fare eligibility, or confirm seller availability. Expedia's adapter separately derives elapsed journey duration from its first departure and final arrival; its existing test covers layovers, invalid chronology, and missing offsets. Provider access and live Expedia duration behavior remain unverified.

## Verification

- Test-first regressions reproduced acceptance of an impossible connection and an inbound leg beginning before the outbound arrival.
- Focused cross-provider checks: **100/100** across the flight worker result, ITA Matrix, Google round trip, Expedia, Ignav, and Skyscanner suites.
- Full `npm test`: **737/737 passed**.
- Isolated production build: `TRAVEL_NEXT_DIST_DIR=.next-flight-chronology-build npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `npm run check:markdown-links`: all 144 tracked and untracked Markdown files passed.
- Controlled Playwright check: `npm run check:flight-default` passed against the local website. It intercepted provider/job boundaries, confirmed the default flight flow does not start comparisons automatically, and reported zero browser errors and zero application CSP violations; the site root returned HTTP 200.
- Same-origin local worker health returned `ok`, one live worker, queue depth 0, and no expired leases or deadlines; stale historical worker records were also reported.
- No live fare/provider request, booking, or reservation was made.

This closes one shared chronology defect only. Complete source-specific timestamp semantics, all worker contracts, current quotes, seller handoff, and every applicable `work.md` §17 criterion remain open.
