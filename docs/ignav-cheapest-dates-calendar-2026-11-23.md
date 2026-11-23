# Ignav cheapest-dates calendar fast path — 2026-11-23

## Implemented

Eligible Ignav fare calendars now use the structured `/fares/cheapest-dates` operation to retrieve date-level prices for an exact airport pair and departure range in one provider response per stay length. For a round trip, the request carries the validated fixed stay length. The result is projected back onto each exact departure/return cell; an in-process promise map shares the response across the date cells and coverage records wire responses separately from the per-date logical request budget. Flexible night ranges therefore make one request for each requested stay length, rather than one request for every departure/return combination.

The fast path is limited to count-party searches with no children, no identified travelers, no active filters, valid fixed trip dates, and the configured Ignav source. A supplied exact-search adapter takes precedence; `TRAVEL_IGNAV_CALENDAR_GRID=0` disables the live fast path. Filters and unsupported party shapes keep using the exact itinerary search.

Each observation must match the request's airport pair, departure range, trip type, return date/stay length, cabin, adult count, Canadian market and CAD currency. The source response must have an offset-aware, fresh observation timestamp. Worker validation repeats the route/date/party/currency/source checks before the result can be persisted or shown. The UI labels the value as price-only and sends the follow-up action to an exact Ignav date search. No flight segments, seller availability, baggage, mandatory charges or booking status are inferred from the date endpoint.

## Verification

- Calendar regressions cover one-way range reuse, fixed-stay and flexible-stay round-trip mapping, budget accounting, filter fallback, source-query tampering and worker-boundary validation. A two-departure/two-stay query maps four exact cells from two grid requests.
- A forked worker test exercises the real adapter through an intercepted fixture transport and confirms two date cells share one wire response while remaining two logical calendar slots. It produces only price observations, not fare offers.
- A bounded live `YYZ→LHR` one-way request for 2027-01-10 through 2027-01-11 returned two date rows, both with CAD currency and `unverified` status. The adapter query echo matched the exact route, range, adult count and cabin; the timestamp was offset-aware. No amounts or payloads were recorded.
- The same live range through `searchFareCalendar` returned two `price_only_observed` cells with `wireResponses` 1 then 0; `calendarWorkerResultError` returned `null`. An isolated temporary SQLite job store and real child worker also completed the query, validated both cells, and reported complete two-date coverage. No itinerary offers were created.
- Production-build browser fixture `TRAVEL_CHECK_URL=http://127.0.0.1:3121 node scripts/check-calendar-streaming-ui.mjs` rendered Ignav and Matrix price-only cards next to a fare and verified that selecting the Ignav observation switches the exact-search source to Ignav. It completed in two status polls with zero page errors; all job/provider responses were intercepted and external requests were blocked.
- `npm test`: **686 passed, 0 failed**.
- `npm run build`: passed on retry. The first invocation stopped after compilation to show Next.js 16.4.3's existing security-upgrade reminder; the retry completed successfully and displayed the advisory warning.
- `npm audit --audit-level=low`: one moderate Next.js advisory; npm proposes a forced update to 16.4.6 outside the package's declared version range. No dependency upgrade was made.
- Live verification covers only one route, adult-only economy query and two dates. It does not establish wider schema stability, source quota/contract terms, or provider p95. The date values remain unverified and no seller, itinerary, baggage, fee or final-price claim is made.

## Remaining work

Record the configured account's access scope and provider-specific rate policy, then continue bounded shape checks across more route/cabin/party combinations. Keep observations labeled unverified; exact-date itinerary search and seller checks remain necessary. Extend other providers only where a documented/authorized endpoint returns enough exact-query evidence; do not assume the Ignav contract applies to them.

## Related Google calendar reverse path — 2026-11-23

The same source pass found that Google's existing native calendar RPC was still disabled locally. `TRAVEL_GOOGLE_CALENDAR_RPC=1` is now enabled in the local `.env.local` and documented in `.env.example`. The RPC fast path is restricted to unfiltered, one-adult economy round-trip calendars; one-way grid requests are not used because the observed grid operation is unsupported there. Exact one-way flight searches remain the fallback.

Live checks through the calendar aggregator on 2026-11-23:

- YYZ→LHR, round trip, 2027-01-10 through 2027-01-11 with a fixed five-night stay produced two CAD price-only date cells. Each departure had a different exact return date, so this shape required two `GetCalendarPicker` responses. The worker result validator accepted the result and the scan completed.
- With the same departure range and a fixed 2027-01-20 return date, one `GetCalendarPicker` response populated both exact date cells (`wireResponses` 1 then 0). The calendar worker validator accepted the complete result.
- YYZ→LHR, one-way, 2027-01-10 dispatched through the exact Google flight search path and produced ten validated itinerary observations. The calendar worker validator accepted the result.
- No prices, full RPC bodies, seller availability, or checkout data were captured. These are single-query observations, not latency percentiles or broad coverage evidence.

The general calendar error path now records a failed source against the exact attempted date/route before stopping later dates. This distinguishes an attempted provider failure (`source_failure`) from dates never dispatched (`not_scanned`); a regression verifies the failure and remaining request coverage counters.
