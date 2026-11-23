# Carrier age guidance

**Status reviewed:** 2026-11-13
**Implementation:** `lib/carrier-eligibility.mjs`  
**Acceptance status:** `work.md` P2 and §17 Passenger ages remain **Partial**.

**Current implementation verification (2026-11-13 04:35 UTC):** TAP additions, mixed-itinerary identity coverage, supported name-only segment resolution, and direction/segment role mapping are tested. `node --test tests/carrier-eligibility.test.mjs` passed 40/40; full `npm test` passed 549/549; isolated production build passed; `npm audit` found zero vulnerabilities. Controlled production Chromium `check:party-partition` verified role mapping and the unknown-segment warning while retaining `unverified`; provider/job calls were intercepted, external traffic blocked, and there were zero browser errors. Local root/health HTTP 200, health `ok`, worker available, queue 0. No live fare. These are implementation checks, not route-specific fare eligibility or seller acceptance evidence.

## Mixed-itinerary carrier identity coverage — 2026-11-13

Carrier guidance now evaluates every outbound and inbound segment. If a segment lacks marketing and/or operating-carrier identity, the advisory names its direction, segment number, and missing role(s), even when other segments have a recognized carrier and linked policy guidance. Supported names supplied on a segment can resolve source-linked policy and retain their operating/marketing role without an IATA code. Each recognized carrier lists the segments where its marketing and operating roles were observed. Malformed codes are disclosed as missing. This prevents a known carrier's rules from appearing to cover an unidentified segment. Name-only provider summaries remain offer-level clues and do not establish identities for individual legs. The overall status stays `unverified`; this change does not infer fare category, ticket rule, or seller acceptance. Regression evidence is maintained in `tests/carrier-eligibility.test.mjs` and `scripts/check-party-partition-ui.mjs`.

## TAP Air Portugal (`TP`)

Added 2026-11-13 from TAP's current English first-party pages. The advisory recognizes `TP` and supported name-only results. TAP states that an accompanying passenger must be 18 or older, may accompany up to seven children ages 2–11 and one baby under 2, and may accompany only three additional children when travelling with a baby. A newborn trip in its first 7 days is not recommended. Babies under 2 may travel on a lap or occupy a seat using an approved car seat; the seat requires a child ticket arranged through TAP's Contact Center. Children ages 2–11 must occupy a seat. TAP says special baby/child prices exist only on certain routes, so no discount or category is assumed.

TAP says unaccompanied-minor tickets cannot be purchased online. Its current page limits connecting service to TAP flights through Lisbon or Porto, without overnight stops and with a maximum 6-hour connection; it does not accept the service on trips involving other airlines. Localized TAP pages differ in some age and companion conditions. The advisory therefore does not determine whether the traveler must use or qualifies for the service. Fare, itinerary, codeshare, cabin, exact guardian, UM availability/fees and seller acceptance remain unverified; status remains `unverified`.

