# Local-stack smoke-check isolation — 2026-11-12

## Finding

The isolated recovery smoke test failed when the user's development site was already running. The test chose a free HTTP port and a temporary SQLite database, but its Next.js child still used the repository's shared `.next` directory. Next.js detected the active development server and exited with `Another next dev server is already running`; `scripts/check-local-stack.mjs` suppressed the child's output, making the failure look like a generic readiness timeout.

## Change

- `next.config.mjs` now accepts `TRAVEL_NEXT_DIST_DIR` as an opt-in build-directory override. Normal application runs continue to use `.next`.
- `scripts/check-local-stack.mjs` gives its temporary stack a process-specific `.next-local-stack-check-*` directory and removes it in `finally` after shutdown. `.gitignore` excludes any leftover check directory if the process is interrupted.
- The smoke check continues to use a temporary database, free loopback port, no provider searches, and checks graceful shutdown.

## Verification

- Reproduced the failure while the existing site was active; the exact Next.js message named PID `954733` on port 3000. The user's stack was not stopped.
- After isolation, `npm run check:local-stack` passed: HTTP 200, worker available, queue depth 0, graceful shutdown, zero provider searches, temporary database.
- `node --test tests/local-stack.test.mjs`: 2/2 passed.
- Full `npm test`: 539/539 passed.
- `npm run build` passed. `npm audit --audit-level=low` found 0 vulnerabilities.
- Existing site remained available afterward: root HTTP 200, health HTTP 200, worker `ok`, queue depth 0.

This validates the local smoke-test setup and loopback stack only. It does not satisfy the public deployment, authentication, off-host backup, monitoring or recovery acceptance gates in `work.md` §17. Keep the app local-only.
