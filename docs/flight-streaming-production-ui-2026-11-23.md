# Progressive flight results: production UI check — 2026-11-23

## Check

Started the existing production build on loopback port 3117 and ran:

```sh
TRAVEL_CHECK_URL=http://127.0.0.1:3117 node scripts/check-flight-streaming-ui.mjs
```

The browser fixture intercepted all API/job requests. External requests were blocked. The server was stopped after the check; no search worker was started.

## Result

```json
{"ui":"flight-progressive-provider-results","partialPrice":600,"matrixPriceOnly":500,"finalPrice":450,"statusPolls":3,"persistedToUiMs":339,"providerRequestsIntercepted":true,"browserErrors":0,"externalRequestsBlocked":true}
```

The production page rendered a persisted flight preview and an independent Matrix price-only observation before the final fixture result. It then replaced the partial fare with the final fixture fare without browser errors.

## Limits

This is one controlled fixture sample. The values are synthetic test data; no provider request or fare lookup occurred. The 339 ms measurement covers persisted progress becoming visible in the browser, not provider response time, and is not a p95 or live end-to-end result. It verifies the current production UI's incremental rendering path only.
