# ITA Matrix integration — live prices and deep links without heavy dependencies

**Target:** Current Node.js 22.13+ application. The Matrix adapter lives in `lib/ita-matrix.mjs` and is called through `lib/providers.mjs` and the durable flight-search worker.  
**Runtime:** Node.js 22.13+ (native `fetch`, `Buffer`, `node:http`, `node:crypto`).  
**Added runtime dependencies for Matrix transport:** none. The application separately depends on `api-anything` for other source workflows.

> **Current implementation status (reconciled 2026-11-14):** Matrix transport is implemented through `lib/ita-matrix.mjs`, but uses an unofficial reverse-engineered interface, not a supported public booking/pricing API. A bounded YHZ–LAX live search (2026-12-15–22, one adult, economy, CAD, two extra stops, airport changes disabled) returned 25 results; the browser flow expanded 3/3 selected itinerary details and accepted 3 complete itinerary observations, while 22 remained separate Matrix-reported CAD price observations. These are observations, not seller quotes or confirmed bookable fares. Ordinary API responses use a shared SQLite cache with a five-minute TTL, maximum 100 entries and 1 MB per response; native-browser searches, including the new detailed expansion, bypass this API response cache. Seller availability, fare-basis detail, baggage, mandatory charges and final checkout totals remain unverified. This document's protocol examples are historical research, not a guarantee of current provider support. For current implementation/evidence use [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md), [`handoff.md`](handoff.md), and [`docs/matrix-detailed-expansion-live-2026-11-14.md`](docs/matrix-detailed-expansion-live-2026-11-14.md); see [`docs/ita-matrix-family-round-trip-investigation.md`](docs/ita-matrix-family-round-trip-investigation.md) for family limits. Respect current authorization, access controls, and provider pacing.

## Current detailed expansion behavior

The web UI exposes a bounded `Expand detailed Matrix itineraries` setting. It is eligible only for an exact-airport, fixed-date economy search with at most two extra stops. In all-source searches it is opt-in; selecting Matrix alone automatically enables it for an eligible exact route. Region and multi-airport city fanout suppresses detail expansion, and the calendar API rejects it rather than multiplying browser requests across dates and pairs. The native Matrix form currently exposes no more than two extra stops. For each eligible request, the browser adapter expands at most three connecting or mixed-carrier results and accepts details only when they match the current session, solution set, and exact solution ID. The parser validates segment and booking-category evidence before producing a complete offer. Remaining incomplete Matrix totals stay in the separate price-observation section. Detailed searches are not cached by the normalized API-response cache and can take longer. See the dated live/website-worker evidence linked above.

## 1. Goal and architecture

The original diagram below uses a proposed route name. In the shipped app, submit through `POST /api/search` or `POST /api/search/jobs`; do not add a separate `/api/flights/search` endpoint just to match this sketch.

Implement two related but separate operations:

1. The protocol target for `searchPrices(request)` is to call Matrix's backend via ordinary HTTPS and normalize Matrix-reported price observations. Current application evidence is narrower: it displays price-only observations where returned data cannot validate a full itinerary; those are not confirmed fares, seller quotes, or bookable offers.
2. `buildMatrixUrl(request)` produces the `/flights?search=...` or `/calendar?search=...` page URL without making a network request. An optional `buildItineraryUrl` pins a particular Matrix-priced solution while its server session is valid.

```
Travel UI (YHZ initially preselected, but arbitrary airport choices accepted)
       | GET /api/flights/search?origin=YHZ&destination=LHR&...
       v
Travel server: input validation -> caching -> rate limiting
       |                           +-> URL encoder (pure Node.js)
       v
Matrix adapter: JSON body -> multipart/mixed request -> HTTPS POST
       v
https://content-alkalimatrix-pa.googleapis.com/batch
       | inner POST /v1/search?key=...&alt=json
       v
Multipart response -> JSON -> normalized fares -> browser UI
```

**Important separation:** The URL's Base64 JSON is **NOT** the backend search request body. Do not POST the URL's `search=` payload to the API.

## 2. Confirmed upstream request shape

