# Air Canada Vacations result-page request bound — 2026-11-14

## Change

The package provider's “show more” operation is now bounded by the selected package result limit. A 20-card request inspects only the initial page; a 40-card request may expand one additional provider page. The worker-result validator rejects a result envelope that claims more expansions than the selected budget permits. If fewer cards are returned than requested and the provider still exposes more results, the coverage stays partial and reports that further listings remain beyond the searched page budget.

The browser regression simulates a provider that appends one card for each click. A 40-card request now performs exactly one expansion, records that one page yielded only 13 visible cards, and leaves `moreAvailable: true`; a 20-card request makes no further click. This prevents provider page size from multiplying the request count unexpectedly.

## Verification

- `node --test tests/vacation-search.test.mjs tests/package-worker-result.test.mjs tests/official-hotel-worker.test.mjs tests/hotel-worker-result.test.mjs`: 35/35 passed before the final wording refinement.
- `node --test tests/vacation-search.test.mjs tests/package-worker-result.test.mjs`: 22/22 passed after the wording refinement.
- Full `npm test`: 597/597 passed in 189.2 seconds.
- `TRAVEL_NEXT_DIST_DIR=.next-p6-page-bound npm run build`: passed; a second final-wording build at `.next-p6-page-disclosure` passed.
- `npm audit --audit-level=low`: zero vulnerabilities.
- Fresh-build `TRAVEL_CHECK_URL=http://127.0.0.1:3001 npm run check:package-infant-guidance`: passed with 0 provider calls, 6 fixture job calls, exact child age derived in-browser, no DOB sent, and no browser errors. Temporary port 3001 was stopped.

The full test and first build ran before a user-facing wording refinement from “beyond the limit” to “beyond the searched page budget”; the focused package tests and final build were run after that refinement. No supplier request or live package search was made.

## Remaining P6 / §17 gaps

This is a provider request-budget safeguard, not evidence of live result coverage. Children and infants remain limited to one room where the widget requires it; adult room assignment is not exposed by the provider. Property address, exact room, simultaneous availability, taxes/local charges, final price, and checkout eligibility remain unverified. P6 remains Partial.
