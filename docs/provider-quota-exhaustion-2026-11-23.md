# Successful-response provider quota exhaustion — 2026-11-23

## Change

The shared `fetchSource` transport previously applied `X-RateLimit-Requests-Reset` only after an HTTP 429. A successful response can itself consume the provider account's final request; subsequent local jobs would then still try a request before learning the quota was exhausted.

The transport now checks successful responses for `X-RateLimit-Requests-Remaining: 0` and a valid future `X-RateLimit-Requests-Reset`. It records a durable source cooldown through that reset before returning the still-valid response to the active parser. The SQLite policy is shared across local workers, so later jobs are deferred without another provider call. Invalid, missing, expired, or excessively distant reset values do not create a cooldown.

This uses the documented [Omkar API rate-limit response headers](https://www.omkar.cloud/docs/api). The provider states that `X-RateLimit-Requests-Remaining` is the account requests left after the response, and reset is a Unix timestamp. This code path is generic to compatible providers. It does not check account usage in advance, change monthly quota, or assume that all sources use these headers.

## Verification

- `node --test tests/source-fetch.test.mjs`: **15/15 passed**.
- Regression uses a successful synthetic response with zero remaining and a future reset, checks that the body remains readable, and confirms a second worker using an independent SQLite connection is rejected without another fetch.
- `node --test tests/source-fetch.test.mjs tests/ignav.test.mjs`: **39/39 passed** after the compatibility fix for numeric deterministic clock overrides.
- Full `npm test`: **663/663 passed**.
- `npm run build`: passed on the retry after Next.js 16.4.3 emitted its known-security advisory and requested the same command be retried.
- `npm audit --audit-level=low`: reports one moderate vulnerability in Next.js 16.4.3 (affected versions 16.0.0–16.4.4). The forced audit fix installs 16.4.6 outside the declared dependency range; no dependency update was made.
- No live provider request was made for this change.
- Full suite and build results are recorded in the current handoff after verification.

## Limits

Provider rate-limit headers are not a record of permitted use or a substitute for partner terms. Source-specific authorization, cadence and credentials remain open for sources without approved access. Reverse-endpoint completion and `work.md` §17 remain incomplete.
