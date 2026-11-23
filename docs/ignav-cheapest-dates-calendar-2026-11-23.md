# Ignav cheapest-dates calendar fast path — 2026-11-23

## Implemented

Eligible Ignav fare calendars now use the structured `/fares/cheapest-dates` operation to retrieve date-level prices for an exact airport pair and departure range in one provider response. For a round trip, the request carries the validated fixed stay length. The result is projected back onto each exact departure/return cell; an in-process promise map shares the response across the date cells and coverage records the single wire response separately from the per-date logical request budget.

The fast path is limited to count-party searches with no children, no identified travelers, no active filters, valid fixed trip dates, and the configured Ignav source. A supplied exact-search adapter takes precedence; `TRAVEL_IGNAV_CALENDAR_GRID=0` disables the live fast path. Filters and unsupported party shapes keep using the exact itinerary search.

Each observation must match the request's airport pair, departure range, trip type, return date/stay length, cabin, adult count, Canadian market and CAD currency. The source response must have an offset-aware, fresh observation timestamp. Worker validation repeats the route/date/party/currency/source checks before the result can be persisted or shown. The UI labels the value as price-only and sends the follow-up action to an exact Ignav date search. No flight segments, seller availability, baggage, mandatory charges or booking status are inferred from the date endpoint.

## Verification

- Calendar regressions cover one-way range reuse, fixed-stay round-trip mapping, budget accounting, filter fallback, source-query tampering and worker-boundary validation.
- A forked worker test exercises the real adapter through an intercepted fixture transport and confirms two date cells share one wire response while remaining two logical calendar slots. It produces only price observations, not fare offers.
- Production-build browser fixture `TRAVEL_CHECK_URL=http://127.0.0.1:3121 node scripts/check-calendar-streaming-ui.mjs` rendered Ignav and Matrix price-only cards next to a fare and verified that selecting the Ignav observation switches the exact-search source to Ignav. It completed in two status polls with zero page errors; all job/provider responses were intercepted and external requests were blocked.
- `npm test`: **684 passed, 0 failed**.
- `npm run build`: passed on retry. The first invocation stopped after compilation to show Next.js 16.4.3's existing security-upgrade reminder; the retry completed successfully and displayed the advisory warning.
- `npm audit --audit-level=low`: one moderate Next.js advisory; npm proposes a forced update to 16.4.6 outside the package's declared version range. No dependency upgrade was made.
- No live provider request was made. This does not establish endpoint access entitlement, live schema stability, provider latency, or a speed benchmark.

## Remaining work

Test the endpoint only under the configured account's access scope and rate policy. Confirm fresh live response shape, response cadence, and the provider's meaning of its date price. Keep observations labeled unverified; exact-date itinerary search and seller checks remain necessary. Extend other providers only where a documented/authorized endpoint returns enough exact-query evidence; do not assume the Ignav contract applies to them.
