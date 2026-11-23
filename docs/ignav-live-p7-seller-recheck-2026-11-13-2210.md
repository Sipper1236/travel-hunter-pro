# Ignav seller handoff and direct-page recheck — 2026-11-13 22:10 UTC

## Search and owner-bound handoff

The rebuilt local production site submitted a live Ignav-only, one-way, economy, one-adult YYZ–YUL query for 2026-12-18. Chromium displayed 21 CAD offers. The first result was a nonstop Porter Airlines observation, 20:55–22:17 local, CAD 233. The app then made one owner-bound handoff request. Ignav returned `itineraryMatch: matched`, complete outbound coverage, and a provider-reported verified price. This is a provider handoff price, not a seller quote.

The handoff left seller availability `not_checked`, baggage `not supplied`, and mandatory charges `not itemized`. Five provider links were present; link specificity was `unknown`, including the Porter link.

## Bounded seller-page GET

Opened only the returned Porter HTTPS link in a fresh browser page. The browser allowed GET requests to that exact host and blocked non-GET and off-host requests. The page returned HTTP 403 with title `Just a moment...` and no readable body. This is an access/challenge gate; no interaction, alternate route, retry, challenge workaround, or account login was attempted. The page did not provide itinerary, availability, baggage, fees or current price evidence.

The app browser reported zero JavaScript errors and zero unexpected off-origin requests. No checkout, reservation, purchase or payment action occurred.

## Status

P7 remains Partial. The fresh CAD 233 observation and matched handoff improve provenance, but seller availability, seller-accepted exact flights, baggage, mandatory/conditional charges, and checkout total remain unverified. Since this seller path presents an access gate, further verification requires an authorized seller data path or accessible seller response; do not bypass the gate.
