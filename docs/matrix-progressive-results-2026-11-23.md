# ITA Matrix progressive results — 2026-11-23

## Change

Matrix's public browser flow returned its initial search batch, then awaited up to three detailed-itinerary requests before `searchMatrix` returned anything. That kept even usable Matrix price-only observations hidden until detail expansion finished. It now emits a normalized update after the initial batch and after each successfully matched detail response. Updates flow through the existing provider callback and durable flight-progress path; filters and exact route/query checks run before a preview can be persisted. Detailed itineraries replace the corresponding price-only observations as evidence arrives.

This work also fixed two integration defects found by the end-to-end route-progress regression:

- The single-airport-pair path passed provider callback arguments in the wrong shape to the progress publisher. It therefore dropped in-progress provider results even though the final result still returned. The callback is now wrapped with its exact route query, matching the regional path.
- Worker route coverage matched flight offers using `from`/`to` but Matrix price-only observations use `origin`/`destination`. It now accepts either exact field pair. A Matrix source marked `partial` also keeps the airport-pair `complete` flag false until that source's final response arrives.

## Evidence

- `node --test tests/ita-matrix.test.mjs tests/providers.test.mjs tests/location-search.test.mjs`: **54/54 passed**. Regressions cover Matrix update ordering, provider dispatch, durable route preview, price-only observation acceptance, and incomplete coverage during detail expansion.
- Full `npm test`: **653/653 passed**.
- `npm run build`: passed on retry after Next.js 16.4.3 stopped once with its security reminder.
- Fresh production-build fixture browser check: Matrix price-only card and another provider's partial offer were visible in **437 ms** after persisted progress; final fixture update rendered, 3 polls, 0 browser errors, provider/job responses intercepted, and external requests blocked.
- `git diff --check`: clean before commit.

The browser check and upstream-shape tests use fixtures; no live Matrix search was run for this change. This verifies the current application callback, worker-progress validation, and UI path, not live Matrix latency, endpoint stability, current upstream result acceptance, or a p95 target. Matrix detail expansion remains capped at three itineraries and follows the existing request/rate bounds. The wider reverse-endpoint and `work.md` §17 acceptance goals remain open. The dependency audit's moderate Next.js 16.4.3 finding remains unchanged.
