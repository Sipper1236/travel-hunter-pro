# Expedia Flight Pricing Integration — Omkar + Selenium

**Status:** Historical implementation proposal; current project status is tracked in [`handoff.md`](handoff.md), [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md), and [`work.md`](work.md) §17. The Selenium proposal remains unimplemented. The Omkar one-way adapter is now implemented in `lib/omkar-expedia.mjs` and wired through `lib/providers.mjs`; it requires a user-owned `OMKAR_API_KEY` and has no current live result verified in this workspace. The proposed Selenium worker remains unimplemented.  
**Target:** Current Next.js app and durable worker in `scripts/search-worker.mjs` / `scripts/flight-job-runner.mjs`.  
**Priority:** Correct, attributable, recently retrieved Expedia fares over low dependency count.  
**Providers:** Omkar one-way API (implemented, credential-gated); Expedia Flight Listings (implemented, partner-credential-gated); Expedia search URL handoff (not a quote); Python/Selenium Expedia collection (not implemented).

## 1. Goals and boundaries

Build a flight-search provider that returns real flight offers, prices, itinerary segments, fare tiers, and a useful Expedia link. The app should support one-way and round-trip searches, passenger mixes, cabin selection, and a default departure airport of **YHZ**, without hardcoded destination lists or prerecorded fares.

**Do not** display a made-up fare, calculate a round-trip quote by summing separate one-way quotes, treat the presence of a search URL as proof of availability, or represent the quoted one-adult amount as a family total. Every price must carry its source, currency, quotation scope, and retrieval timestamp.

**Known limitations:** Omkar publicly documents a **one-way** flight endpoint, with airport code, departure date and cabin fields; its public request parameters do **not** document child/youth counts or a native round-trip endpoint. Selenium requires current Expedia selectors and can be blocked or encounter consent/login pages; an older GitHub project is a reference, **not a maintained drop-in Expedia API**. Validate the site's terms and applicable requirements before running automated collection at scale. Both prices and booking URLs may expire or change. The current app has no Selenium Expedia path, no Omkar key/live check, and no Expedia Flight Listings live quote recheck.

Reference sources (verified October 29, 2026):
- Omkar: https://github.com/omkarcloud/expedia-scraper
- Selenium reference: https://github.com/danielsaed/expedia-flight-scraper-selenium

## 2. Original proposed architecture

This section is a design sketch, not the shipped route map. Current searches use `POST /api/search` or durable `POST /api/search/jobs`; Omkar and Expedia Travel Redirect are provider modules routed through the shared flight worker. Do not create the proposed `/api/flights/search` endpoint unless the actual app architecture changes.

```text
Frontend search (origin default YHZ; destination not hardcoded)
  -> POST /api/flights/search (Node.js)
  -> validation + deduplicated search/cache + provider router
      |-- Omkar adapter: direct authenticated HTTPS (one-way, supported params)
      `-- Selenium worker: separate Python service/process (round-trip; fallback)
  -> normalize + validate pricing scope + deduplicate offers
  -> results, provenance, status, search and booking URLs
```

Keep the Python worker isolated so browser crashes, blocked pages, and long page loads do not affect the Node server. The router must preserve existing live-search worker contracts and the app's packages/hotels/separate-ticket outputs.

Proposed files (adapt naming to your existing repository):

```text
server/
  providers/expedia/omkar.mjs
  providers/expedia/url.mjs
  providers/expedia/normalize.mjs
  providers/expedia/router.mjs
workers/
  live-search-worker.mjs       # integrate, do not replace its other modes
  expedia-selenium/
    app.py                     # simple local HTTP interface or JSON-lines worker
    scrape.py                  # selectors and extraction
    requirements.txt
fixtures/expedia/
  omkar-oneway.json
  selenium-roundtrip.json
  expedia-empty.html          # redacted, if permitted to retain
