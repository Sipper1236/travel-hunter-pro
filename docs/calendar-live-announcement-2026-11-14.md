# Fare calendar live announcement — 2026-11-14

## Change

Progressive fare-calendar updates now expose one concise polite live announcement when the result preview changes. It reports provider responses received, the number of dates with matching observed fares, and whether the scan is still running or has completed. The visual job panel retains detailed polling/progress counters but is no longer itself a live region, avoiding repeated announcements on every status poll. Full result cards and route details are not copied into the announcement.

## Verification

- Read the repository Next.js 16.4.3 client-component guide before editing the client UI.
- `npm run build` — passed on the current source.
- `npm run check:calendar-streaming` — passed against the rebuilt production site on loopback. It verified the provisional CAD 500/510 observations stream, one concise live status, final CAD 400 result, completion announcement, two status polls, intercepted provider/job requests, and zero browser errors.
- `npm test` — passed 599/599 (104.9 seconds).
- `npm audit --audit-level=low` — 0 vulnerabilities.
- Stopped the temporary production server after browser verification.

The streaming UI check uses controlled browser fixtures and is not evidence of a live fare or assistive-technology announcement quality on a screen reader.

## Open evidence

Manual screen-reader testing and broader dynamic/error-state review remain open under P13. Calendar source coverage also remains bounded and incomplete when a provider fails. A separate one-way Expedia-via-Omkar live recheck on Nov 14 used the adapter's bounded two HTTP attempts and returned HTTP 500 both times. No fares were returned. The [upstream API README](https://github.com/omkarcloud/expedia-scraper) still documents the configured one-way endpoint, IATA origin/destination, date, cabin, and `API-Key` contract; the observed failure was a service error, not evidence that the app should switch contracts. No further retries were made. Omkar's unavailability keeps affected calendars marked incomplete; this does not establish that other providers or all regional pairs were searched.
