# Shared provider cooldown after server failures — 2026-11-23

## Change

Shared structured HTTP transport now opens a durable 30-second source cooldown after a final HTTP 5xx when the response does not specify a longer `Retry-After`. Safe GET/HEAD requests retain their existing single bounded retry; the cooldown begins only after that retry fails. Non-idempotent POST requests are not retried and enter the same cooldown after a 5xx. A provider-supplied longer `Retry-After` remains authoritative. The cooldown is shared through the existing durable source-policy table, so another worker avoids issuing the same provider request during that interval.

Regional flight calendars now treat a source response with an HTTP status of 500 or above as a provider-wide failure for the remainder of that calendar job. They record the failed route and mark later route/provider coverage as suppressed, while continuing healthy sources. Query-specific temporary failures without an HTTP 5xx, such as an Ignav 424 or a route-local native timeout, retain their existing independent-route behavior.

## Verification

- Focused transport and calendar suites: **67/67 passed**.
- Full `npm test`: **661/661 passed**.
- `npm run build`: passed after the Next.js security reminder retry.
- `npm audit --audit-level=low`: one moderate advisory in Next.js 16.4.3; npm's suggested Next.js 16.4.6 fix is outside the declared dependency range.
- `git diff --check`: passed.
- Regression coverage verifies the safe GET retry occurs before cooldown, a second call is blocked by shared policy, the Expedia 503 adapter is not called again for a later regional airport pair, healthy Ignav and Matrix sources continue, and suppressed coverage remains explicitly incomplete.
- No live provider requests were made. This is fixture-backed transport and calendar evidence, not proof of provider uptime or entitlement.

## Limits

The 30-second fallback is a local protection against repeated server errors, not a provider-published quota. `Retry-After` and 401/403/429 policy remain separately handled. The full reverse-endpoint implementation and `work.md` §17 acceptance remain open.