```

## 3. Public API contract

`POST /api/flights/search`

```json
{
  "origin": "YHZ",
  "destination": "LAX",
  "tripType": "round-trip",
  "departureDate": "2026-11-12",
  "returnDate": "2026-11-19",
  "cabin": "economy",
  "currency": "CAD",
  "passengers": {
    "adults": 1,
    "youths": 0,
    "children": [],
    "infantsInLap": 0,
    "infantsInSeat": 0
  }
}
```

Children should retain **ages at departure** (e.g. `children: [8, 12]`), and youth ages should be retained as well if the UI distinguishes youths. Do not assume a provider shares the app's youth age boundaries. Date/age validation must be performed against the airline/provider rules. Preserve passenger counts and exact ages through every worker request even if a given provider cannot accept them.

Response shape (example values below are **schema illustration, not a retrieved price**):

```json
{
  "searchId": "request-id",
  "status": "complete",
  "offers": [
    {
      "id": "expedia:provider:opaque-id",
      "source": "selenium",
      "tripType": "round-trip",
      "quoteScope": "all-passengers-round-trip",
      "passengersPriced": { "adults": 1, "youths": 0, "children": [], "infantsInLap": 0, "infantsInSeat": 0 },
      "price": { "amount": 0, "currency": "CAD", "includesTaxesAndFees": null },
      "outbound": { "segments": [], "stops": null, "durationMinutes": null },
      "inbound": { "segments": [], "stops": null, "durationMinutes": null },
      "fareName": "Economy",
      "baggage": [],
      "bookingUrl": null,
      "searchUrl": "https://www.expedia.ca/Flights-Search?...",
      "retrievedAt": "2026-10-29T00:00:00.000Z",
      "availability": "unverified",
      "warnings": []
    }
  ],
  "diagnostics": []
}
```

`price.amount: 0` above is a placeholder **only in this schema example**. Do not emit it as an actual result. In production, omit invalid/unpriced offers. Use `status: partial` if some providers fail and at least one valid result is returned; `unavailable` if no reliable quote can be obtained. Distinguish no flights from provider failure.

## 4. Omkar adapter — actual documented request

Documented base: `https://expedia-scraper.omkar.cloud`  
Endpoint: `GET /expedia/flights/one-way`  
Auth header: `API-Key`  
Documented query: `departure_airport_code`, `arrival_airport_code`, `departure_date` (YYYY-MM-DD), `cabin_class` (`coach`, `premium_economy`, `business`, `first`).