Primary reference: [`itamx` client.py](https://github.com/YogevKr/itamx/blob/main/src/itamx/client.py). Cross-check: [`ita-matrix-mcp`](https://github.com/Filip-Kin/ita-matrix-mcp). See also [`flight-cli` links.py](https://github.com/ak2k/flight-cli/blob/main/src/flight_cli/links.py).

- Outer URL: `POST https://content-alkalimatrix-pa.googleapis.com/batch?$ct=multipart/mixed; boundary=BOUNDARY` (properly URL-encoded).
- Outer header: `Content-Type: text/plain; charset=UTF-8`.
- Outer body: a `multipart/mixed` envelope containing an `application/http` request to `POST /v1/search?key=API_KEY&alt=json`.
- Inner request headers include `x-alkali-application-key: applications/matrix`, `x-alkali-auth-apps-namespace: alkali_v2`, `x-alkali-auth-entities-namespace: alkali_v2`, `X-Requested-With: XMLHttpRequest`, and `Content-Type: application/json`.
- The web app exposes a **public API key**; the key is not a server-side private authorization token. However, its presence does not imply permission for unlimited automation or guarantee continued access. Configure it via `ITA_MATRIX_API_KEY`; do not ship it in the client bundle or hard-code a copied third-party key in source.
- Backend search requests specify **one slice per flown direction**; a round trip has outbound and inbound slices. URL state usually represents a round trip in **one slice containing both dates**.
- The Matrix backend uses `maxLegsRelativeToMin`, not necessarily an absolute number of connections. Treat this parameter carefully.
- For premium economy, the API cabin enum uses `PREMIUM-COACH`.

## 3. Internal contract

Keep this stable regardless of upstream changes:

```ts
interface FlightSearchRequest {
  origin: string;                    // e.g. YHZ
  destination: string;               // e.g. LHR
  departureDate: string;             // YYYY-MM-DD
  returnDate?: string;               // omitted for one-way
  cabin?: 'COACH' | 'PREMIUM-COACH' | 'BUSINESS' | 'FIRST';
  passengers?: {
    adults: number;
    youths?: number;
    children?: number;
    seniors?: number;
    infantsInSeat?: number;
    infantsInLap?: number;
  };
  currency?: string;                 // e.g. CAD
  salesCity?: string;                // point-of-sale city, if specified
  maxExtraLegsRelativeToMinimum?: number; // 0 = minimum possible legs
  allowAirportChanges?: boolean;
  pageSize?: number;
}
```

**Youth and children are distinct.** Use the API field `youths` (plural) in the price request. The Matrix SPA URL state may instead use `youth` (singular), per `flight-cli`'s encoder. Do not merge these into adults or assume price equivalence. Keep lap infants separate from seat infants. Age cutoffs and eligibility are carrier/fare dependent; validate applicable age rules and fare restrictions before presenting a passenger category as purchasable.

**Normalized response proposal:**

```json
{
  "provider": "ita-matrix",
  "sourceType": "unofficial",
  "searchedAt": "2026-10-29T22:55:00.000Z",
  "currency": "CAD",
  "results": [
    {
      "id": "provider-solution-id",
      "total": {"amount": 523.19, "currency": "CAD"},
      "outbound": [],
      "inbound": [],
      "matrixSearchUrl": "https://matrix.itasoftware.com/flights?search=...",
      "matrixItineraryUrl": null,
      "availabilityVerified": false,
      "rawProviderRef": "..."
    }
  ],
  "warnings": [],
  "cached": false
}
```

The price above is illustrative **schema documentation**, not a live quote. Avoid inventing segment data when missing. It is acceptable to return `null` for itinerary fields while developing a versioned parser.

## 4. Minimal Node.js implementation

Create `workers/ita-matrix.mjs` (or put under your existing backend adapters directory).

```js
import { randomBytes } from 'node:crypto';

const MATRIX_BATCH = 'https://content-alkalimatrix-pa.googleapis.com/batch';
const MATRIX_SITE = 'https://matrix.itasoftware.com';
const SUMMARIZERS = [
  'carrierStopMatrix', 'currencyNotice', 'solutionList',
  'itineraryPriceSlider', 'itineraryCarrierList',
  'itineraryDepartureTimeRanges', 'itineraryArrivalTimeRanges',
  'durationSliderItinerary', 'itineraryOrigins',
  'itineraryDestinations', 'itineraryStopCountList', 'warningsItinerary'
];

function checkDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T12:00:00Z`))) {
    throw new Error(`Invalid ${field}`);
  }
}