Official references: [TAP babies and children](https://www.flytap.com/en-us/information/babies-and-children), [localized TAP babies and children guidance](https://www.flytap.com/en-il/information/babies-and-children), and [TAP FAQ](https://www.flytap.com/en-us/help/frequently-asked-questions).

## KLM (`KL`)

Added 2026-11-08. KLM is recognized from segment codes and the supported “KLM Royal Dutch Airlines” name. Its public ticket guidance describes infant travel under age 2, child tickets for ages 2–11, regular ticket prices from age 12 on most routes, and a special booking rule when a baby turns 2 during the trip: the child fare applies to all flights and the itinerary cannot be booked online. KLM's family guidance also covers one lap infant per adult (up to two babies with an additional seat), and its unaccompanied-minor page describes mandatory service for ages 5–14 and optional service ages 15–17, with carrier-limited transfers and route-dependent fees.

When actual DOBs are supplied, the date-boundary warning checks ages 2, 5, 12, 13, 14, 15 and 18 on known query/segment dates. A boundary warning identifies a rule transition for follow-up; it does not decide age-category eligibility or price.

The Canadian family page contains inconsistent adjacent-seat age wording: a section says under 13 on Canada routes, while its footnote says 14 and younger. The advisory preserves this discrepancy. Direct page opens returned HTTP 403 during this check; the rules were read from official KLM search-indexed page content, so verify the source pages and specific itinerary directly before relying on them. No KLM fare, seller acceptance, service availability, fee amount, or discount is verified; offer status remains `unverified`.

Official references: [KLM Canada family guidance](https://www.klm.ca/information/kids), [child ticket options](https://www.klm.com/information/ticket-services/tickets-kids), [children travelling alone](https://www.klm.com/information/assistance-health/children-travelling-alone), and [service surcharges](https://www.klm.com/information/legal/fees-paid-options/).

## Emirates (`EK`)

Added 2026-11-08 from Emirates' own current family and ticketing pages. The advisory covers infant under-7-day exceptions, lap or purchased-seat infant handling, children ages 2–11 in their own seats and conditional child-fare language, mandatory unaccompanied service/adult fare for solo ages 5–11, optional paid service described for ages 12–15, and Emirates-operated-flight/connection constraints. DOB boundaries are checked at ages 2, 5, 12, 16 and 18. No published discount percentage or service fee is applied to an offer.

Emirates' pages use both “over 12” for solo travel without service and “12 to 15” for optional service, so exact age-12 treatment is unresolved. Its Canada guidance says an unaccompanied child can travel on Emirates only as far as Toronto because Air Canada will not accept transfer unaccompanied minors from another airline; a parent/guardian must meet the child there. This route-specific statement does not verify any particular interline itinerary. Actual fare, operating carrier, service availability, connections, Canadian documentation, fees and seller acceptance remain `unverified`.

Official references: [unaccompanied minors and conditions](https://www.emirates.com/english/family/planning-your-family-trip/unaccompanied-minors/), [traveling with infants](https://www.emirates.com/us/english/family/on-board/travelling-with-infants/), [child and infant ticketing FAQ](https://www.emirates.com/us/english/help/faq-topics/special-assistance-and-requests/), and [child/infant fare table](https://www.emirates.com/us/english/information/optional-services/).

## British Airways (`BA`)

Added 2026-11-08. The advisory recognizes BA by segment code or supported airline name, and checks supplied dates of birth against known query and segment dates. Its current official pages describe infants as 0–23 months, children as 2–11, young adults as 12–15, lap versus own-seat infant handling, and a seat on/after a second birthday during travel. BA says children under 14 need a companion aged 16+, while ages 14+ may travel alone on BA-operated flights; ages 14–15 require a parent/guardian to make the booking directly and carry consent and guardian-identification documents. Partner-carrier rules may differ.

There is a material conflict in BA's own published booking guidance: the online passenger page says young adults aged 12–15 must include an adult when booking online, while its dedicated travel-alone guidance allows 14–15-year-olds to travel alone subject to the restrictions above. The ticket-age table calls adults “over 16,” so the exact fare category at age 16 is also unclear. The advisory surfaces these conflicts and does not resolve them. No carrier-specific fare discount, seller acceptance, operating flight rule, or eligibility is inferred. `status` remains `unverified`.

Official references: [tickets and travel documents](https://www.britishairways.com/content/en/us/information/family-travel/tickets-and-travel-documents), [children travelling alone](https://hotline.britishairways.com/content/information/travel-assistance/children-travelling-alone.html), [online passenger guidance](https://www.britishairways.com/travel/pop_paxinfo/public/en_gb).

## Air France (`AF`)

Added 2026-11-08. Canadian Air France sources describe infants under age 2, lap-infant discounts of up to 90% where applicable, child-fare seats with an approved car seat or harness, and a child-rate rule if the traveler turns 2 during the trip. They also describe fare-dependent child discounts for ages 2–13 (up to 20% short-haul and 33% medium/long-haul), but these maxima are not applied to offers.

Air France's Kids Solo and accompaniment conditions depend on network and itinerary. Canadian pages describe Kids Solo for ages 4–17 on domestic France networks and 5–17 internationally; the youngest ranges are generally mandatory and older-teen service may be an optional fee. The sources state exceptions for Nouméa and Saint-Pierre-et-Miquelon, and direct customers to Air France for connections involving partner airlines. The code-only advisory reports these distinctions but does not infer which network rule applies, whether the service is available, or the fee for a result. Status stays `unverified`.

Official references: [families and children](https://wwws.airfrance.ca/en/information/passagers/familles-enfants), [Kids Solo](https://wwws.airfrance.ca/en/information/passagers/enfants-voyageant-seuls), [young traveler age bands](https://wwws.airfrance.ca/en/information/passagers/enfants-voyageant-seuls/a-l-aeroport-enregistrement-depart), [booking and connection guidance](https://wwws.airfrance.ca/en/information/passagers/enfants-voyageant-seuls/preparer-voyage), [Kids Solo terms](https://wwws.airfrance.ca/en/information/legal/option-kids-solo).

## Southwest Airlines (`WN`)

Added 2026-11-08 from current Southwest public sources. The guidance covers its 14-day infant minimum and physician-letter exception; one lap child under age 2 per adult; Unaccompanied Minor service for ages 5–11, including nonstop/same-plane and domestic-only limits; and Young Traveler treatment for ages 12–17. Supplied DOBs are checked against query and observed flight dates for age-2, age-5, age-12 and age-18 boundaries, and for the 14-day infant minimum. These are general published rules, not fare acceptance.

Southwest's channel documents conflict on the minimum accompanying age for a lap infant: the direct infant FAQ and agency GDS policy say 18+, while the Contract of Carriage says age 12+. The advisory reports this conflict and directs the traveler to confirm the applicable booking channel. The agency GDS rules additionally say that UMs cannot be ticketed through a GDS, minors booked on a separate PNR need an OSI link to the parent/guardian PNR, and international Young Travelers need a link to an adult guardian age 18+ plus documents arranged by phone. This app does not create OSI remarks or complete that agency handoff. Southwest also reserves discretion to refuse overnight connections for travelers under 18. No fare discount, specific itinerary acceptance, or seller approval is inferred; `status` remains `unverified`.

Official references: [lap child policy](https://support.southwest.com/helpcenter/article/flying-with-infants), [Young Traveler terms](https://support.southwest.com/helpcenter/article/young-travelers-flying-alone), [Contract of Carriage](https://www.southwest.com/swa-resources/pdfs/corporate-commitments/contract-of-carriage.pdf), [agency GDS policy](https://www.southwest.com/about-southwest/terms-and-conditions/gds-policy/).

## United Airlines (`UA`)

The result advisory links United's official [traveling with children](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html) and [unaccompanied minors](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html) pages when `UA` is present as a segment carrier or United is the supported name-only carrier evidence. Rechecked on 2026-11-12: the U.S. customer pages and official [contract of carriage](https://www.united.com/en/us/fly/contract-of-carriage.html) still exposed only a JavaScript-required shell in the available viewer; the public booking page linked the policy pages but did not reproduce their terms. United Vacations package pages and separate partner pages were excluded because they do not establish United Airlines fare, infant, or unaccompanied-minor rules. Detailed airline age bands, infant conditions, route restrictions, charges, and partner rules remain unverified. The app links the authoritative customer pages, does not assume thresholds, and keeps eligibility `unverified`. See the [2026-11-12 access recheck](united-policy-access-recheck-2026-11-12.md) and [earlier recheck](united-policy-access-recheck-2026-11-08.md).

The application provides source-linked, date-aware policy guidance for selected carriers. This is an advisory layer: it does not determine whether a specific fare, marketing/operating-carrier combination, codeshare, or seller will accept a traveler, and it does not reprice an offer. The UI must retain an `unverified` eligibility verdict until the relevant offer and seller confirm the actual party.

## Air Canada (`AC`)

The current guidance uses Air Canada's [Canadian children and infant page](https://www.aircanada.com/ch/en/ado/home/plan/special-assistance/travelling-with-children.html) and [children travelling alone page](https://www.aircanada.com/us/en/ado/home/plan/special-assistance/unaccompanied-minor.html). It summarizes the different domestic, Canada–U.S., and other international infant/child fare rules already published on the children page. It now also covers accompaniment and young-solo constraints: children under 8 must travel with an adjacent passenger age 16+ in the same cabin; the UM service is mandatory for solo ages 8–11 and optional for ages 12–17; and the service is limited to eligible nonstop Air Canada, Air Canada Rouge, or Jazz-operated Air Canada Express flights, with connecting and codeshare flights excluded. A service fee applies but is not estimated or added to any fare. Adults accompanying children under 12 must be at least 16. A supplied DOB crossing age 8 across searched dates triggers the existing boundary warning.

These general terms do not decide the specific fare's eligibility, cabin/seat arrangement, UM availability, operating-carrier acceptance, codeshare rules, or total service charges. All remain `unverified` until confirmed with the carrier or seller.

## Qatar Airways (`QR`)

Added on 2026-11-07. Guidance identifies Qatar Airways by carrier code or supported airline name and covers the published infant/child and young-solo rules: the under-8-day medical or compassionate exception, infant travel from 8 days to under 2, one lap infant per adult, conditions for a second infant, own seats and child fares for ages 2–11, unaccompanied-minor service for ages 5–11, optional young-passenger service for ages 12–15 in the stated circumstances, and stricter local or partner-carrier rules. When an actual date of birth is supplied, the under-8-day notice is evaluated against the query and known observed segment dates. No age is inferred.

Official references:

- [Infant and child fares](https://www.qatarairways.com/en-us/family/child-fares-baggage.html)
- [Young solo traveler guidance](https://www.qatarairways.com/en-no/family/child-fares-baggage.html)
- [Children and infants procedures for travel partners](https://www.qatarairways.com/tradeportal/en/specialservices/Children-and-Infants.html)

## Verification and limits

- `node --test tests/carrier-eligibility.test.mjs`: 27/27 passed after the Air France addition, including AF name-only recognition, sources and exact DOB age-2 and age-15 transitions.
- Full `npm test`: 491/491 passed (86.8 seconds).
- `npm run build`: passed.
- `npm audit --audit-level=low`: zero vulnerabilities.
- Rebuilt-loopback `npm run check:carrier-guidance`: BA booking conflict and AF network-dependent rules rendered with official links; eligibility remained `unverified`; provider calls were intercepted; zero browser errors.
- No live fare, seller, booking, or reservation request was made for this change.

This does not close P2. Broader carrier coverage, current fare-specific eligibility, operating/codeshare restrictions, age-based price validation, and seller acceptance remain open. See [HANDOFF.md](../HANDOFF.md), [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md), and [`work.md`](../work.md) for the full acceptance gaps.
