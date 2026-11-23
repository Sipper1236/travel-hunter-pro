# Travel Hunter Pro

A local travel research prototype for comparing observed flight, hotel, package, and fare-calendar results from multiple sources. It preserves source evidence and shows where a quote is incomplete or stale. It does not book, reserve, or charge for travel.

> **Status:** Research prototype. Production authentication and deployment security, broad live-source verification, airline eligibility, seller-confirmed availability, final taxes/fees, and exhaustive regional coverage are incomplete. Run it locally only.

## Run locally

Requirements: Node.js 22.13 or later.

```sh
npm ci
npm run dev:stack
```

Open <http://localhost:3000>. `dev:stack` starts the loopback-only Next.js app and its durable search worker together. Press Ctrl+C to stop both. For separate processes, use `npm run dev` and `npm run worker` in two terminals.

Provider keys are optional. To configure an entitled source, copy `.env.example` to `.env.local`, add only credentials issued for your account, and restrict the file to your user:

```sh
cp .env.example .env.local
chmod 600 .env.local
```

Never commit `.env.local`, session cookies, provider captures, or credentials. Some sources remain unconfigured without partner onboarding. The app reports those sources as unavailable; it does not substitute fixture fares.

## What it does

- Searches supported flight providers and streams validated source results as they arrive.
- Compares exact-date fares and bounded regional/calendar searches while disclosing omitted routes and provider limits.
- Runs separate-ticket comparisons with request budgets, exact-flight matching, and freshness checks.
- Searches Flight + Hotel and Air Canada Vacations packages as separate products.
- Supports official-property hotel observations through verified Reservit booking-engine links.
- Stores local jobs in SQLite so searches can resume after a page reload.

Sources, query limits, access status, live evidence, and known gaps are tracked in [the implementation status](IMPLEMENTATION-STATUS.md) and [the handoff](HANDOFF.md). A source listed in the app may be unconfigured or limited to a narrow query shape.

## Accuracy and booking boundary

Prices are observations, not guarantees. The interface distinguishes provider observations, refreshed quotes, seller-verified details, and completed bookings. This app does not complete bookings. Confirm current availability, passenger eligibility, baggage, cancellation terms, taxes, and mandatory charges with the seller before relying on a result.

Only CAD amounts with explicit CAD evidence are displayed; other currencies are excluded without conversion. Calendar prices may be price-only observations without a verified itinerary. Search coverage is bounded to configured sources and requested airport/date budgets; results are not exhaustive.

## Local API

The Next.js routes run on loopback and back the local interface. Main routes include:

| Route | Purpose |
| --- | --- |
| `POST /api/search/jobs` | Start, inspect, pause, resume, cancel, or remove an owned flight-search job. |
| `POST /api/search` | Run a direct multi-source flight search. |
| `POST /api/search/calendar` | Enqueue a bounded fare-calendar search. |
| `POST /api/search/separate-tickets` | Enqueue a supported exact-flight ticket comparison. |
| `POST /api/hotels/search` | Search selected hotel sources. |
| `POST /api/packages/search` | Search the Air Canada Vacations widget flow. |
| `GET /api/health` | Read local application and worker health. |

Job ownership tokens are local capabilities, not user authentication. Do not expose these routes publicly or deploy this prototype as a multi-user service.

## Checks

The latest hosted verification on 2026-11-23 passed **706/706 tests** and a production build on Node 22.13.1. After Chromium startup timed out in the regional worker test, CI now selects the runner's Google Chrome binary for browser tests. The dependency audit reports zero vulnerabilities after updating Next.js to 16.4.6. CI repeats these checks on pushes and pull requests.

```sh
npm test
npm run check:markdown-links
npm run build
npm audit --audit-level=low
npm run check:local-stack
```

UI smoke checks intercept or block provider traffic. Passing fixture and UI checks does not prove current inventory, supplier permission, seller acceptance, checkout totals, or accessibility conformance. See the evidence and limitations in [the documentation index](docs/README.md).

## Project documents

- [`work.md`](work.md) — requirements and acceptance criteria; §17 is the acceptance authority.
- [`HANDOFF.md`](HANDOFF.md) — current handoff, verified progress, blockers, and next actions.
- [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) — implementation status against `work.md`.
- [`ITA_MATRIX_INTEGRATION.md`](ITA_MATRIX_INTEGRATION.md) — Matrix adapter design and reverse-engineering caveats.
- [`docs/README.md`](docs/README.md) — dated implementation, research, and verification evidence.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local checks and provider/data handling rules.
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting and credential rotation.

Lowercase `handoff.md`, `goal.md`, and `integration.md` are historical notes from earlier project stages. Use the uppercase current handoff/status files linked above.

## License

No license file is currently included.
