# Calendar worker submitted-query binding — 2026-11-23

## Change

The durable calendar validator checked a result against `result.query` but did not receive the calendar job's submitted input. The worker runner therefore accepted a fully self-consistent calendar envelope even if its filters or destination no longer matched the requested search.

The runner now passes the submitted job input into `calendarWorkerResultError`. The validator normalizes it, binds source, locations, date/stay ranges, party, cabin, filters, Matrix settings, airport limit and request budget, and verifies that result airport pairs are exactly derived from the selected airport lists. Pre-resolved airports may only be selected as an ordered subset of submitted candidates; omissions require coverage evidence. Location resolution from an initially unresolved city/region remains supported when the result includes matching location evidence for its resolved airport list. The final status must be one of the runner's known terminal states.

## Verification

- Test-first regression reproduced acceptance of an internally valid calendar whose filter differed from the submitted search.
- Additional coverage checks a changed destination and a verified Europe region expansion against the original request.
- Focused calendar worker/search tests passed **68/68**.
- Full `npm test` passed **724/724**.
- `npm run build` passed on Next.js 16.4.6.
- `npm audit --audit-level=low` found **0 vulnerabilities**.
- Markdown links passed for **136 files**.
- No live provider request was made; evidence is fixture-based.

## Remaining limits

This binds durable calendar results to the job query; it does not improve live fare coverage, prove complete airport directories, or verify seller availability, baggage, mandatory fees or checkout totals. The calendar and `work.md` §17 remain Partial.
