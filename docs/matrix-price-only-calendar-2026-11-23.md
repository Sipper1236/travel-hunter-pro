# ITA Matrix price-only calendar observations — 2026-11-23

## Change

Calendar searches can retain an ITA Matrix group-total observation as price-only data when the source observation is bound to the exact calendar route and date (and exact fixed return date for round trips). This follows the Matrix progressive itinerary work: Matrix may report a total before full itinerary details are usable, and the calendar previously discarded these observations.

`lib/matrix-calendar-observation.mjs` validates the observation and decodes the `search` state from a Matrix Flights URL. It checks the Matrix host/path, trip type, route, dates, cabin, airport-change setting, stops/availability options, and passenger categories. The normalized observation must also match the exact party summary, CAD currency, exact-cent positive amount, reported group-total scope, current offset-aware observation timestamp, and `itineraryVerified: false`. An active calendar filter rejects the observation because a group total alone cannot prove that airline, stop, country, or other filters were met.

Calendar search accepts these observations only with a successful Matrix source status and stores them in the `priceObservations` field. The fare field remains empty. The UI calls the amount a “price-only calendar value,” says itinerary/seller availability, baggage, and final charges were not returned, and links its search action back to ITA Matrix. Durable worker validation repeats the exact query/provenance checks and requires an eligible Matrix provider capability and successful Matrix coverage for the same route.

## Verification

- `node --test tests/calendar-search.test.mjs tests/calendar-worker-result.test.mjs tests/calendar-query.test.mjs`: **57/57 passed**.
- `npm test`: **657/657 passed**.
- `npm run build`: passed on Next.js 16.4.3; its security-upgrade reminder remains.
- Regression coverage includes a valid exact unfiltered Matrix total, worker acceptance, tampered route URL rejection, filtered-result suppression, and wrong-route suppression.
- No live Matrix request was made. No Matrix-specific browser/UI fixture was run for this change. Existing generic calendar UI checks do not establish that a Matrix price-only card rendered in a browser.

## Limits and next steps

This does not verify flight segments, seller inventory, availability, baggage, taxes/fees beyond the provider-reported group total, or booking completion. Matrix's query state may be structurally valid while the remote result is stale or unavailable; the displayed timestamp is the observation time and no live refresh was performed. Provider rate/access terms and live latency remain unaudited for this feature. Test with an authorized Matrix request and a browser-intercepted Matrix calendar card, then verify seller handoff separately. The wider reverse-endpoint plan and `work.md` §17 are still incomplete.
