# P13 text enlargement and spacing reflow — 2026-11-13 22:54 UTC

## Finding and fix

A controlled Chromium reproduction set the layout viewport to 320 CSS pixels, enlarged the root text size, and applied WCAG text-spacing overrides (1.5 line height, 0.12em letter spacing, and 0.16em word spacing). Before the fix, the search-summary `.pill` forced `white-space: nowrap`, extending the document to 375px and creating horizontal overflow.

Added a narrow-screen rule that permits the pill to wrap, constrains it to its container, and breaks long content when needed. `scripts/check-responsive-ui.mjs` now keeps this regression: it tests normal 320/375/768px layouts and repeats the 320px overflow check with the enlargement/spacing override.

## Verification

- The new browser assertion failed before the CSS fix with document/body width 375px at a 320px viewport; the overflow was localized to the `.pill` span.
- `TRAVEL_NEXT_DIST_DIR=.next-text-spacing-build npm run build`: passed.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3001 npm run check:responsive-ui`: passed on the rebuilt production server; no horizontal overflow at 320/375/768px or under the text enlargement/spacing override; external requests were blocked and browser errors were zero.
- `npm test`: 555/555 passed.
- `npm audit --audit-level=low`: zero vulnerabilities.
- The rebuilt app replaced the older loopback production build at `http://127.0.0.1:3000`. The updated root returned HTTP 200; same-origin health at 22:57:20 UTC returned `ok`, queue depth 0, one live worker, zero expired leases/deadlines, nine stale and eight stopped historical workers. The responsive Chromium check passed again on port 3000 with provider traffic blocked.

This verifies responsive layout and a text-spacing stress case in Chromium. Headless Chromium did not respond to browser zoom keyboard shortcuts, and this is not evidence of a full desktop 400% browser-zoom, assistive-technology, device, or complete WCAG audit. Those P13 checks remain open.