```js
// server/providers/expedia/omkar.mjs (Node 20+)
const API = 'https://expedia-scraper.omkar.cloud/expedia/flights/one-way';

export async function searchOmkarOneWay(request) {
  const key = process.env.OMKAR_API_KEY;
  if (!key) throw new Error('OMKAR_API_KEY is not configured');

  const url = new URL(API);
  url.searchParams.set('departure_airport_code', request.origin);
  url.searchParams.set('arrival_airport_code', request.destination);
  url.searchParams.set('departure_date', request.departureDate);
  url.searchParams.set('cabin_class', {
    economy: 'coach', premium_economy: 'premium_economy',
    business: 'business', first: 'first'
  }[request.cabin] ?? 'coach');

  const response = await fetch(url, {
    headers: { 'API-Key': key, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) {
    // Never include the API key or response body in client-visible errors.
    const error = new Error(`Omkar HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const body = await response.json();
  if (!Array.isArray(body?.flights)) throw new Error('Unexpected Omkar schema');
  return body;
}
```

For Omkar, expose only **one-adult/one-way** prices where the returned fare explicitly says that is its scope. The examples show `fare_type: "One way per traveler"` and `price_detail`; check those fields, do not multiply displayed fares by passenger count. If `passengers` is not exactly one adult, either label results as **per traveler / not a party total** or prefer Selenium for a complete passenger quote. Omkar `booking_url` may correspond to a fare tier and must be attached to that fare tier, not copied blindly to all flights.

**Currency**: Omkar's sample has `$948` and does not document a currency input. Never infer CAD just because the frontend runs on `.ca`. Use an explicit provider currency field if present; otherwise mark currency unknown and exclude the offer from CAD-price comparison until verified. No silent FX conversion.

**Cost/rate limiting:** The README contradicts itself about free monthly requests (100 vs 5,000 in repository metadata). Treat the authenticated account/dashboard as authoritative. Handle HTTP 401 (configuration failure), 429 (rate limited), 5xx (retry with bounded backoff), request timeout, malformed JSON, empty results, and partially populated offers.

### Normalize Omkar offers

Map each `flights[]` entry and each `fare_options[]` into separate offers, preserving raw provider IDs. A typical response contains: `offer_id`, `starting_price`, `fare_type`, `stop_count`, `airlines[]`, `itineraries[].segments[]`, `fare_options[].fare_name`, `.display_price`, `.price_detail`, `.inclusions`, and `.booking_url`.

Safe price parsing requires explicit currency detection:

```js
export function parseMoney(display, explicitCurrency) {
  if (typeof display !== 'string') return null;
  const match = display.trim().match(/^([^\d-]*)(-?[\d.,]+)$/);
  if (!match) return null;
  const currency = explicitCurrency ?? null; // do not guess from '$'
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return null;
  const value = match[2];
  // Only parse unambiguous US/Canadian grouping/decimal notation here.
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value.replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? { amount, currency } : null;
}
```

Retain unparsed displayed price for diagnostics; do **not** present it as verified CAD. Preserve segment times as strings when time zones/dates are not provided; avoid inventing ISO timestamps or journey durations.

## 5. Selenium worker — true round-trip and fallback

The reference repository uses Python, Selenium, `undetected-chromedriver` and pandas to export Expedia pricing rows for analysis. It is not a ready-made service and its selectors may no longer work. Start with its extraction patterns, then implement a worker against current Expedia result markup, instrumented with fixtures and screenshots for debugging (redacting personal data).

Dependencies (start minimal, add only when needed):

```txt
selenium>=4,<5
```

Install Chrome/Chromium and a compatible driver via Selenium Manager or pinned container images. `undetected-chromedriver` is not required for the initial architecture and is not a guarantee of access. Do not try to bypass CAPTCHAs or access controls; report `blocked` and fail gracefully.

Worker contract: input JSON on stdin; JSON result on stdout; diagnostics to stderr. Alternatively, run a private local HTTP service with equivalent JSON schema and a secret/token if exposed outside localhost.

```json
{
  "origin": "YHZ",
  "destination": "LAX",
  "departureDate": "2026-11-12",
  "returnDate": "2026-11-19",
  "tripType": "round-trip",
  "cabin": "economy",
  "passengers": { "adults": 1, "youths": 0, "children": [], "infantsInLap": 0, "infantsInSeat": 0 },
  "searchUrl": "https://www.expedia.ca/Flights-Search?..."
}
```

Worker steps:

1. Open a valid Expedia search URL for the requested criteria, or fill the search UI if deep links redirect.
2. Confirm the **rendered** origin, destination, dates, trip type, cabin and passenger ages/counts. If these are not faithfully represented, return `unsupported_passengers` or `invalid_search` rather than a false quote.
3. Explicitly wait for flight result cards and completed fare/return selection, not just `document.readyState`. Handle localized currency, consent prompts, no-results, and rate limits separately.
4. For **round trip**, inspect/select both outbound and inbound legs and obtain the final combined offer price; ensure the displayed scope is total for the selected party and includes disclosed mandatory taxes/fees. Don't treat an outbound card's headline price as a verified total.
5. Capture airline, flight numbers, airports, departure/arrival local times and dates, stops, durations, fare tier, baggage, refundable/change terms, quote scope, source, collected timestamp, and final itinerary URL if available.
6. Verify the chosen itinerary and fare remain the same at the final review/selection page. Never automate purchase, payment, account login, or CAPTCHA solving.
7. If final total or currency is not reliably available, return `unpriced` and a search link, not an invented number.

Suggested Python skeleton (the **DOM selectors must be developed against current Expedia HTML**):

```python
# workers/expedia-selenium/scrape.py
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait


def search_expedia(payload):
    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')  # only if necessary inside an isolated container
    driver = webdriver.Chrome(options=options)
    try:
        driver.set_page_load_timeout(45)
        driver.get(payload['searchUrl'])
        wait = WebDriverWait(driver, 35)
        # TODO: validate rendered search criteria.
        # TODO: wait for results; differentiate blocked/empty/error states.
        # TODO: choose outbound and inbound (round-trip).
        # TODO: extract combined total + currency + passenger scope.
        # TODO: normalize chosen itinerary and links.
        raise NotImplementedError('Implement and fixture-test current Expedia selectors')
    finally:
        driver.quit()
