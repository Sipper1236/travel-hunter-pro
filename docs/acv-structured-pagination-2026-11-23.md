# ACV structured package pagination — 2026-11-23

## Current widget entry-point recheck — 2026-11-23

A fresh local website attempt and paced public-page inspection now establish why no post-change website-to-worker result is available: the current official Flight & Hotel page returns HTTP 200 but displays promotional content without the search inputs used by this adapter. The canonical no-trailing-slash path has the same behavior, and the site's Book navigation returns to the promotional page. No explicit access challenge appeared. The local UI now reports a bounded unavailable status before sending a location or package query. See the [current entry-point investigation](acv-current-widget-entrypoint-2026-11-23.md). This does not establish that the provider has no other supported booking flow.

## Implementation

The ordinary Air Canada Vacations Flight + Hotel widget path now supports structured responses for a bounded 20- or 40-result query when the party shape is already supported by the normalizer: adults with up to three exact-age children in one room, or adult-only multi-room occupancy with provider-exposed room assignments. It observes requests only after the user query is submitted through the public widget; it does not construct or replay private request credentials.

For a 40-result query, the browser captures the widget's first `GET /packages-search/search` response and, if the visible “Show more” control expands the listing, its second response. At most offsets 0 and 20 are accepted, each with a limit of 20. The merger checks the exact query and listing, inclusive response bounds, sequential offsets, stable `totalAvailable`, complete prior pages, unique package identities, page-level observation times, offer-to-page links, and equality between returned records and rendered cards. A response is capped at 2 MB per page and 4 MB for the merged result. The durable worker repeats the page, query, offer, and freshness checks before persistence. If evidence is incomplete or mismatched, the adapter uses the existing bounded rendered-card path; rate limits, access denials and cancellation remain errors.

The UI now reports how many result pages were checked and distinguishes returned records from the provider-reported total. A provider total remains an observation and does not prove current simultaneous availability.

## Live request-shape evidence

Before wiring the multi-page adapter, two read-only YHZ–Barcelona/BCN widget observations used Apr 15–25, 2027, two adults, two rooms, and the 40-result limit. Each showed 40 cards and sequential structured requests at offsets 0 and 20, with 20 rows per response and inclusive ranges 0–19 and 20–39. The provider-reported `totalAvailable` differed between observations (78 and 84), so it is dynamic and was not treated as inventory proof. In each sample, the prior rendered-card normalizer accepted 39 of 40 records. No property names, prices, package IDs, response bodies, or private captures were retained.

An adapter integration attempt after implementation could not load the ACV package form and stopped before submission. That run observed no result or price. Consequently, the new pagination path has contract, normalizer, worker, and full-suite evidence, but it does not yet have a fresh website-to-worker live demonstration.

## Verification

- Focused package normalizer, worker and search suites after the final backend guard change: **45 passed, 0 failed**.
- Full `npm test`: **710 passed, 0 failed** after the final refusal-preservation guard.
- `npm run build`: passed on the final code state using Next.js 16.4.6.
- `npm audit`: **0 vulnerabilities**.
- Impeccable detector on `app/VacationSearch.js`: no findings.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3119 npm run check:package-infant-guidance`: passed against the production build; the fixture asserted the 2-page/40-result coverage message, with provider requests intercepted.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3119 npm run check:responsive-ui`: passed at 320/375/768 px, with 80 audited targets at 320/1280 px, 17 compact controls at least 44 px, enlarged-text reflow, no overflow, and zero browser errors. Provider traffic was blocked.

The prior live widget request-shape check is not a live demonstration of the newly wired adapter or a persisted website job.

## Still open

- Rerun through the local website and durable worker when the provider form loads; confirm structured 40-result coverage and the displayed observations.
- ACV journey entries still lack a validated offset-aware segment chain. Do not describe package flights as fully verified itineraries.
- Seller availability, exact room/property, mandatory local charges, baggage, and checkout-confirmed totals remain unverified.
- Infants, child parties across multiple rooms, and four-or-more-child structured responses remain unsupported.
- Keep results bounded and source-attributed. This does not claim exhaustive listing coverage or simultaneous inventory.
- `work.md` §17 remains incomplete; this note closes no other acceptance criterion.
