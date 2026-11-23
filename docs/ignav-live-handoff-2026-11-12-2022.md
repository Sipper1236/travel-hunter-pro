# Ignav YHZ–LAX live handoff — 2026-11-12 20:22 -04

## Query and evidence

- One-way YHZ–LAX, Dec 15 2026, one adult, economy, CAD, through the local owner-bound search path.
- Ignav returned a CAD 302 observation at `2026-11-13T00:20:48.765636Z` for AC2061 YHZ–YYZ (11:00–13:41 UTC) and AC787 YYZ–LAX (17:00–22:34 UTC).
- One read-only `/api/search/booking-links` handoff returned HTTP 200, `priced_handoff`, `itineraryMatch: matched`, and `coverageStatus: complete` for the outbound. It returned five provider-priced choices: Air Canada CAD 302, 355, 486 and 591; United CAD 355. All link specificity values were `unknown`.

## Limits

- The handoff response did not include its own observation time and did not refresh the source quote. The source's 15-minute expiry was `2026-11-13T00:35:48Z`.
- Seller availability was `not_checked`; baggage was absent; mandatory charges were `not_itemized`; booking status was `not_booked`. Provider-reported prices are not seller-verified payable totals.
- No seller URL was opened. No checkout, account, CAPTCHA, reservation or purchase action occurred.

This is evidence of a provider-side itinerary match and handoff response, not current seller inventory or completed booking. P7 remains Partial.