```

Build the worker's first working selector tests using a deliberately small set of authorized manual test searches. Avoid brittle CSS class hashes. Prefer accessible labels, stable attributes, and explicit waits. Cap simultaneous browser sessions (start with 1–2 per machine). Set a hard deadline (~90s), memory limit, and explicit browser cleanup.

## 6. Provider routing and quote rules

| Request | Primary | Fallback | Price rule |
|---|---|---|---|
| One-way, 1 adult | Omkar | Selenium | Omkar per-traveler fare only when currency known |
| One-way, mixed ages or multiple travelers | Selenium | Omkar informational only | Never label Omkar per-traveler as group total |
| Round-trip, any passenger mix | Selenium | Search URL (optionally Omkar per-leg indicative only) | Only verified combined round-trip quotes qualify |
| Provider blocked/timeout | Other capable provider | Search link | No invented price |

If both providers return *independently comparable* offers, deduplicate using itinerary segment sequence + cabin + baggage conditions + passenger scope and compare **total payable** amounts in the same currency. Never deduplicate dissimilar fares solely on airline and departure time. Sort only offers with valid comparable prices; put incomplete offers in an “Unable to price” group.

Cache key: hash canonical request fields (route, dates, cabin, passenger ages/counts, locale, currency, trip type, provider). Suggested TTL is **5–10 minutes** for successful results (configurable), ~30–60 seconds for known empty searches; do not cache auth failures, CAPTCHA pages, or partial malformed data. This is a performance setting, not a guarantee of fare validity. Add an in-flight promise map to prevent duplicate simultaneous provider requests.

Return provider diagnostics such as `success`, `no_results`, `unsupported_passengers`, `rate_limited`, `blocked`, `timeout`, `schema_changed`, `unpriced`, and `error`. Surface a truthful error message instead of silently swapping priced and unpriced sources.

## 7. Expedia search URL generation

The supplied URL uses `/Flights-Search` with `leg1`, `leg2`, `d1`, `d2`, `options`, `passengers`. Its format is **unofficial and subject to change**. Maintain a URL builder but browser-test that Expedia actually retains every requested parameter. Prefer provider-returned booking URLs for precise fare selection; a generic search link is not an itinerary booking link.

```js
// server/providers/expedia/url.mjs
function humanDate(iso) {
  const [y,m,d] = iso.split('-');
  if (![y,m,d].every(Boolean)) throw new Error('Invalid date');
  return `${d}/${m}/${y}`;
}

export function expediaSearchUrl({ origin, destination, departureDate, returnDate,
  tripType = 'round-trip', passengers = { adults: 1 }, cabin = 'economy' }) {
  // Minimal airport labels; validate that the site accepts these before production.
  const airport = (code) => `${code} (${code})`;
  const leg = (from, to, date) =>
    `from:${airport(from)},to:${airport(to)},departure:${humanDate(date)}TANYT,fromType:AIRPORT,toType:AIRPORT`;
  const u = new URL('https://www.expedia.ca/Flights-Search');
  u.searchParams.set('flight-type', 'on');
  u.searchParams.set('mode', 'search');
  u.searchParams.set('trip', tripType === 'round-trip' ? 'roundtrip' : 'oneway');
  u.searchParams.set('leg1', leg(origin, destination, departureDate));
  if (tripType === 'round-trip' && returnDate) {
    u.searchParams.set('leg2', leg(destination, origin, returnDate));
    u.searchParams.set('toDate', humanDate(returnDate));
    u.searchParams.set('d2', returnDate);
  }
  u.searchParams.set('options', `cabinclass:${cabin}`);
  u.searchParams.set('fromDate', humanDate(departureDate));
  u.searchParams.set('d1', departureDate);
  u.searchParams.set('passengers', `adults:${passengers.adults ?? 1},infantinlap:${(passengers.infantsInLap ?? 0) > 0 ? 'Y' : 'N'}`);
  return u.toString();
}
```

**Important:** The above minimalist `YHZ (YHZ)` labels are a candidate, *not verified* as equivalent to full Expedia location names. The original URL has full labels like `Halifax, NS (YHZ-Stanfield Intl.)`. In production, use provider-verified airport labels/IDs and confirm round-trip, cabin, passenger counts and dates after redirect. Since this builder only encodes adult count and an infant-in-lap flag, it **must not** be considered safe for mixed-age passenger searches without extending and testing Expedia's actual format/UI.

## 8. Node-to-Selenium orchestration

For production, prefer a long-running restricted Python worker behind an internal endpoint or a bounded job queue to avoid browser initialization per web request. For MVP, a child process reading JSON on stdin is adequate. Use `spawn` with an argument array (not shell interpolation), explicit timeout, bounded output size, process cleanup and response validation. Never put user input into a shell string.

Example orchestration pseudocode:

```js
const req = validateSearch(body);
const tasks = req.tripType === 'round-trip'
  ? [searchSelenium(req)]
  : req.passengers.adults === 1 && totalPassengers(req.passengers) === 1
    ? [searchOmkarOneWay(req).catch(() => searchSelenium(req))]
    : [searchSelenium(req)];
const results = await Promise.allSettled(tasks);
const offers = normalizeAndValidate(results, req);
return { status: offers.length ? 'complete' : 'unavailable', offers,
         diagnostics: summarizeProviderStates(results) };
