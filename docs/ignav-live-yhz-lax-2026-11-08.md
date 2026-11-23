# Ignav live YHZ–LAX observation — 2026-11-08

## Fresh YYZ–FRA calendar-offer handoff — 2026-11-12 23:30 UTC

Made one read-only Ignav booking-handoff POST using the fresh saved one-way offer surfaced during the YYZ→Europe calendar check: YYZ–FRA, Nov 14 2026, one adult, economy, source observation CAD 760 at `2026-11-12T23:19:20.594260Z`. The provider returned `priced_handoff`; its returned itinerary matched the selected offer, and coverage was complete for the outbound leg. It returned two seller options with provider-reported CAD prices of 760 and 860. The response marks the 760 fare as provider-reported verified; this is not a seller checkout quote.

The same response says seller availability `not_checked`, baggage absent, mandatory charges `not_itemized`, and seller response `observedAt` absent. Link specificity was not independently checked, and neither seller URL was opened. No checkout, account, reservation or purchase occurred. This is a handoff itinerary/price match only; P7 acceptance remains Partial. The source fare itself was observed about eleven minutes before the handoff and within the app's 15-minute observation window. Full seller refresh and an exact all-in total remain unverified.

## Query

Read-only live fare search through the local API for Halifax Stanfield (YHZ) to Los Angeles (LAX), outbound 2026-11-12 and return 2026-11-19, one adult, economy, CAD. This was a separate Ignav source query; it did not use, access, or verify Expedia inventory.

## Observed result

- The durable local search record completed successfully. Ignav reported 53 received and 53 accepted offers.
- The lowest returned offer was **CAD 1,044** for one adult. It was observed at `2026-11-08T04:53:32.019883Z` from the Ignav live fare API.
- Outbound: AC2045 YHZ–YUL, 2026-11-12 05:15–06:19 local; AC775 YUL–LAX, 08:00–11:24 local. The reported elapsed journey was 609 minutes, including a 101-minute YUL connection.
- Return: AC790 LAX–YYZ, 2026-11-19 17:35–2026-11-20 01:21 local; AC600 YYZ–YHZ, 06:15–09:32 local. The reported elapsed journey was 717 minutes, including a 294-minute YYZ connection.
- The itinerary contained offset-aware timestamps and consistent local IANA time zones. The observed segment chronology was internally consistent.

## What this establishes

This is a current fare observation for the exact Ignav query. The source record says “Fare observed; seller availability not rechecked” and supplies no seller host. It does **not** establish Expedia pricing, refreshed seller availability, baggage allowance, mandatory charges, final checkout total, eligibility, or a completed booking. The offer's inclusion/fee text directs the traveler to verify fare terms. No itinerary was selected for purchase, and no booking or reservation was made.

## Remaining P7 action

The exact Expedia page separately returned HTTP 429 with title `Bot or Not?`, without fare content. Do not interact with or bypass that challenge. An authorized Expedia round-trip source or a user-provided, non-sensitive visible result summary is still needed to verify Expedia's own seller handoff and final mandatory charges. Keep the Ignav price labeled as an observed source fare, not an Expedia or seller-verified quote.

## Read-only Ignav seller-handoff refresh — 2026-11-08, approximately 18:13 UTC

Ran `TRAVEL_RUN_LIVE_SELLER_CHECK=1 node --env-file-if-exists=.env.local scripts/check-ignav-seller-handoff-live.mjs`, which selected the stored lowest CAD offer for this exact query and made one read-only handoff request. The returned itinerary **matched** the selected offer, and the handoff returned five airline options covering outbound and inbound legs. Ignav reported CAD 1,044 as `verified` for the itinerary and each returned link price (CAD 1,044, 1,149, 1,412, 1,622, 1,676). Link specificity was `unknown`; the five links were not individually opened.

This refresh did **not** verify seller inventory: the API response explicitly reports `sellerAvailabilityStatus: not_checked`. It returned no baggage data, mandatory charges were not itemized, and it supplied no offset-aware refresh `observedAt`. Thus the selected itinerary/price was matched in a provider handoff response, but this is not a current seller quote or completed booking. No link was opened, and no checkout or purchase occurred. The script omits seller URLs and private data from output. Reproduce only when intentionally making one live request, with `IGNAV_API_KEY` available to the process.

## Cross-provider live round-trip search — 2026-11-08 19:52 UTC

With user authorization, submitted one exact local website/worker query to all sources for YHZ–LAX, 2026-11-12/19 round trip, one adult, economy, CAD. The returned provider states were:

- **Google Flights:** `ok`, six returned observations; the lowest accepted complete quote across the result was CAD 1,044, observed `2026-11-08T19:52:37.960Z`, with two outbound segments and a matching return. The operation is bounded and not exhaustive.
- **Ignav:** `ok`, 40 received and 40 accepted complete offers.
- **ITA Matrix:** `ok`, 36 CAD price observations, **zero** accepted complete itineraries; these remain price-only and were not counted as complete offers.
- **Expedia partner API / Skyscanner:** `unconfigured` (partner keys absent). **Air Canada NDC / Expedia via Omkar:** `unsupported_trip` for this round trip; no request was made to those adapters.

The aggregate contained 46 accepted complete offers plus 36 separate Matrix price-only observations. This is source/query-specific evidence, not market completeness, current seller availability, baggage or mandatory-charge evidence. The first handoff attempt exposed a script-selection bug: it compared prices across all providers and fell back to an older Ignav job when Google was cheapest. The selector now picks the lowest CAD Ignav offer from the newest matching job and has an assertion covering a cheaper non-Ignav offer. A single rerun used the current 19:53 UTC Ignav observation; the itinerary matched and five airline options were returned. The API still reported `sellerAvailabilityStatus: not_checked`, link specificity `unknown`, no baggage, `not_itemized` mandatory charges, and no refresh `observedAt`. No seller link was opened; no checkout, reservation, or purchase occurred.

## Exact-party fresh Ignav search and seller handoff — 2026-11-08 22:47 UTC

The local website/job API submitted one explicitly bounded Ignav-only query for the exact route, dates, one adult, zero children, and economy cabin. The durable worker completed in 13 seconds. Ignav returned 42 CAD offers; all 42 passed the application's complete-itinerary validation. The lowest returned observation was **CAD 1,033**, with outbound and return segment details, observed at `2026-11-08T22:47:20.382264Z`. The exact query match was confirmed from the completed job response.

The guarded `TRAVEL_RUN_LIVE_SELLER_CHECK=1 node --env-file-if-exists=.env.local scripts/check-ignav-seller-handoff-live.mjs` made one read-only seller-handoff refresh against that fresh offer. Ignav returned `itineraryMatch: matched`, `handoffStatus: priced_handoff`, and `linkedPriceEvidenceStatus: provider_reported_verified`; its itinerary price was CAD 1,033. It returned five airline booking options covering both directions, with provider-reported CAD link prices of 1,033 / 1,138 / 1,400 / 1,610 / 1,676. `coverageStatus: complete` describes returned-leg mapping only.

This still is not seller confirmation: `sellerAvailabilityStatus` remained `not_checked`, link specificity was `unknown`, baggage was absent, mandatory charges were `not_itemized`, and the seller response supplied no `observedAt`. Seller URLs were not printed or opened; no checkout, booking, or purchase occurred. Post-request loopback health at `2026-11-08T22:48:10.382Z` was `ok`, one live worker, queue depth zero, and no expired leases/deadlines. These prices are current provider observations for this query, not a confirmed all-in seller total. Expedia remains unverified.

## Fresh exact-query read-only recheck — 2026-11-09 00:32 UTC

To replace the expired November 8 observation, submitted one exact YHZ–LAX round trip for November 12–19, 2026, one adult, zero children, economy, CAD, Ignav only, through the local job API and worker. The completed job reported `ok`, 42 received, 32 accepted. The lowest fresh accepted offer was **CAD 1,033**, observed at `2026-11-09T00:32:06.275596Z` and fresh when selected for handoff.

One read-only seller-handoff refresh returned `itineraryMatch: matched`, `handoffStatus: priced_handoff`, and provider-reported verified CAD 1,033 itinerary price. It returned five provider-reported CAD booking options covering outbound and inbound: Air Canada CAD 1,033 / 1,138 / 1,400 / 1,610, and United CAD 1,676. `coverageStatus` refers only to the returned leg mapping. Link specificity remained unknown. Seller availability was `not_checked`, baggage was absent, mandatory charges were `not_itemized`, and the handoff had no `observedAt`.

Post-query health at `2026-11-09T00:32:29.999Z` was `ok`, with one live worker, queue depth zero and no expired leases or deadlines. No seller URL was printed or opened; no checkout, reservation or purchase occurred. This is a fresh provider observation for the exact query, not seller availability or an all-in total. It does not verify Expedia's source page or inventory.

### Guarded Air Canada link probe — 2026-11-09 00:37 UTC

Opened one provider-reported Air Canada link once with a read-only GET in headless Chromium. The initial route was `/booking/meta-redirect`; final route was `/booking/ca/en/aco/error` with HTTP 200. No flight references from the selected itinerary or price were visible. Generic baggage and tax/fee wording was present but does not establish the selected fare's baggage or mandatory charges.

The browser safety guard blocked 19 non-GET requests and seven off-domain requests. Either block set may have interrupted redirect processing, so this is inconclusive and does not prove the link is broken. No challenge appeared; no clicks, form submission, checkout, reservation or purchase occurred. Full link URL and authorization parameter values were not logged. Current seller availability and itinerary/fee details remain unverified.
