# Expedia seller handoff check — 2026-11-08

## Query scope

Read-only attempt using the Expedia Canada round-trip link supplied in the conversation: Halifax Stanfield (YHZ) to Los Angeles (LAX), November 12–19, 2026, one adult, economy. No account, itinerary selection, checkout, purchase, or reservation action occurred.

## Evidence and blocker

- Local `/api/search/capabilities` reported Expedia partner API **unconfigured** and Expedia via Omkar **unsupported_trip** for round trips (one-way only). The other eligible source labels in that response do not prove an Expedia offer or Expedia seller handoff.
- Ordinary page navigation to the exact Expedia URL returned HTTP 429, title `Bot or Not?`, with no fare content. No challenge was interacted with, solved, or bypassed; navigation stopped.
- Expedia itself returned no current fare, exact itinerary, seller quote, baggage allowance, mandatory charges, or checkout total. A separate Ignav read-only query for the same route, dates, party and cabin returned 53 live observations; the lowest was CAD 1,044 with exact AC segments and layovers. A later read-only Ignav handoff request matched that stored itinerary and returned five airline options with provider-reported verified CAD prices, including CAD 1,044; however, it explicitly did not check seller availability, did not establish link specificity, returned no baggage or itemized mandatory charges, and provided no refresh timestamp. This is not Expedia inventory or a seller-verified checkout offer. Details: [Ignav live YHZ–LAX observation](ignav-live-yhz-lax-2026-11-08.md).

## Next action

Keep the search link as a user-directed Expedia handoff with its exact route/date/party/cabin constraints, but label it as a search link rather than a price or seller-verified booking path. To complete P7, configure an explicitly authorized round-trip Expedia API/source path or have the user open the supplied Expedia page normally and provide a non-sensitive visible result summary for reconciliation. Do not attempt to evade the HTTP 429 challenge. A seller check must still confirm the exact selected flights, current availability, baggage and mandatory charges before describing the price as seller-verified. Do not purchase or reserve.
