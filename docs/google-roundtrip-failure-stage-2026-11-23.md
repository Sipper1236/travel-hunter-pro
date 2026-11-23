# Google round-trip failure-stage diagnostics — 2026-11-23

## Change

When the bounded native Google round-trip adapter fails, it now retains its fixed internal stage name in error coverage (`starting`, `timezones`, `form`, `party`, `route`, `dates`, `outbound`, `return`, `booking`, `normalization`, or `booking-refresh`). The provider failure envelope forwards only this allow-listed stage, bounded RPC/selection counters, and the existing provider error code. It does not include URLs, route/date values, traveler details, RPC response bodies, or browser exception text.

This closes an observability gap: a generic `invalid_response` can be distinguished by the step that failed without retaining sensitive source data. It does not make the Google web-app RPC a supported API or resolve a failed search.

## Verification

- Added a provider-boundary regression for a fixture whose selected return evidence fails normalization. Before the implementation, the test failed because `failureStage` was missing.
- `node --test tests/google-native.test.mjs`: **16 passed, 0 failed**.
- `npm test`: **693 passed, 0 failed**.
- `npm run build`: passed after retrying the Next.js 16.4.3 security reminder. The reminder reports one moderate advisory and recommends an out-of-range forced upgrade to 16.4.6; no dependency change was made.
- `npm audit --audit-level=low`: one moderate Next.js advisory; the suggested forced fix is outside the declared dependency range.
- The regression confirms the stage is `normalization`, the bounded request count is preserved, and serialized diagnostics contain no source URL, dates, or airport codes.
- `git diff --check`: clean before the final evidence-note edit.
- No live request was made. The bounded live round-trip attempt in [Google cache evidence](google-oneway-response-cache-2026-11-23.md) remains an `invalid_response`; it was not retried. Its failure stage was not captured, so the cause remains unknown.

## Remaining work

Make a later single bounded live attempt only when source pacing permits. Record only the provider status, fixed failure stage/code, bounded coverage counters, and elapsed time. Do not repeat a failure or empty result. Keep round-trip live reliability, endpoint access scope, seller refresh, and complete reverse-endpoint acceptance open.
