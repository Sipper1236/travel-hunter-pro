# Ignav seller-handoff prerequisite attempt — 2026-11-13 03:05 UTC

## Query

A bounded one-way job was submitted through the local application for YHZ–LAX on 2026-12-15, one adult, economy, Ignav only. The local capability check had reported Ignav as eligible for this request shape; that capability response does not guarantee provider availability.

## Result

The worker completed the job without a fare. Ignav coverage was `temporarily_unavailable`, with the message “Ignav request failed or timed out.” No itinerary or fresh offer was available, so the owner-bound seller-handoff endpoint was not called. No manual retry was made.

After the failed job, the local site returned HTTP 200 and same-origin health returned `ok`, queue depth 0, a live worker available, and zero expired leases/deadlines.

## Limits and next action

This is a dated failed provider observation, not proof that no flights or seller inventory exist. No price, seller availability, baggage, mandatory charges, or checkout total was verified. Do not use this result as a fare. Retry only in a separately bounded check after the provider cooldown/availability condition permits it; first obtain a fresh matching quote, then request its read-only seller handoff. Never proceed to checkout, reservation or purchase.

## Reproducible handoff check update — 2026-11-13 03:06 UTC

The prior opt-in live helper only selected a hard-coded historical YHZ–LAX Nov 12–19 return query. It now accepts an explicit exact route/date and one-way/round-trip target, while continuing to require one adult, economy, no children, and an existing fresh matching CAD Ignav quote. It sends no handoff request if the quote is missing or stale. The default target remains the historical query for compatibility; set `TRAVEL_SELLER_ORIGIN`, `TRAVEL_SELLER_DESTINATION`, `TRAVEL_SELLER_DATE`, `TRAVEL_SELLER_TRIP_TYPE`, and `TRAVEL_SELLER_RETURN_DATE` (return trips only) to target a new query. Regression tests passed 4/4, full `npm test` passed 547/547, isolated Next build passed, and audit reported zero vulnerabilities. The newly attempted Dec 15 query above was unavailable, so the changed helper was not used to make another provider request.

Example for a fresh stored YHZ–LAX one-way quote:

```sh
TRAVEL_RUN_LIVE_SELLER_CHECK=1 \
TRAVEL_SELLER_ORIGIN=YHZ \
TRAVEL_SELLER_DESTINATION=LAX \
TRAVEL_SELLER_DATE=2026-12-15 \
TRAVEL_SELLER_TRIP_TYPE=one-way \
node --env-file-if-exists=.env.local scripts/check-ignav-seller-handoff-live.mjs
```

This remains a read-only provider handoff check and does not open the seller URL, verify checkout availability, reserve or purchase.