```

This is illustrative orchestration, **not runnable as-is**. Keep individual provider failures available to the diagnostics list; do not accidentally suppress or mislabel them with `.catch()`.

## 9. UI, safety and production operations

- Display total party price only where verified. Show currency clearly (CAD, USD, etc.) and scope (“per traveler” / “all passengers, round trip”).
- Show “Last checked” timestamp, actual origin/destination dates, airline, stops, baggage conditions, taxes/fees if known, and source. Display “Price may change at checkout.”
- Prefer fare-specific `bookingUrl`. Otherwise show “View search on Expedia” linking to `searchUrl`; do not label it “Book this exact fare.”
- Validate redirect URLs to approved Expedia hostnames and HTTPS. Protect credentials server-side. No secrets in client JSON, logs, screenshots or repository.
- Validate IATA codes (`^[A-Z]{3}$`), ISO dates, return after departure, bounded duration, reasonable passenger counts and age validity. Deny arbitrary client-supplied scrape URLs to prevent SSRF.
- Use per-user and global rate limiting, request coalescing, cost budgets, retry with jitter only for transient failures, and a circuit breaker when blocked or rate limited.
- Respect Expedia's and Omkar's contractual requirements, access limits and acceptable use policies. Do not attempt to defeat access controls.
- Track success rate by provider, median/p95 latency, unpriced ratio, currency-unknown ratio, quote-to-landing discrepancy, and 401/429/blocked rates.

## 10. Test plan / acceptance criteria

1. **Omkar smoke test:** with valid API key, test YHZ → LAX, one adult, one way, a future departure, economy; verify a nonempty structured response or a legitimate no-results response. Save a sanitized real fixture.
2. **Currency validity:** `$948` without a provider currency must not be presented as `CAD 948`. Reject ambiguous numerical formats.
3. **Round-trip browser test:** YHZ ↔ LAX, Nov 12–19 2026, one adult. Confirm the search form and both legs, final combined price and currency; save a redacted fixture.
4. **Mixed passengers:** 2 adults, 1 youth, 1 child age 8, 1 lap infant. Confirm Expedia actually reflects these categories or return a clear unsupported status; never reuse the one-adult quote.
5. **Fallback:** simulate Omkar timeout, 401, 429, malformed response; confirm Selenium only runs where capable and no fake price is shown.
6. **Browser failures:** test no-results, consent page, stale selectors, load timeout, interrupted sessions, blocked/CAPTCHA. No hanging workers or unhandled crashes.
7. **Links:** test one-way and round-trip URLs via browser; confirm both dates, cabin, airports and passengers after landing. Verify fare-specific booking URLs are still valid where possible.
8. **Price consistency:** inspect at least 20 searches with different routes/dates/passenger mixes and record the difference between collected and landing-page prices. Mark failed comparisons, not fabricated success.
9. **Worker compatibility:** existing `flights`, `hotels`, `packages`, `separateTicketSegments`, `diagnostics`, and other app features remain intact; default YHZ, dynamic destinations, youth/child logic maintained.
10. **Performance:** one concurrent and multiple concurrent searches; enforce rate limits, browser concurrency, bounded response time, cache isolation, and secret-safe logs.

**Release gate:** Do not call the integration production-ready until the Selenium selectors have been manually validated on the current Expedia site and Omkar has been tested with real credentials, pricing currency has been confirmed, and round-trip totals have been independently checked.

## 11. Implementation order

1. Add normalized schema and validation to Node, preserving the current live-search worker response contract.
2. Add Omkar adapter and capture real fixtures. Implement currency/scope-safe fare normalization.
3. Add local Expedia URL builder with browser verification; maintain original full airport labels when available.
4. Add Selenium worker, initial one-way extraction, then full round-trip itinerary/fare selection.
5. Implement provider router, cache, timeouts, diagnostics, concurrency control, and deduplication.
6. Connect flight results UI and explicit price-scope labels.
7. Run acceptance suite, deploy isolated browser worker, monitor and maintain selectors.

## 12. Open questions to resolve during implementation

- Does Omkar expose a reliable three-letter currency code for each offer or a locale setting absent from its README?
- Can its API search more than one adult or round-trip via another **documented/contracted** endpoint? Do not assume so.
- Which Expedia URL/location identifier format remains stable for every airport and passenger mix?
- Are the Selenium worker's scraped amounts final taxes-included party totals after return selection, or only partial previews?
- What reuse and automation rights apply to the selected sources for the travel app's deployment?

These gaps require real provider responses, live browser tests, and/or provider confirmation. This document does not claim those tests have already passed.
