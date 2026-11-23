# Ignav live adapter check — 2026-11-23

## Request and result

- Route: YHZ→LAX
- Departure: 2027-01-15, one-way
- Party/cabin/market: one adult, economy, Canada
- Scope: one read-only direct adapter call using the configured Ignav credential
- Result: `ok`; 58 rows received, 25 accepted, 33 rejected
- Adapter elapsed time: 7,438 ms
- Observation time: 2026-11-23T04:40:23.735874Z

The request output was deliberately limited to status, counts, elapsed time, and observation time. No credentials, raw response, identifiers, passenger data, or prices were recorded.

## What this establishes

The configured Ignav endpoint responded successfully to this exact query, and the adapter accepted 25 normalized rows under its current validation rules. The result is a direct adapter check, not a durable search job or website-rendering check. It does not establish itinerary completeness, current seller availability, price freshness, tax/baggage inclusion, or reliability for other routes, dates, party shapes, or filters.

## Next verification

Run a single bounded owner-bound worker search for the same supported query when the local stack is available, then confirm progressive persistence and browser rendering without printing fare details or secrets. Record source-specific latency and coverage from that job. Do not claim end-to-end completion from this direct call.
