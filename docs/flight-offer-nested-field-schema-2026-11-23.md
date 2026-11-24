# Flight offer nested itinerary field schema — 2026-11-23

## Change

The shared flight-offer validator now checks the field names of each segment and the nested inbound leg. It rejects unsupported segment properties such as `sellerConfirmed: true`, and rejects unsupported inbound-leg properties. The inbound leg accepts only route, date/time, duration, airline, connection, and segment fields. Segment fields are allowlisted from the current adapter shapes, including the provider-specific timestamp and carrier aliases used by Google Flights, Expedia, Ignav, ITA Matrix, Skyscanner, and Air Canada NDC.

Two regressions reproduced the gaps at the flight-worker result boundary: one injected a seller claim into an outbound segment; the other injected the claim into the inbound leg of a valid round trip. The provider dispatcher test fixture was also corrected: it had copied all outbound offer properties into the inbound leg, unlike the actual adapter contract. The revised fixture preserves its test intent while using the normalized leg shape.

## Verification

- `node --test tests/flight-worker-result.test.mjs` — 14/14 passed.
- `node --test tests/providers.test.mjs` — 16/16 passed.
- `npm test` — 740/740 passed.
- Focused adapter/worker/calendar suite before the final inbound-leg guard — 195/195 passed; the full suite above includes the final inbound guard and fixture correction.
- `TRAVEL_NEXT_DIST_DIR=.next-flight-offer-nested-schema-build npm run build` — passed on Next.js 16.4.6.
- `npm audit --audit-level=low` — zero vulnerabilities.
- `npm run check:flight-default` — passed with provider/job endpoints intercepted, one normal search, no automatic comparison, no reload re-enqueue, zero browser errors, and zero application CSP violations. The check counted 33 Next.js devtools style CSP events separately.
- `npm run check:markdown-links` — all 151 Markdown files passed; `git diff --check` passed.
- Loopback root returned HTTP 200. Same-origin `POST /api/health` returned `ok`, queue depth 0, one live worker, 11 stale historical worker records, and zero expired leases/deadlines. The local page was opened at `http://127.0.0.1:3000`.

No live provider, seller, reservation, or booking request was made. Browser QA uses fixtures with provider and job endpoints intercepted.

## Limits

This is a shallow key allowlist for offer, inbound-leg, and segment objects. It does not recursively validate all nested provider metadata such as codeshare lists, seller selection objects, party evidence, source timing evidence, or their value relationships. It does not prove that source price, currency, age eligibility, live inventory, baggage, fees, seller acceptance, or checkout totals are true. Keep `work.md` §17 live-price and full verification criteria open.
