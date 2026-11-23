# Bounded separate-ticket and alternate-pair check — 2026-11-09 01:02 UTC

## Exact query and observed baseline

One local-worker Ignav round trip searched YHZ–LAX for November 12–19, 2026, with one adult, no children, economy and CAD. It completed at `2026-11-09T01:02:35.132Z`; Ignav returned 280 itineraries and 137 passed application validation. The selected fresh observation was CAD 1,039, observed at `2026-11-09T01:02:34.212646Z`, with these exact flights:

- Outbound: AC 613 YHZ–YYZ; AC 793 YYZ–LAX.
- Return: AC 790 LAX–YYZ; AC 600 YYZ–YHZ.

## Bounded comparison

The comparison preserved the selected flights, dates, round-trip structure, adult party, economy cabin and CAD constraint. It planned two additional exact airport pairs, YUL–LAX and YYZ–LAX, within a ten-request budget. Seven fare requests were started: the baseline refresh, both pair requests, and four exact ticket-block queries. The optimizer found two eligible ticket groupings, four unique ticket blocks and two priced blocks, but **zero complete separate-ticket plans**. No split-ticket total or saving is reported.

Across the three route responses, 428 candidate itineraries were returned; 427 matched the fresh CAD route/date/cabin/chronology and filter constraints. Eight were displayed and 419 omitted by the display cap. Provider completion was known, but at least one response was incomplete. Both requested alternate pairs returned responses without a provider stop; no pairs remained unsearched. Discovery was bounded and `exhaustive` remained false.

## Interpretation and limits

These are observed source results, not a seller-verified itinerary or booking. This run did not establish simultaneous seat inventory, ticket issuance, baggage, mandatory charges, ground transfers, entry feasibility, protection, or a final payable total. No booking link, checkout, reservation, or purchase was attempted. The quote is historical and must be refreshed before use.

## Coverage-reporting correction

Review found that the UI called every attempted alternate-pair request “refreshed,” including provider refusals. Coverage now distinguishes attempted pairs, pair searches that returned without a provider stop, stopped pairs, and pairs not attempted. A regression confirms a rate-limited pair appears as attempted/stopped, not searched, while later budgeted pairs remain unsearched. The UI names the exact pairs and avoids saying all pairs succeeded when the provider stopped.

Verification after this correction: focused comparison tests 49/49; full `npm test` 534/534; `npm run build` passed; `npm audit --audit-level=low` found zero vulnerabilities; rebuilt-loopback `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:separate-ticket-results` passed with provider/job requests intercepted, external browser requests blocked, and zero page errors. These tests verify reporting and UI wiring, not live seller acceptance.

P3 and overall `work.md` §17 remain Partial.
