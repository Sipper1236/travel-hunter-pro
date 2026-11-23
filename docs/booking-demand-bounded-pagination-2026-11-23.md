# Booking.com Demand API bounded pagination — 2026-11-23

## Change

The read-only Demand API adapter now follows at most one provider-issued `metadata.next_page` token. Each accommodation search requests 30 rows; at most two exact pages (60 returned property rows) are considered. The continuation request contains only `{ page: token }`, as the v3.3 pagination contract specifies. Tokens are passed only to the fixed Booking.com Demand API host, are length/control-character checked, are never stored in coverage or returned results, and are not decoded or reconstructed.

Each successful page is tied to its own observation timestamp and provider-page index. Property IDs are deduplicated across pages. The adapter verifies each page's property details before requesting the continuation page, avoiding an unnecessary second search if the first page cannot be verified. It retains only offers that still match the exact property ID, destination, star class, room products, requested ages/allocations, CAD product totals, charge evidence, and safe Booking.com URL. Coverage reports the two-page ceiling, rows returned, pages checked, a provider total only when every checked page reports the same valid total, whether more rows may remain, and a sanitized pagination outcome.

If the continuation search or its property-details request fails, validated offers from earlier pages remain available and the result is marked partial. The source result preserves the error status while retaining `observed` status for already accepted offers. Malformed tokens are not sent; repeated or third-page tokens cannot exceed the fixed two-page budget. The existing shared provider pacing and `Retry-After` handling apply to every request, and POSTs are not automatically retried.

## Evidence

- The current [Booking.com Demand API pagination guide](https://developers.booking.com/demand/docs/development-guide/pagination) states that accommodation `rows` must be a multiple of 10, continuation uses the response's `next_page` as the next request's `page`, and the continuation request inherits the original query. The guide also says continuation tokens expire after three hours.
- Red/green regression coverage proves page-token forwarding, exact two-page limits, 60-row maximum coverage, consistent totals, separate timestamps, first-page retention on continuation-search or details failures, malformed-token rejection, and no token echo.
- `node --test tests/booking.test.mjs tests/hotel-worker-result.test.mjs`: **29 passed, 0 failed**. A controlled browser fixture also checks that the page-failure limitation is visible to users; it intercepts all provider calls.
- Full `npm test`: **715 passed, 0 failed**. `npm run build`: passed with Next.js 16.4.6. `npm audit --audit-level=low`: **0 vulnerabilities**. `npm run check:markdown-links`: passed for 133 Markdown files.
- Production Chromium `TRAVEL_CHECK_URL=http://127.0.0.1:3121 npm run check:booking-demand`: passed; exact two-room ages were submitted to the intercepted job boundary, the partial-page notice appeared, `providerCalls: 0`, and browser errors were zero. The temporary server was stopped. This checks the UI fixture only, not live Demand inventory.
- No live Demand API request was made. `BOOKING_API_TOKEN` and `BOOKING_AFFILIATE_ID` are not configured, so this is fixture evidence only; no live inventory, latency, fee, room, or seller claim is made.

## Remaining work

P4 and `work.md` §17 remain **Partial**. Add no live calls until approved partner credentials and query scope are available. Then verify the exact v3.3 page shape, result totals, multi-room/child allocations, request pacing and rate behavior against the authorized account or sandbox. Continue to require seller recheck, availability, all mandatory/conditional charges and comparable checkout totals; no booking or order-preview write is part of this change.
