# Bounded live separate-ticket comparison — 2026-11-08 23:38 UTC

## Query and source

Submitted one Ignav-only YHZ–LAX economy round trip through the loopback website job API for 2026-11-12 to 2026-11-19, one adult, no children. The completed job reported 42 Ignav offers received and 32 accepted after normalization and shared filters. The selected connection itinerary was CAD 1,033; its provider observation timestamp was `2026-11-08T23:33:14.954463Z`, within the app's 15-minute quote window when selected. The search response envelope was observed at `2026-11-08T23:38:18.466Z`.

## Exact segment comparison

Started one comparison for that exact itinerary, with contiguous ticket blocks enabled, no passenger partitioning, a 180-minute minimum self-transfer buffer, a 12-search budget, and zero alternate airport-pair searches. It completed with 5 logical fare searches: one baseline refresh and four block quotes. Four ticket blocks were priced; two complete round-trip plans matched the exact selected flights in chronology and CAD currency:

| Plan | Tickets | Observed total | Comparison with CAD 1,033 through fare |
|---|---:|---:|---:|
| Two direction-level ticket blocks | 2 | CAD 1,176 | CAD 143 higher before unobserved extras |
| Three contiguous ticket blocks | 3 | CAD 1,630 | CAD 597 higher before unobserved extras |

The matched flights were YHZ–YUL AC 2045, YUL–LAX AC 775, LAX–YYZ AC 790, and YYZ–YHZ AC 600. Results preserve exact segment identities. The quote plan's oldest observation was `2026-11-08T23:33:14.954Z`; the earliest usable-until time was `2026-11-08T23:48:14.954Z`. Recheck after that time and do not present these prices as current once the freshness window expires.

## Coverage and limits

- Route coverage: exact YHZ–LAX airport pair only. `routeSearchLimit: 0`; no alternate airport pair was searched. The worker returned 31 matching itinerary alternatives from the same pair, displayed 8, and reported 23 omitted from display. `exhaustive` was false and provider completion was unknown.
- Request budget: 5 of 12 logical searches used. This is a bounded live comparison, not a broad route optimization or proof of global cheapest availability.
- The through fare and independent-ticket prices were provider observations, not seller-verified offers. No seller link was opened. Seller issuance/acceptance, simultaneous inventory, seats, baggage, mandatory charges, transfer/entry feasibility, ticket protection, and final checkout totals remain unverified. No reservation, purchase, or booking occurred.
- The successful app query used `originType: place` and `destinationType: place`. One earlier local setup attempt used unsupported `airport` type values and stopped during `resolving_locations`; it was removed and did not produce a fare result.
- Both completed local jobs were removed with their owner capability after sanitized evidence was collected. No credentials, private booking links, or raw provider payloads were recorded.

This supports the exact-flight and bounded-budget implementation for one current YHZ–LAX itinerary. It does not close `work.md` §17's split-itinerary or bounded route-discovery acceptance criteria.
