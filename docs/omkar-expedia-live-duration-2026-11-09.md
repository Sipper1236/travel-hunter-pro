# Expedia via Omkar live duration probe — 2026-11-09

## Request

One bounded provider-adapter invocation for YHZ–LAX, November 12, 2026, one adult, economy, one-way. It called the existing `searchOmkarExpedia` adapter. No direct Expedia-page access or partner API call was made.

## Result

The Omkar scraper endpoint call ended with HTTP 500, normalized by the application as `temporarily_unavailable`, before returning flight/fare data. No returned itineraries, price observations, segment timestamps, offsets, or journey durations were available. `fetchSource` uses a shared safe-retry policy that can retry a 5xx once. This direct adapter call ran outside the job transport-metric context, so the actual HTTP attempt count is not known. No additional manual invocation was made.

## What this establishes

The configured adapter was attempted for a supported one-way party/trip shape, but live Expedia-via-Omkar duration could not be verified in this observation. Existing fixture regressions still cover offset-aware end-to-end duration across all segment timestamps, including layovers, and price-only fallback where timestamps are missing. Direct Expedia partner credentials remain unconfigured. No booking, seller handoff, checkout, reservation, or purchase occurred.
