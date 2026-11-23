# Expedia via Omkar live duration probe — 2026-11-09

## Current currency/timestamp recheck — 2026-11-23

A second bounded read-only YHZ–LAX one-adult/economy call for 2026-12-17 returned HTTP 200 with 85 flight records and 273 fare options, but no accepted CAD offers or price-only observations. Aggregate inspection found zero uppercase three-letter currency values in the inspected metadata fields, zero uppercase three-letter prefixes in inspected fare display fields, and zero CAD prefixes. The 223 inspected segment timestamp pairs had no UTC offsets. These values were counted without logging payload fields, raw strings, identifiers, amounts or credentials. Exact details and the limits of the inspection are in [the currency evidence note](omkar-expedia-currency-recheck-2026-11-23.md). The adapter now reports separate low-cardinality counters for missing/conflicting currency, non-CAD currency and invalid amount; fixture tests pass 12/12. No additional live request was made after the diagnostics change.

## Earlier wrapper recheck — 2026-11-23 (departure 2026-12-10)

One bounded authorized adapter request for YHZ–LAX, 2026-12-10, one adult/economy/one-way returned HTTP 200 with 80 flights. The normalizer accepted zero offers and emitted zero price-only observations; the previous combined counter reported 227 route/fare rejections. A schema-only view of the first sampled flight/fare recorded field names, types and booleans: no currency metadata field was present and segment times did not carry UTC offsets. The formatted price text was not inspected for a currency code, and this is not evidence that every result row has identical fields or the same rejection reason. No names, IDs, amounts, raw response data or key values were logged. The app withholds the results because the exact CAD and itinerary evidence has not been established. Expedia partner access remains unconfigured, and no seller handoff or availability was verified.

The provider's [published Expedia scraper reference](https://github.com/omkarcloud/expedia-scraper) documents only airport pair, optional departure date, and cabin for one-way search; it documents no currency or market parameter. Its example response shows bare dollar-formatted values and local-time strings without UTC offsets. We therefore cannot use those examples to infer CAD or segment instants. The [Omkar API reference](https://www.omkar.cloud/docs/api) documents a per-key/per-API request-rate limit and `X-RateLimit-Requests-Remaining` / `X-RateLimit-Requests-Reset` headers. The shared transport now extends a 429 cooldown through that reset when remaining quota is zero, so a short `Retry-After` cannot trigger monthly-quota retry loops. The local default pacing remains 1 request/second; account-specific plan allowance was not inspected or recorded.

## Request

One bounded provider-adapter invocation for YHZ–LAX, November 12, 2026, one adult, economy, one-way. It called the existing `searchOmkarExpedia` adapter. No direct Expedia-page access or partner API call was made.

## Result

The Omkar scraper endpoint call ended with HTTP 500, normalized by the application as `temporarily_unavailable`, before returning flight/fare data. No returned itineraries, price observations, segment timestamps, offsets, or journey durations were available. `fetchSource` uses a shared safe-retry policy that can retry a 5xx once. This direct adapter call ran outside the job transport-metric context, so the actual HTTP attempt count is not known. No additional manual invocation was made.

## What this establishes

The configured adapter was attempted for a supported one-way party/trip shape, but live Expedia-via-Omkar duration could not be verified in this observation. Existing fixture regressions still cover offset-aware end-to-end duration across all segment timestamps, including layovers, and price-only fallback where timestamps are missing. Direct Expedia partner credentials remain unconfigured. No booking, seller handoff, checkout, reservation, or purchase occurred.
