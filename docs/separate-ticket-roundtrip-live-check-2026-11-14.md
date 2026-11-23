# Bounded live round-trip ticket comparison — 2026-11-14

## Query and source

One live backend comparison used Ignav for YHZ–LAX, outbound 2026-12-15, return 2026-12-22, one adult, economy, CAD. A separate initial search selected a current CAD 777 round-trip baseline with two exact segments in each direction (`observedAt` 2026-11-14T01:12:37.528Z). The optimizer refreshed that exact itinerary and searched one explicitly bounded alternate airport pair, YYZ–LAX. It used a 180-minute minimum self-transfer buffer, did not split travelers, did not group adjacent segments into larger tickets, and had a 20-request optimizer budget.

## Observed result

- Baseline discovery received 45 results and accepted 39.
- The comparison executed 8 optimizer requests; including the separate baseline-selection query, this check used 9 provider queries total.
- Six exact-flight ticket blocks (outbound/inbound through tickets and individual segment tickets) all received a qualifying fresh CAD quote. Four complete round-trip combinations were priced.
- The lowest observed plan was CAD 772 versus the refreshed CAD 777 baseline, a CAD 5 lower provider-reported total before extras. Its earliest quote expiry was 2026-11-14T01:27:37.528Z.
- One alternate pair was planned, attempted and searched. Responses contained 99 candidates; 98 matched the route/date requirements, 8 were displayed and 90 matching alternatives were omitted at the display cap. Provider completion was known to be incomplete; coverage remained `exhaustive: false`.
- The exact-flight optimizer matches each segment's airports, marketing flight number, operating-carrier identity when supplied, and UTC departure/arrival instants; it preserves round-trip dates and reports exact ticket block coverage. The live plan remained subject to the optimizer's explicit caveat that independently sourced ticket inventory may overlap.

## Verification and limits

- `node --test tests/separate-tickets.test.mjs tests/comparison-search.test.mjs`: **50/50 passed**, including freshness, budget, exact-flight, chronology, traveler/guardian and round-trip regressions.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:separate-ticket-results`: passed with provider/job requests intercepted and external requests blocked; zero page errors. The controlled UI fixture showed exact segment IDs and passed the comparison owner capability to the exact-ticket lookup.
- This was a direct bounded backend call, not a website-submitted live fare search. The UI check was controlled fixture evidence. No seller handoff or checkout was opened. Availability, seat inventory, baggage, mandatory charges, split-ticket protection, change/refund terms and seller issuance remain unverified. Prices were observations, not purchases or reservations. One route pair and one date/party shape do not establish broad coverage.
