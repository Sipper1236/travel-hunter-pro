# Air Canada Vacations live package check — 2026-11-14 00:05–00:07 UTC

## Query and observed result

Ran the bounded package flow through the already-running local website and worker with `scripts/check-package-location-ui.mjs`:

- Origin: provider suggestion Halifax Stanfield Intl. Airport (YHZ).
- Destination: provider city Barcelona, Spain and its separate provider airport choice BCN.
- Dates: 2027-04-15 to 2027-04-25.
- Party: one adult, one child at the previously supplied actual age 7, one room.
- Filters and cap: minimum four stars, no more than two stops per direction, 20 result panels.
- Provider location responses: 1 YHZ option at `2026-11-14T00:05:30.573Z`; 12 Barcelona choices at `2026-11-14T00:06:03.876Z`.
- Website job completed and rendered 20 supported observations from 20 inspected panels at `2026-11-14T00:07:33.797Z`. No observations were excluded by the star/budget or stop filters; the source stated more listings remained beyond the 20-panel cap.
- Observed estimated totals ranged from CAD 3,235.54 (Exe Barbera Parc) to CAD 5,890.92 (H10 Art Gallery). The returned cards showed 4-star properties, room-only rates, provider-listed taxes/fees included, non-refundable terms, and one stop in each direction.

These are Air Canada Vacations estimated package observations displayed by the real website-to-worker flow, not checkout prices or a recommendation. The source did not verify exact property addresses, room equivalence, every mandatory/local charge, the child fare at seller checkout, or current checkout inventory. The page itself says local charges may apply. More results were left unsearched. No account, CAPTCHA/challenge, checkout, reservation, or purchase was involved.

## Check-script response race

The first attempted refresh stopped during the origin lookup: Playwright received the location response but its later `response.json()` call failed because the browser had navigated away from the response. A minimal browser probe showed the same-origin API itself returned HTTP 200 with one provider suggestion and that reading the response body immediately at the response event succeeded. Updated `scripts/check-package-location-ui.mjs` to match the submitted lookup and capture its JSON during the response event. The full website check then completed, selected YHZ/Barcelona/BCN, submitted the exact package query, and rendered the 20 observations. No production app code or provider behavior was changed.

## Verification and runtime

- The corrected live `node scripts/check-package-location-ui.mjs` run completed with 20 rendered cards and `Package search: complete`.
- Same-origin health at `2026-11-14T00:07:50.380Z` returned `ok`, queue depth 0, one live worker, and zero expired leases/deadlines. Nine historical workers were stale and eight were stopped.
- Current code verification immediately before this script-only correction: `npm test` 557/557; isolated Next.js 16.4.3 build passed at `.next-audit-resume-build`; `npm audit --audit-level=low` found zero vulnerabilities. The full website run itself exercises the corrected helper.

P6 remains **Partial**. Multi-room children, verified per-room occupancy, exact property/address matching, seller-confirmed availability, full mandatory charges, and checkout total remain open. This single bounded query does not prove broad package coverage or persistent availability.
