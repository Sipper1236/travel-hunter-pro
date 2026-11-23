# ITA Matrix live reverse-endpoint recheck — 2026-11-23

## Query and result

One read-only structured API request used the existing `searchMatrix` adapter for YYZ→LHR, one-way, 2027-02-12, one adult, economy, CAD. The adapter returned `status: ok`, 10 records and 10 accepted itineraries in **41,688 ms**. No prices, flight identifiers, request headers, or response bodies were printed or retained in this evidence.

The same exact query was then passed through `searchProviders`. ITA Matrix reported a durable cache hit, again with 10 received and 10 accepted. `flightWorkerResultError` returned `null` for the normal provider result. This confirms current endpoint-to-provider-pipeline normalization, Matrix cache reuse across separate Node processes, and worker-result compatibility for this one query shape.

## Limits

This is one route/date/party/cabin observation. The 41.7-second cold response is far above the aspirational first-result target; the second request demonstrates reuse, not faster upstream behavior. It does not establish p95, broader coverage, current unattended-use permission/rate terms, seller availability, baggage, final checkout charges, or booking. The Matrix web-app RPC remains an unofficial interface. Do not treat its cache hit as a fresh seller check.
