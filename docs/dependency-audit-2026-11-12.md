# Dependency audit follow-up — 2026-11-12 23:13 UTC

The current `npm audit --audit-level=low` identified a moderate advisory for transitive `@hono/node-server` 2.0.0–2.1.5, brought in by `@modelcontextprotocol/sdk` through `api-anything`. The reported issues were an unhandled socket reset during asynchronous WebSocket upgrade and backslash path parsing relevant to reverse-proxy path controls.

Updated only the lockfile-selected transitive package with `npm update @hono/node-server`. The resolved version is 2.1.8; `package.json` requirements for the direct API Anything integration were not changed.

Verification on the resulting dependency tree:

- `npm audit --audit-level=low`: 0 vulnerabilities.
- `npm test`: 539/539 passed.
- `TRAVEL_NEXT_DIST_DIR=.next-audit-build npm run build`: passed. An isolated Next output directory avoided colliding with the active local site.
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:package-infant-guidance`: passed, with zero supplier/provider calls. This is controlled UI coverage, not provider acceptance.
- Same-origin `POST /api/health` at 2026-11-12 23:13 UTC: `ok`, one live worker, queue depth 0, no expired leases or deadlines.

This removes the current reported advisory; it does not prove a clean install on another machine or satisfy deployment, authentication, external monitoring, or recovery acceptance gates. Keep the app local-only.
