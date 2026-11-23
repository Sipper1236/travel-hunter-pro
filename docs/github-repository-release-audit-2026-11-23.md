# GitHub repository release audit — 2026-11-23

## Repository presentation and maintenance

- Reworked the root README into a concise project overview, local setup, supported local API surface, evidence limits, documentation links, and an explicit statement that the repository has no license file.
- Added contributor and security reporting guidance.
- Added CI for clean install, dependency audit, local Markdown-link validation, tests, and production build. The workflow grants only `contents: read`.
- Added Dependabot updates for npm and GitHub Actions.
- Added a Markdown checker that validates local file and heading links across tracked and untracked Markdown files.
- Corrected three stale documentation links to match the current acceptance heading and current ACV evidence.
- Updated Next.js to 16.4.6 and refreshed the lockfile to clear the reported dependency advisories.

## Verification

Commands run on 2026-11-23:

| Check | Result |
| --- | --- |
| `npm ci` | Passed; 135 packages audited, zero vulnerabilities |
| `npm test` | Passed; 705 tests on Node 26.13 and again on the workflow's Node 22.13.1 after correcting Node 22's OpenSSL authentication error wording |
| `npm run build` | Passed on Next.js 16.4.6 under Node 26.13 and Node 22.13.1 |
| `npm audit --audit-level=low` | Passed; zero vulnerabilities |
| `npm run check:markdown-links` | Passed; 131 Markdown files, no broken local links |
| `npm run check:responsive-ui` | Passed; 320/375/768/1280 layout checks, no horizontal overflow |
| `npm run check:theme-contrast` | Passed; sampled visible text passed in dark and light themes |
| `npm run check:accessible-controls` | Passed on final rerun: 113 controls checked, no unnamed controls, duplicate IDs, or broken ARIA references; 85 keyboard targets traversed; mocked live suggestion and reload flow passed; no browser errors or provider traffic. Two earlier attempts timed out during the reload suggestion wait, but the focused browser probe and final full rerun passed. |
| `npm run check:local-stack` | Passed earlier in this audit; temporary web/worker stack started and shut down cleanly |

UI checks used local fixtures and blocked external/provider traffic. They do not establish live inventory, traveler eligibility, seller-confirmed price, or booking availability. No provider search or booking was made for this audit.

Hosted CI initially exposed a Node 22 OpenSSL authentication-message difference and several intermittently cancelled/partial browser-worker tests under parallel load. Backup error normalization was fixed; deadline tests now keep Node's event loop alive while exercising deliberately unreferenced abort timers. The hosted CI test command now runs files serially to reduce process/browser fixture contention, while local `npm test` retains its two-worker setting. The regional Google worker fixture also uses a seeded, exact airport-timezone cache instead of parsing a large synthetic directory before exercising the browser flow. The full suite passed locally under Node 22.13.1; the focused cache-seeded regional worker test passes. Hosted CI passed all steps on commit `a4d05ff`; the newer GitHub Actions v7 runner update exposed a calendar-worker fixture failure before this adjustment. Final hosted verification is pending.

## GitHub publication and application boundary

The source repository was pushed to `https://github.com/Sipper1236/travel-hunter-pro` and made public on 2026-11-23 after this audit. The application remains a local-development prototype: its servers bind to loopback, public deployment is not approved, provider credentials and live access are incomplete, and the product requirements in [`work.md`](../work.md) remain open. Public source availability does not mean public hosting or production readiness.

No license file is included. Reusers must not assume the repository grants permission to redistribute or reuse the code.

## Remaining actions

1. Continue closing the applicable `work.md` §17 acceptance criteria with current reproducible live evidence; fixture tests alone do not complete them.
2. Keep the app local-only until authentication, public deployment security, abuse protection, monitoring, recovery, provider authorization, and live seller evidence gates are met.
