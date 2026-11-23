# All-source calendar provider streaming — 2026-11-23

## Change

The all-source fare calendar previously awaited each configured source in order for every exact route/date query. A slow early source therefore delayed calls to later providers and prevented their faster responses from appearing in the calendar preview.

Calendar source dispatch now uses a bounded two-provider pool per exact route/date query. Each source result is merged and published as soon as that provider finishes; the final result retains the configured provider order. Route/date traversal remains sequential, so request-budget reservation, checkpoint scope, and coverage accounting continue to count the same exact queries. Existing refusal handling still suppresses a source after a source-wide rate/auth/access failure on subsequent route/date queries. Provider exceptions are represented as source failures so another source can still return usable observations.

## Verification

- Red/green regression at the public `searchFareCalendar` seam: it blocks the first configured provider (Ignav), returns a valid Google result from the second provider, and asserts the Google offer is published before Ignav is released. The regression failed before the change and passes afterward.
- Calendar/search/worker-query tests: **55/55 passed**.
- Full `npm test`: **655/655 passed**.
- `npm run build`: passed after retrying the Next.js 16.4.3 security reminder.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3194 node scripts/check-calendar-streaming-ui.mjs`: passed against an isolated production server. Fixture provider/job responses were intercepted, preview offers rendered before the final result, final price rendered, and the browser reported zero page errors.
- `npm audit --audit-level=low`: one moderate Next.js 16.4.3 vulnerability remains; the available npm fix is outside the declared dependency range. No upgrade was applied.

## Limits

The concurrency cap is two and is not exposed as a UI setting. Providers run concurrently only within one exact route/date query; airport pairs and date combinations remain sequential. No live provider request was made, so this proves local result ordering and UI rendering, not provider response latency or entitlement. The broader source-by-source reverse-endpoint goal and `work.md` §17 acceptance remain open.