function checkCode(value, field, regex = /^[A-Z]{3}$/) {
  const code = String(value ?? '').toUpperCase().trim();
  if (!regex.test(code)) throw new Error(`Invalid ${field}`);
  return code;
}

export function validateSearch(input) {
  const origin = checkCode(input.origin, 'origin');
  const destination = checkCode(input.destination, 'destination');
  if (origin === destination) throw new Error('Origin and destination must differ');
  checkDate(input.departureDate, 'departureDate');
  if (input.returnDate) {
    checkDate(input.returnDate, 'returnDate');
    if (input.returnDate < input.departureDate) throw new Error('Return precedes departure');
  }
  const pax = input.passengers ?? { adults: 1 };
  const allowed = ['adults', 'youths', 'children', 'seniors', 'infantsInSeat', 'infantsInLap'];
  for (const [key, value] of Object.entries(pax)) {
    if (!allowed.includes(key) || !Number.isSafeInteger(value) || value < 0 || value > 9)
      throw new Error(`Invalid passenger count: ${key}`);
  }
  if ((pax.adults ?? 0) + (pax.youths ?? 0) + (pax.children ?? 0) +
      (pax.seniors ?? 0) + (pax.infantsInSeat ?? 0) + (pax.infantsInLap ?? 0) < 1)
    throw new Error('At least one traveler is required');
  const cabin = input.cabin ?? 'COACH';
  if (!['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'].includes(cabin))
    throw new Error('Invalid cabin');
  const currency = checkCode(input.currency ?? 'CAD', 'currency');
  const pageSize = input.pageSize ?? 50;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new Error('Invalid pageSize');
  const relativeStops = input.maxExtraLegsRelativeToMinimum ?? 1;
  if (!Number.isInteger(relativeStops) || relativeStops < 0 || relativeStops > 5)
    throw new Error('Invalid maxExtraLegsRelativeToMinimum');
  return {
    ...input, origin, destination, cabin, currency, pageSize,
    maxExtraLegsRelativeToMinimum: relativeStops,
    passengers: pax
  };
}

function makeSlice(origin, destination, date) {
  return {
    origins: [origin], destinations: [destination], date,
    dateModifier: { minus: 0, plus: 0 },
    isArrivalDate: false,
    filter: { warnings: { values: [] } },
    selected: false
  };
}

export function makeMatrixBody(raw) {
  const q = validateSearch(raw);
  const slices = [makeSlice(q.origin, q.destination, q.departureDate)];
  if (q.returnDate)
    slices.push(makeSlice(q.destination, q.origin, q.returnDate));
  return {
    summarizers: SUMMARIZERS,
    inputs: {
      filter: {}, page: { current: 1, size: q.pageSize },
      pax: q.passengers,
      slices, firstDayOfWeek: 'SUNDAY', internalUser: false,
      sliceIndex: 0, sorts: 'default', cabin: q.cabin,
      maxLegsRelativeToMin: q.maxExtraLegsRelativeToMinimum,
      changeOfAirport: q.allowAirportChanges ?? true,
      checkAvailability: true,
      currency: q.currency,
      ...(q.salesCity ? { salesCity: checkCode(q.salesCity, 'salesCity') } : {})
    },
    summarizerSet: 'wholeTrip', name: 'specificDatesSlice'
  };
}

function makeBatch(inner, key, path = '/v1/search') {
  const boundary = `batch${randomBytes(12).toString('hex')}`;
  const pieces = [
    `--${boundary}`,
    'Content-Type: application/http',
    'Content-Transfer-Encoding: binary',
    `Content-ID: <${boundary}+gapiRequest@googleapis.com>`,
    '',
    `POST ${path}?key=${encodeURIComponent(key)}&alt=json`,
    'x-alkali-application-key: applications/matrix',
    'x-alkali-auth-apps-namespace: alkali_v2',
    'x-alkali-auth-entities-namespace: alkali_v2',
    'X-Requested-With: XMLHttpRequest',
    'Content-Type: application/json',
    '',
    JSON.stringify(inner),
    `--${boundary}--`,
    ''
  ];
  const url = `${MATRIX_BATCH}?${new URLSearchParams({
    '$ct': `multipart/mixed; boundary=${boundary}`
  })}`;
  return { url, body: pieces.join('\r\n') };
}

