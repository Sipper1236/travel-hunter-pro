# ITA Matrix partial results in fare calendars — 2026-11-23

## Change

The Matrix provider already emits validated partial results through its `onUpdate` callback. The calendar dispatcher previously waited for the provider's final response and did not bridge those partial events into calendar progress. It now forwards Matrix partial itinerary updates into the same exact-date and exact-route preview validation used for completed source results. A partial offer is visible while that route/date is still incomplete; it cannot mark the airport pair or date complete until the final Matrix response arrives.

The callback is limited to Matrix events marked partial. Final provider results still use the ordinary calendar completion path, avoiding a duplicate final merge. Query identity, filters, CAD and itinerary validation continue through `searchProviders` and the calendar's existing checks.

## Verification

- A regression at `searchFareCalendar` blocks the Matrix adapter after it emits a matched partial itinerary. In an all-source query with Google and Matrix fixtures, the Matrix offer appears in the partial date preview before its adapter is released. The test failed before the callback bridge and passes afterward.
- Calendar/search/worker-query suites: **56/56 passed**.
- Full `npm test`: **656/656 passed**.
- Production build passed after retrying Next.js 16.4.3's security reminder.
- Existing production Chromium calendar-streaming fixture passes with provider/job calls intercepted and zero page errors. That fixture verifies the calendar UI's progressive rendering, not a live Matrix calendar request.
- No Matrix network request was made. Live source timing, parser drift, access scope and regional source coverage remain unverified.

The broader reverse-endpoint implementation and `work.md` §17 acceptance remain open. `npm audit --audit-level=low` continues to report one moderate Next.js 16.4.3 vulnerability; its available fix is outside the declared dependency range.
