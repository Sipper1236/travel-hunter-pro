# Air Canada Vacations current widget entry point — 2026-11-23

## Reproduction and live observation

The local development website and search worker were started at `http://127.0.0.1:3000`. Through the visible **Flight + Hotel Vacation Packages** section, one read-only origin lookup was attempted. Before the guard change, the lookup returned HTTP 400 after the expected origin input never became visible; the error exposed a Playwright locator timeout. No location was selected and no package job was submitted.

The official ACV path `https://vacations.aircanada.com/en/all-booking-options/flight-hotel` was then inspected through a normal browser load. It returned HTTP 200 with a Flight & Hotel promotional page, not a visible package search form. After waiting eight seconds, there were no visible input fields and the expected origin/destination widget selectors were absent. The page showed promotional destination content. Its **Book** navigation led to the all-booking-options page, whose **Flight & Hotel packages** link returned to the same promotional route. A public package card opened `/en/packages/product-details`, where the observed page showed no visible search or occupancy controls; no booking step was taken. The route with and without a trailing slash behaved the same for this check. No explicit CAPTCHA or human-verification challenge appeared, and no provider search, checkout, reservation, or purchase was attempted.

After implementing safe failure handling, the same local website origin lookup returned HTTP 503 with `sourceStatus: temporarily_unavailable` and the message “Air Canada Vacations location form did not load. No location query was sent.” The message no longer exposes a selector or browser timeout. This verifies the current UI failure path, not a package result.

## Code change

`lib/vacation-access.mjs` detects explicit visible CAPTCHA/security markers and bounded visible challenge text. It never interacts with a challenge. A detected challenge returns a `blocked` source status and applies a five-minute ACV cooldown. If the provider page loads without its expected form, the location and package adapters return a bounded `temporarily_unavailable` result and stop before sending the user's location or package query. The local location route now preserves `sourceStatus` in its response.

Regression tests cover challenge wording/markers, ordinary page text, the suggestion path's stop-before-input behavior and cooldown, generic missing-widget errors without Playwright detail, and the package-search path's stop-before-form behavior.

## Verification and limits

- `node --test tests/vacation-access.test.mjs tests/vacation-suggestions.test.mjs tests/vacation-search.test.mjs`: 35 passed, 0 failed.
- `npm test`: 731 passed, 0 failed.
- `TRAVEL_NEXT_DIST_DIR=.next-acv-widget-build npm run build`: passed on Next.js 16.4.6 without disturbing the running dev site.
- `npm audit --audit-level=low`: 0 vulnerabilities.
- `npm run check:markdown-links`: 141 tracked and untracked Markdown files checked, none broken.
- `git diff --check`: passed.
- Local website lookup: HTTP 503, `temporarily_unavailable`, no location query sent.
- No live package prices or current website-to-worker result were observed. Prior November 14 results remain historical evidence only.
- The current public page entry point does not expose the search widget used by the adapter. The official current search entry point or supported replacement flow remains unidentified. Do not switch to a direct endpoint, replay private credentials, or claim package coverage without a normal provider-supported query flow.
- P6 and `work.md` §17 remain open for a working live search, exact dates/occupancy/filters, real rendered offers, current seller availability, property matching, complete charges, and checkout comparison.
