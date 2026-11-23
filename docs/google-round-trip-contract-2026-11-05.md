# Google native round-trip contract observation

Observed 2026-11-05. The native operation is now wired and enabled locally for supported economy/non-infant round trips. Its bounded coverage and remaining live gates are recorded below.

## Authorized live evidence

Used the existing saved calendar's actual party and dates, choosing YHZ→IST (the route previously reported by the user) from its Europe destination. No invented ages, DOBs or reduced party were submitted. The selected pair was departure 2026-12-18, return 2026-12-28. The source's current form exposes Children aged 2–11 and distinct seated/lap infant controls; the saved party translated to five source adult-fare passengers. That translation does not assert five legal adults or replace the canonical family party.

Native form navigation reached outbound results, returning flights, then the final itinerary/booking-options page. Final page stated Round trip, Economy, 5 passengers, Lowest total price, required taxes/fees for 5 adults. Its currency control explicitly read `Currency CAD`.

The complete selected journey connected YHZ→YUL→LHR→IST and IST→FRA→YUL→YHZ, three segments each way. No U.S. connections or WS marketing segments were selected. Final source offers were CAD 26,697 (call Air Canada), CAD 27,106 (Ovago online) and CAD 28,155 (AranGrant online). The phone-only minimum must not be described as an immediately bookable online fare. No seller button, checkout, reservation or purchase was executed; seller/carrier acceptance and final amounts remain unverified. Quotes are dated observations and must not be reused as fresh inventory.

Private captures remain under ignored `.cache/google-discovery/` with directory mode 0700 and file mode 0600. No credentials, DOBs, private captures, opaque source references or full deep links are copied into documentation/tests. The read-only probes repeated this exact route/date pair while inspecting the native UI. Browser traffic is outside shared `fetchSource` counters; those counters cannot establish the probe's total HTTP or billing units.

## Observed contract used by `lib/google-round-trip.mjs`

- `GetShoppingResults` is an incremental framed RPC stream. An initial departing-flight list contains a suggested return price but does **not** establish exact return-flight identities. It is never sufficient for normalization as a complete round trip.
- `GetBookingResults` final payload has seller quotes at `[1][0]` and the two fully selected directions at `[1][5][0]`.
- Each direction identifies its airport-local dates/times, duration and complete segment array. In the observed segment schema, `[15]` holds alternative codeshare identities, `[16]` is cabin (1 = observed economy), `[20]`/`[21]` are departure/arrival dates and `[22]` identifies the marketing carrier/flight. `[13]` differs on economy flights and is **not** used as cabin evidence.
- Missing zero time components occur in the observed schema: `[17]` means 17:00; `[null,55]` means 00:55. Missing whole date/time arrays are rejected.
- Seller `[3]` flight references must match each selected segment's marketing identity or an explicitly observed codeshare. Seller `[7][0][1]` is the source's complete group quote for the selected return; no multiplication or addition of unrelated one-way amounts occurs.
- Observed seller fulfillment values are 2 = phone (with phone evidence) and 0 = online (with the Google travel click endpoint). These are retained distinctly. Unknown modes are excluded.
- Explicit page party/currency/group-total evidence must match the actual query. The deep link must be a Google booking path with the observed exact-query and selected-flight parameters, and CAD; unrelated tracking parameters are removed.
- Both directions are converted with the licensed airport IANA directory. Source segment and direction durations must agree with validated UTC instants. Party fare-category transitions are checked across every observed local flight date, including the return arrival date.

The live captured response passed normalization for three sellers with three segments each direction and directory-validated chronology. No quote was persisted as a current app result. Fixtures are independently constructed synthetic contract data, not copied private captures.

## Implemented operation and current evidence

`lib/google-native.mjs` now performs the observed native flow. It is wired through capability preflight, dispatch, calendar/checkpoints, worker and exact-flight refresh. Set `TRAVEL_GOOGLE_ROUND_TRIP=1` to enable it; the local environment is enabled. The older installed one-way operation remains separate.

The native query has a 45-second overall deadline, a pre-dispatch limit of 12 native fare RPCs and at most three eligible outbound selections. Each direction examines at most 80 returned rows, stopping at the first full matching return quote. Direction updates can be accepted from complete streamed frames after UTC/route/date/filter validation; no partial departing list becomes a canonical return price. The final selected-trip seller response must be complete. Browser response capture precedes app navigation so protocol-resource retirement cannot discard the quote. Refusals, human checks and cancellation stop the operation; no source access challenge is bypassed.

All calendar filters must reach selection as well as the final shared filter pass. Live worker diagnosis caught their omission and added a boundary regression. Fresh original OurAirports country records now reduce Wikidata traffic; stale/conflicting records do not establish geographic evidence. Unknown empty native frames require an explicit source no-results statement before being counted as a checked no-match query.

Further live observations used the same actual saved party without invented ages or party reduction. Dec 19–30 native search returned four complete CAD seller quotes, lowest observed CAD 16,212, three segments in each direction. A real regional all-compatible worker used four logical slots across two exact pairs: Ignav returned HTTP 200 twice; Google quoted one pair and timed out on another. After filter propagation was fixed, a two-slot Google regional worker returned a matching CAD 19,356 group quote for Dec 18–28. The source's other empty result was subsequently made subject to the stricter explicit-no-results guard. These are time-specific observations; the IST subset does not establish exhaustive European airport coverage.

Controlled same-flight refresh opens the original booking page and rejects replacements. A live direct refresh of the exact observed Google booking page returned four fresh seller quotes matching the original flights and saved party; the source reported a changed price. This confirms a refreshed Google observation for that itinerary, while seller-site availability, final price, and carrier eligibility remain unverified. The earlier fresh-list refresh returned no match and is retained as historical evidence.

## Remaining release gates

- Obtain approved partner access for the Skyscanner, Expedia and NDC live gates; verify the remaining Matrix/Omkar contracts before relaxing their guards.
- Verify named-seller handoff, availability, final price and carrier eligibility through documented seller information without submitting an order. No external seller continuation has been executed by this adapter.
- Under-12 source pricing and identified parties have controlled contract/browser coverage, but this actual-party live evidence contains source adult-fare categories only. Infants, other cabins and carrier-specific acceptance remain unsupported/unverified as applicable.
- Full integration-plan completion remains unproven; retain each provider/party release gate independently.

## Final verification for this implementation increment

`npm test`: 377/377. Production build passed; dependency audit found zero vulnerabilities. Post-deploy Chromium confirmed the Google compatibility preview and automatic-region/identified-party/night-range submission, with supplier/job boundaries intercepted. The manual fallback regression passed. Website is running at `http://127.0.0.1:3000`; durable worker is live. These checks establish the implemented increment, not the remaining full-plan gates above.
