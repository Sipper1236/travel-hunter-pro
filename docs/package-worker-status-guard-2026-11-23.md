# Package worker status guard — 2026-11-23

## Finding

The durable package worker validator accepted `status: "currency_unverified"` with only a matching query and an empty offers array. That envelope did not include observed-result coverage, source evidence, or reconciled counts. The production search path verifies Air Canada Vacations' official CAD terms before starting the browser and throws if it cannot confirm them, so an unverified-currency result is not a valid completed worker result.

## Change

The worker-result schema now accepts only `status: "observed"`. The lower-level card normalizer still returns `currency_unverified` when called without official currency evidence; the worker boundary rejects that value rather than persisting it as a successful search. Empty observed results continue to require normal coverage and reconciled counts. The response cache already only reuses observed positive results.

## Verification

- Test-first regression reproduced acceptance of the minimal `currency_unverified` envelope.
- `node --test tests/package-worker-result.test.mjs tests/vacation-normalize.test.mjs` passed **25/25**, including preservation of the normalizer's explicit unverified-currency behavior.
- Full `npm test` passed **725/725**.
- `npm run build` passed on Next.js 16.4.6; `npm audit --audit-level=low` found **0 vulnerabilities**.
- `npm run check:markdown-links` checked **138 files** with no broken links; `git diff --check` passed.
- No provider request was made.