// A multipart response contains HTTP headers and an inner JSON response.
// Extract the first parsable JSON object *after* the application/http header.
// Prefer a proper boundary-aware parser if Matrix ever returns multiple parts.
function parseBatchResponse(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Matrix response contains no JSON');
  let result;
  try { result = JSON.parse(raw.slice(start, end + 1)); }
  catch { throw new Error('Matrix multipart response format changed'); }
  if (result.error) throw new Error(`Matrix API error: ${JSON.stringify(result.error).slice(0, 500)}`);
  return result;
}

export async function searchMatrix(raw, { apiKey = process.env.ITA_MATRIX_API_KEY } = {}) {
  if (!apiKey) throw new Error('Set ITA_MATRIX_API_KEY on the backend');
  const q = validateSearch(raw);
  const { url, body } = makeBatch(makeMatrixBody(q), apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      Accept: '*/*',
      Origin: MATRIX_SITE,
      Referer: `${MATRIX_SITE}/`
    },
    body,
    signal: AbortSignal.timeout(45_000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Matrix HTTP ${response.status}: ${text.slice(0, 200)}`);
  return parseBatchResponse(text);
}

// Price field is generally displayTotal = 'CAD523.19' or '$523.19'
// in solutionList.solutions; confirm currency in a fixture before production.
export function parseMoney(displayTotal, preferredCurrency) {
  if (typeof displayTotal !== 'string') return null;
  const match = displayTotal.trim().match(/^([A-Z]{3})?\s*([^\d-]*)?\s*([\d,]+(?:\.\d{1,2})?)$/);
  if (!match) return null;
  const currency = match[1] || preferredCurrency;
  const amount = Number(match[3].replaceAll(',', ''));
  return Number.isFinite(amount) ? { currency, amount } : null;
}

export function normalizeMatrix(raw, request) {
  const q = validateSearch(request);
  const solutions = raw?.solutionList?.solutions;
  if (!Array.isArray(solutions)) {
    // Shape errors are different from a successful search returning zero rows.
    throw new Error('Unexpected Matrix response: solutionList.solutions missing');
  }
  const link = buildMatrixUrl(q);
  return {
    provider: 'ita-matrix', sourceType: 'unofficial',
    searchedAt: new Date().toISOString(), currency: q.currency,
    results: solutions.map((s) => ({
      id: s.id ?? null,
      total: parseMoney(s.displayTotal, q.currency),
      outbound: [], inbound: [],  // Populate only after fixture-backed segment mapping
      matrixSearchUrl: link,
      matrixItineraryUrl: null,
      availabilityVerified: false,
      rawProviderRef: s.id ?? null
    })),
    warnings: [], cached: false
  };
}

export function buildMatrixUrl(raw, { calendar = false, duration = 7 } = {}) {
  const q = validateSearch(raw);
  const dates = {
    searchDateType: calendar ? 'calendar' : 'specific',
    departureDate: q.departureDate,
    departureDateType: 'depart',
    departureDateModifier: '0',
    departureDatePreferredTimes: [],
    ...(calendar ? (q.returnDate ? { duration: String(duration) } : {}) : {
      returnDate: q.returnDate ?? ''
    }),
    returnDateType: 'depart', returnDateModifier: '0',
    returnDatePreferredTimes: []
  };
  const pax = {
    adults: String(q.passengers.adults ?? 0),
    ...(q.passengers.youths ? { youth: String(q.passengers.youths) } : {}),
    ...Object.fromEntries(
      ['children', 'seniors', 'infantsInSeat', 'infantsInLap']
        .filter(k => q.passengers[k] > 0)
        .map(k => [k, String(q.passengers[k])])
    )
  };
  const state = {
    type: q.returnDate ? 'round-trip' : 'one-way',
    slices: [{ origin: [q.origin], dest: [q.destination], dates }],
    options: {
      cabin: q.cabin === 'PREMIUM-COACH' ? 'PREMIUM_COACH' : q.cabin,
      stops: '-1', extraStops: '-1',
      allowAirportChanges: String(q.allowAirportChanges ?? true),
      showOnlyAvailable: 'true'
    },
    pax
  };
  const encoded = Buffer.from(JSON.stringify(state), 'utf8').toString('base64');
  return `${MATRIX_SITE}/${calendar ? 'calendar' : 'flights'}?search=${encodeURIComponent(encoded)}`;
}
```

### Critical correctness notes for the starter

1. `parseBatchResponse()` is intentionally a minimal parser matching the single JSON response currently used by these projects. Replace it with a boundary-aware multipart parser if captures show multiple JSON parts, embedded braces outside JSON, or other formats. It must fail closed, not silently report zero fares.
2. `normalizeMatrix()` deliberately leaves segments empty. Add mapping from real response fixtures before advertising layover/flight timing. The `itamx` detailed response model and fixtures are the best starting point.
3. `buildMatrixUrl()` is **specific-date focused**. A calendar search has *different request semantics*; a calendar URL alone does not produce a whole calendar of prices through the specific-date `/v1/search` call. Build a separate calendar-price adapter or run controlled date-specific searches.
4. The `duration` argument means nights for calendar mode. Validate its range and do not assume it derives from an arbitrary `returnDate`.
5. The URL `stops` and API `maxLegsRelativeToMin` are not necessarily equivalent. A result link can reopen a broader search until matching filters are implemented and tested.
6. Do not assume a quoted price is bookable. Cache, freshness, final airline rules, bag fees and sales-city differences matter.

## 5. Add the HTTP endpoint to your app

You may already have a Node HTTP server. If not, this small example uses only native modules. Keep search on the **server**, never directly in frontend JavaScript.

Create `server.mjs`:

```js
import http from 'node:http';
import { searchMatrix, normalizeMatrix, validateSearch } from './workers/ita-matrix.mjs';

const cache = new Map(); // single-process dev cache; use shared cache in multi-instance deploy
const TTL_MS = 5 * 60_000;

function requestFromParams(p) {
  const request = {
    origin: p.get('origin') ?? 'YHZ',
    destination: p.get('destination'),
    departureDate: p.get('departureDate'),
    returnDate: p.get('returnDate') || undefined,
    currency: p.get('currency') ?? 'CAD',
    cabin: p.get('cabin') ?? 'COACH',
    passengers: {
      adults: Number(p.get('adults') ?? 1),
      youths: Number(p.get('youths') ?? 0),
      children: Number(p.get('children') ?? 0),
      infantsInSeat: Number(p.get('infantsInSeat') ?? 0),
      infantsInLap: Number(p.get('infantsInLap') ?? 0)
    }
  };
  return validateSearch(request);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/api/flights/search' || req.method !== 'GET') {
    res.writeHead(404); res.end(); return;
  }
  try {
    const query = requestFromParams(url.searchParams);
    const key = JSON.stringify(query);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...hit.data, cached: true })); return;
    }
    const providerResponse = await searchMatrix(query);
    const data = normalizeMatrix(providerResponse, query);
    cache.set(key, { data, expires: Date.now() + TTL_MS });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (error) {
    const badInput = /^(Invalid |Origin |Return |At least )/.test(error.message);
    res.writeHead(badInput ? 400 : 502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: badInput ? error.message : 'Flight provider temporarily unavailable' }));
    if (!badInput) console.error('[matrix]', error);
  }
});
server.listen(3000, '127.0.0.1', () => console.log('http://127.0.0.1:3000'));
```

Run:

```bash
export ITA_MATRIX_API_KEY='YOUR_CURRENT_AUTHORIZED_PUBLIC_WEB_APP_KEY'
node server.mjs
curl 'http://127.0.0.1:3000/api/flights/search?origin=JFK&destination=YYZ&departureDate=2026-11-15&returnDate=2026-11-22&adults=1&currency=CAD'
```

**Key provisioning:** Check the current ITA Matrix web app and your right to use its public endpoint; see the linked projects' public-key discovery approaches. Do not treat a GitHub hardcoded key as permanent or rely on an undocumented discovery mechanism in production. If no valid key is configured or the service denies access, return a provider-unavailable error and disable Matrix results, rather than bypassing controls.

## 6. Integrate into the existing search worker

For the existing Node `workers/live-search-worker.mjs`, replace the template diagnostic with a provider adapter. **Merge** Matrix into the application's existing provider fan-out; do not remove other flight/hotel/package logic.

```js
import { searchMatrix, normalizeMatrix, validateSearch } from './ita-matrix.mjs';

// Map your UI search schema into the adapter once.
async function matrixWorker(payload) {
  const query = validateSearch({
    origin: payload.origin ?? 'YHZ',
    destination: payload.destination,
    departureDate: payload.departureDate,
    returnDate: payload.returnDate,
    cabin: payload.cabin ?? 'COACH',
    currency: payload.currency ?? 'CAD',
    passengers: {
      adults: payload.passengers?.adults ?? 1,
      youths: payload.passengers?.youths ?? 0,
      children: payload.passengers?.children ?? 0,
      infantsInSeat: payload.passengers?.infantsInSeat ?? 0,
      infantsInLap: payload.passengers?.infantsInLap ?? 0
    }
  });
  return normalizeMatrix(await searchMatrix(query), query);
}
```

If the existing `payload` carries a multi-city itinerary, do not pretend it is a round trip. Model each leg explicitly and extend `makeMatrixBody` to accept arbitrary slices. The existing template has `flights`, `hotels`, `packages`, `separateTicketSegments`, `diagnostics`, and `notes`; map normalized Matrix results into `flights`, and add the provider status to `diagnostics`. **Never populate a fake price or flight list** when API requests fail.

## 7. Exact itinerary links (optional, later phase)

For a **particular priced itinerary**, the `flight-cli` encoder supports a `/itinerary?search=...` URL with a `solution` object:

```js
solution: {
  sessionId: searchResponse.session,
  xd: true,
  rh: searchResponse.solutionSet,
  Si: selectedSolution.id
}
```

Use the actual session/solution-set property names from inspected provider responses; do not infer nonexistent fields. These links are session-scoped and reportedly expire after roughly **10–30 minutes**. Prefer the durable `/flights?search=...` link for saved results; regenerate search and IDs for an exact itinerary click-through. A Matrix URL is a fare-research link, **not** a guaranteed airline booking URL.

## 8. Prices and date calendars

### Specific-date fares

- One provider call searches a fixed outbound date (plus fixed inbound date for round trips).
- Sort `displayTotal` numerically after proper currency parsing; do not compare currency strings.
- Keep provider `id` and the original response in a short-lived backend cache for later detail requests.
- If you cannot confidently parse the currency, mark the result as unpriced instead of assuming CAD.

### Calendar-priced searches

- URL generation and calendar pricing are separate.
- The real Matrix UI has calendar search semantics; `flight-cli` has a calendar-specific wire builder in `wire.py`. Port and fixture-test that builder for efficient calendar price exploration, **or** implement a controlled window of one-date searches.
- If you fan out date searches, cap concurrency (for example 2–3), cap the date window and number of calls, cache by normalized passenger/cabin/origin/date keys, and stop on explicit provider throttling. Avoid 30–60 unthrottled concurrent requests.
- Do not synthesize a calendar fare from the cheapest specific-date fare for another date. Label missing days as unavailable/not searched rather than zero.

### Multi-passenger pricing

- Quote the entire passenger composition together, not `one adult quote × headcount`.
- Verify one-way and round-trip support, and that a lap infant is coupled to an eligible accompanying traveler.
- Keep fare currency, sales-city context, availability warning, date of observation, and price validity status.

## 9. Security, resilience and operations

- **Access:** Route requests through your own backend. Do not expose upstream keys or unrestricted proxy URLs to end users.
- **Validation:** allowlist codes, ISO dates, cabin enums, passenger classes, counts, currency and request size. The HTTP example is a minimal demo; complete production validation for age rules and date bounds.
- **Rate limiting:** per-client/IP and global provider budgets. Add a max-in-flight queue and backoff on 429/503 and temporary outages; do not keep retrying on access denial.
- **Timeouts:** use `AbortSignal.timeout`, return errors within a defined UI budget, and avoid infinite retries.
- **Caching:** 2–10 minutes for live fares as an adjustable starting point, longer only for historical analytics. Cache keys must include passengers, dates, cabin, currency, sales city and routing constraints. A cached fare is not live availability.
- **Diagnostics:** log provider, duration, HTTP status, upstream error class, schema version and a redacted request ID. Do not log full passenger personal details or API key.
- **Response changes:** pin local sanitized fixture samples and contract-test parsing after any upstream change. If `solutionList.solutions` is missing, report a schema error, not an empty search result.
- **Abuse controls:** obey provider restrictions and terms; no CAPTCHA evasion, token theft or bypass of explicit access blocks.
- **Fallback:** preserve alternative approved provider adapters; mark Matrix unavailable if its undocumented endpoint stops working.

## 10. Testing and acceptance criteria

**Offline tests, no API key needed:**

1. URL encodes/decode for `JFK -> YYZ`, 2026-10-30, round trip, 23-night duration in calendar mode.
2. Specific-date URL is `/flights` and round-trip state has **one slice with returnDate**.
3. Backend round trip has **two slices**, and `inputs.pax.youths` remains distinct from `children`.
4. Premium economy maps to `PREMIUM-COACH` on the wire.
5. Multipart body uses CRLF, valid boundary and inner `/v1/search`.
6. Normalized fare number parses from a captured response. Missing/malformed price does not become zero.
7. Provider HTTP 429, 403, 500, timeouts and changed response shapes are errors, not empty lists.
8. A repeated search within cache TTL does not trigger a second network call.

**Live manual smoke test (only when authorized and API works):**

1. Search `JFK → YYZ`, 2026-11-15 through 2026-11-22, 1 adult, CAD.
2. Record the provider-reported solution count, currency, price and observation timestamp; do not fabricate expected prices.
3. Open generated Matrix link; confirm origin, destination, dates, cabin and passengers match.
4. Compare at least one quoted fare with Matrix UI, allowing for cache and fare changes.
5. Exercise zero-result search, wrong key, invalid dates, family pax, non-stop filtering and reverse itinerary.

**Definition of done:** prices and per-result flight details are drawn from a real provider response; link recreates an equivalent Matrix search; no heavy runtime dependencies; error/timeout/rate-limit behavior is explicit; fixture tests pass; one end-to-end authorized live test succeeds.

## 11. Suggested implementation sequence

1. Add `workers/ita-matrix.mjs`, env configuration, validation and pure URL encoder.
2. Save a sanitized fixture from a legitimate live search; build contract tests around it.
3. Add the backend Matrix request and robust multipart response handling.
4. Implement actual segment/airline/stop/duration mapping using fixture-backed response paths. **Do this before displaying flight details.**
5. Wire normalized results into existing `live-search-worker.mjs`; keep all existing providers.
6. Add cache, rate limits, timeouts, diagnostics and fallback behavior.
7. Add calendar fare-search adapter and itinerary-specific links as separate enhancements.

## 12. Reference repositories (source inspection)

- [`YogevKr/itamx`](https://github.com/YogevKr/itamx) — precise multipart transport, request-body schema and `MatrixClient` implementation, `src/itamx/client.py`.
- [`ak2k/flight-cli`](https://github.com/ak2k/flight-cli) — Matrix SPA link encoder, calendar and pinned itinerary links, `src/flight_cli/links.py`; search wire construction in `src/flight_cli/wire.py`.
- [`Filip-Kin/ita-matrix-mcp`](https://github.com/Filip-Kin/ita-matrix-mcp) — independent Node.js implementation of the same undocumented Matrix batch API, suitable for cross-validation; MCP is **not required** in this architecture.

**Compatibility warning:** All cited repositories are independent reverse-engineering efforts. Their endpoint and URL behavior can change without notice. Review applicable provider terms before deploying a public commercial service.
