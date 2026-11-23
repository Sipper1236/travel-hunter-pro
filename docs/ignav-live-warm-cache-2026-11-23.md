# Ignav live exact-query cache check — 2026-11-23

## Query and results

One bounded live Ignav query ran for YHZ→LAX, 2026-12-16, one-way, one adult, economy, CAD. It returned 12 offers accepted by the current validator in 3,893 ms. The same exact query was immediately submitted again through the same in-memory job store; the second result reported a cache hit, returned the same 12 offers in 2 ms, and retained the first result's original `observedAt` value.

Only counts, source status and elapsed times were emitted. No fares, offer identifiers, API key, or response payload were recorded here. The call used the configured Ignav credential and was read-only; no seller handoff or booking was requested.

## What this verifies

- One current exact-query API response passed the app's offer validation and entered the cache.
- An immediate identical query returned the stored result without another provider call, preserving quote time.
- This is a single YHZ–LAX one-adult sample, not a latency distribution, guarantee, or evidence for other query shapes.
- The live check used a SQLite `:memory:` job store in one process; that live run itself did not exercise persistent storage, cross-worker reuse, or website rendering. A separate fixture regression verifies cross-connection persistent cache reuse, described below. Other-party cache behavior remains fixture-only.
- A follow-up regression in `tests/providers.test.mjs` closes the first persistent SQLite store, opens a second independent connection, and confirms the exact offer is a cache hit with no second provider call and the original observation time. Provider plus job-store suites pass 35/35; full `npm test` passes 666/666. This is separate fixture evidence, not additional live coverage.
- The first response took 3.893 s upstream-to-adapter completion; the 2 ms cache result excludes worker/job persistence and browser polling/rendering. Neither figure is a p95.

The cache remains limited to complete, fresh, validated offers under exact query/account identity. Other providers do not inherit this cache policy.
