# Vacation-package worker result validation — 2026-11-14

## Change

ACV package child-worker results are now validated before persistence. The guard revalidates the submitted package query and checks the returned result and each offer against it: exact origin/destination labels, airport codes, dates, adults, room count, child ages, lap-infant count/ages, selected star, budget and stop filters. It requires the exact ACV listing URL and its route/date/party parameters, official CAD-terms URL, current observation timestamp, positive CAD group total, provider occupancy echoes, destination-city agreement, and coherent bounded panel/card coverage. Offer and rejection counts must reconcile. Empty observed results remain valid when coverage is coherent.

This does not establish seller-confirmed inventory or price, property address, room category, complete local fees, booking eligibility, or checkout total. The widget's adult multi-room allocation remains unexposed; the existing result discloses that limitation. No live supplier query was performed.

## Verification

- `node --test tests/package-worker-result.test.mjs`: 5/5 passed, including an offer produced by `normalizeVacationListing`, plus query/source/date/destination/party mutation, stale/non-CAD/over-budget/over-stop rejection, and valid empty coverage.
- Full `npm test`: 589/589 passed (86.8 seconds).
- `TRAVEL_NEXT_DIST_DIR=.next-package-worker-result npm run build`: passed on Next.js 16.4.3.
- `npm audit --audit-level=low`: zero vulnerabilities.
- Fresh-build Chromium `check:package-infant-guidance` passed on loopback port 3001 with provider calls intercepted (0 provider calls), six controlled job calls, and no DOB sent. The temporary server was stopped; the existing port-3000 service was not changed.

The browser test exercises the existing package form and disclosure only; it uses a controlled job fixture and does not prove live offer availability or seller acceptance.
