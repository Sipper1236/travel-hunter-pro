# Contributing

## Local setup

Use Node.js 22.13 or newer. Copy `.env.example` to `.env.local` for local configuration and keep any credentials private. Start the app and worker with `npm run dev:stack`.

## Checks

Before opening a change, run:

```sh
npm ci
npm audit --audit-level=low
npm run check:markdown-links
npm test
npm run build
```

Tests must use fixtures and intercepted requests. Do not call live providers from automated tests. Production code must not substitute synthetic fares for provider results.

## Provider and data boundaries

- Keep credentials, traveler personal information, session cookies, authorization headers, and private captures out of Git, logs, tests, and issue reports.
- Use only documented or explicitly authorized access. Respect provider terms, pacing, response limits, and access refusals.
- Do not bypass CAPTCHAs or other access controls, create accounts, book, reserve, or make a paid commitment.
- Preserve source, currency, traveler scope, itinerary identity, observation time, and coverage evidence. Keep unverified offers explicitly unverified.
- Update the implementation status and dated evidence when behavior or provider scope changes.
