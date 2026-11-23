# Member-offer source recheck — 2026-11-14 00:23–00:25 UTC

All reads used the same-origin local `/api/member-offers` endpoint and its shared source pacing. No account or membership data was supplied and no discount was applied.

| Source | Current result | What it establishes | What remains unknown |
|---|---|---|---|
| CAA Atlantic | `information_observed` at 00:23:54 UTC; linked membership terms were also observed | Public page describes 5–10% savings at listed chains, 15% at Rodd and other regional offers. CAA Atlantic says permanent residents of the four Atlantic provinces may apply and membership benefits are personal to active members. | The traveler’s active membership, exact property/date/room offer, comparable rate, and actual discount. |
| Costco Travel Canada current deals | `blocked` after the prior retry time had elapsed; new retry time `2026-11-14T00:29:56.450Z` | The public current-deals page declined the normal paced request. | No deal listing or absence of deals was established; membership, trip price and eligibility remain unknown. No further request should be made before the returned cooldown. |
| Visa Infinite / Booking.com | `information_observed` at 00:25:21 UTC; linked general terms were also observed | Visa describes up to 8% (maximum USD 230) as a future Booking.com Travel Credit after required account and eligible-card steps. General terms require an eligible Canadian-issued Infinite/Infinite+ card and say offers cannot be combined. | Full Booking.com promotion-specific terms, traveler/card eligibility, a participating property/date/rate, comparable current payable total, and credit timing/cancellation treatment. |

These are public-source observations only. The future Visa credit is not an immediate reduction to the observed hotel price. No CAA or Costco member rate was retrieved or compared. The Costco access refusal is not a no-offer result; respect its retry time and do not bypass the block.
