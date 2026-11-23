import { ageOnDate } from './travelers.mjs';

const AIR_CANADA_CHILDREN_URL = 'https://www.aircanada.com/ch/en/ado/home/plan/special-assistance/travelling-with-children.html';
const AIR_CANADA_UNACCOMPANIED_URL = 'https://www.aircanada.com/us/en/ado/home/plan/special-assistance/unaccompanied-minor.html';
const WESTJET_DOMESTIC_TARIFF_URL = 'https://www.westjet.com/content/dam/westjet/documents/en/tariffs/WSD_EN_FE_2026-06-18.pdf';
const WESTJET_INTERNATIONAL_TARIFF_URL = 'https://www.westjet.com/content/dam/westjet/documents/en/tariffs/WSI_EN_FE_2026-06-18.pdf';
const DELTA_CHILDREN_URL = 'https://www.delta.com/ca/en/children-infant-travel/overview';
const DELTA_CONTRACT_URL = 'https://www.delta.com/us/en/legal/contract-of-carriage-igr';
const AMERICAN_CHILDREN_URL = 'https://www.aa.com/web/i18n/travel-info/special-assistance/traveling-children.html';
const AMERICAN_UNACCOMPANIED_URL = 'https://www.aa.com/pubcontent/en_US/travel-info/special-assistance/unaccompanied-minors.html';
const AMERICAN_SERVICE_PLAN_URL = 'https://www.aa.com/web/i18n/customer-service/support/customer-service-plan.html';
const PORTER_CHILDREN_URL = 'https://www.flyporter.com/en-ca/travel-information/children-infants/booking';
const PORTER_UNACCOMPANIED_URL = 'https://www.flyporter.com/en-ca/travel-information/children-infants/children-travelling-alone';
const PORTER_CHILDREN_FAQ_URL = 'https://www.flyporter.com/en-us/customer-service/faq/children-infants';
const AIR_TRANSAT_CHILDREN_URL = 'https://www.airtransat.com/en-CA/travel-information/families-and-children/travelling-with-children';
const AIR_TRANSAT_UNACCOMPANIED_URL = 'https://www.airtransat.com/en-CA/travel-information/families-and-children/unaccompanied-minors';
const FLAIR_TARIFFS_URL = 'https://www.flyflair.com/tariffs';
const FLAIR_DOMESTIC_TARIFF_URL = 'https://assets.ctfassets.net/w0vm39jo1zxb/1g5N6y60MbcdTJeZ24iUlB/8b8327de57089f2b5372f90a4c435229/Rev_15_Flair_Domestic_Tariff_2026.06.01.pdf';
const FLAIR_INTERNATIONAL_TARIFF_URL = 'https://assets.ctfassets.net/w0vm39jo1zxb/3PcQEGe95opez5AV5X7d1/ecbf4bd07654dd0b5da1cdddca8573e4/Flair_Airlines_Ltd._-_International_Tariff_2026-06-01.pdf';
const LUFTHANSA_CHILDREN_URL = 'https://www.lufthansa.com/ca/en/prepare-for-your-trip/travelling-with-children/planning-with-kids';
const LUFTHANSA_CONDITIONS_URL = 'https://www.lufthansa.com/ca/en/terms-and-conditions-lh';
const QATAR_CHILDREN_URL = 'https://www.qatarairways.com/en-us/family/child-fares-baggage.html';
const QATAR_YOUNG_TRAVELER_URL = 'https://www.qatarairways.com/en-no/family/child-fares-baggage.html';
const QATAR_TRADE_CHILDREN_URL = 'https://www.qatarairways.com/tradeportal/en/specialservices/Children-and-Infants.html';
const BRITISH_AIRWAYS_CHILDREN_URL = 'https://www.britishairways.com/content/en/us/information/family-travel/tickets-and-travel-documents';
const BRITISH_AIRWAYS_SOLO_URL = 'https://hotline.britishairways.com/content/information/travel-assistance/children-travelling-alone.html';
const BRITISH_AIRWAYS_BOOKING_URL = 'https://www.britishairways.com/travel/pop_paxinfo/public/en_gb';
const AIR_FRANCE_FAMILY_URL = 'https://wwws.airfrance.ca/en/information/passagers/familles-enfants';
const AIR_FRANCE_SOLO_URL = 'https://wwws.airfrance.ca/en/information/passagers/enfants-voyageant-seuls';
const AIR_FRANCE_SOLO_AIRPORT_URL = 'https://wwws.airfrance.ca/en/information/passagers/enfants-voyageant-seuls/a-l-aeroport-enregistrement-depart';
const AIR_FRANCE_SOLO_PREPARE_URL = 'https://wwws.airfrance.ca/en/information/passagers/enfants-voyageant-seuls/preparer-voyage';
const AIR_FRANCE_SOLO_TERMS_URL = 'https://wwws.airfrance.ca/en/information/legal/option-kids-solo';
const SOUTHWEST_INFANT_URL = 'https://support.southwest.com/helpcenter/article/flying-with-infants';
const SOUTHWEST_YOUNG_TRAVELERS_URL = 'https://support.southwest.com/helpcenter/article/young-travelers-flying-alone';
const SOUTHWEST_CONTRACT_URL = 'https://www.southwest.com/swa-resources/pdfs/corporate-commitments/contract-of-carriage.pdf';
const SOUTHWEST_GDS_POLICY_URL = 'https://www.southwest.com/about-southwest/terms-and-conditions/gds-policy/';
const UNITED_CHILDREN_URL = 'https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html';
const UNITED_UNACCOMPANIED_URL = 'https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html';
const KLM_CHILDREN_URL = 'https://www.klm.ca/information/kids';
const KLM_TICKETS_URL = 'https://www.klm.com/information/ticket-services/tickets-kids';
const KLM_UNACCOMPANIED_URL = 'https://www.klm.com/information/assistance-health/children-travelling-alone';
const KLM_FEES_URL = 'https://www.klm.com/information/legal/fees-paid-options/';
const EMIRATES_UNACCOMPANIED_URL = 'https://www.emirates.com/english/family/planning-your-family-trip/unaccompanied-minors/';
const EMIRATES_INFANTS_URL = 'https://www.emirates.com/us/english/family/on-board/travelling-with-infants/';
const EMIRATES_CHILD_TICKETING_URL = 'https://www.emirates.com/us/english/help/faq-topics/special-assistance-and-requests/';
const EMIRATES_FARES_URL = 'https://www.emirates.com/us/english/information/optional-services/';
const TAP_CHILDREN_URL = 'https://www.flytap.com/en-us/information/babies-and-children';
const TAP_CHILDREN_LOCALIZED_URL = 'https://www.flytap.com/en-il/information/babies-and-children';
const TAP_FAQ_URL = 'https://www.flytap.com/en-us/help/frequently-asked-questions';
const carrierName = value => typeof value === 'string' ? value.trim() : '';
function knownCarrierCode(name) {
  const value = carrierName(name).toLocaleLowerCase('en');
  const matches = [
    [/^air canada(?: rouge| express)?$/, 'AC'], [/^westjet$/, 'WS'], [/^delta(?: air lines)?$/, 'DL'],
    [/^american(?: airlines)?$/, 'AA'], [/^porter(?: airlines)?$/, 'PD'], [/^air transat$/, 'TS'],
    [/^flair(?: airlines?)?$/, 'F8'], [/^lufthansa(?: german airlines)?$/, 'LH'], [/^qatar airways$/, 'QR'],
    [/^british airways$/, 'BA'], [/^air france$/, 'AF'], [/^southwest(?: airlines)?$/, 'WN'],
    [/^united(?: airlines)?$/, 'UA'], [/^klm(?: royal dutch airlines)?$/, 'KL'],
    [/^emirates(?: airlines)?$/, 'EK'], [/^tap(?: air portugal)?$/, 'TP'],
  ];
  return matches.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

const POLICIES = {
  TP: {
    name: 'TAP Air Portugal',
    sources: [
      { label: 'TAP babies and children', url: TAP_CHILDREN_URL },
      { label: 'TAP babies and children (localized guidance)', url: TAP_CHILDREN_LOCALIZED_URL },
      { label: 'TAP frequently asked questions', url: TAP_FAQ_URL },
    ],
    boundaries: [2, 5, 12, 16, 18],
    describe() {
      return [
        'TAP says an accompanying passenger must be 18 or older and may travel with up to seven children ages 2–11 and one baby under 2; when travelling with a baby, that adult may accompany only three additional children. A newborn trip during the first 7 days is not recommended, and TAP directs emergencies to its medical assessment.',
        'A baby under 2 may travel on an adult’s lap or occupy a seat with an approved car seat; the seat option requires a child ticket arranged through TAP’s Contact Center. Children ages 2–11 must occupy a seat. TAP says special baby and child prices are offered only on certain routes, so neither a discount nor a fare category is inferred here.',
        'TAP’s unaccompanied-minor ticket cannot be purchased online. TAP describes accepted connections only through Lisbon or Porto on TAP flights, with no overnight stop and a maximum 6-hour connection; trips involving other airlines are not accepted for this service. The public age and companion conditions vary by localized TAP guidance, so this advisory does not decide whether a traveler requires or qualifies for the service. Confirm the exact birth dates, operated flights, cabin, connection and fees with TAP before relying on the itinerary.',
      ].join(' ');
    },
  },
  AC: {
    name: 'Air Canada',
    sources: [
      { label: 'Air Canada children and infant guidance', url: AIR_CANADA_CHILDREN_URL },
      { label: 'Air Canada children travelling alone', url: AIR_CANADA_UNACCOMPANIED_URL },
    ],
    boundaries: [2, 8, 12, 16],
    describe(ages) {
      return [
        'Air Canada’s published guidance distinguishes own-seat fares for travel within Canada or Canada–U.S. from child fares on other international itineraries; its child fare category is under 12, with ages 12+ in the adult category. Infant pricing and seating vary by itinerary, and an infant in a seat in Signature Class is not permitted under the general guidance.',
        'Children under age 8 must travel with a passenger age 16 or older seated adjacent in the same cabin. Unaccompanied-minor service is mandatory for solo travelers ages 8–11 and optional for ages 12–17. The service is only available for eligible nonstop Air Canada, Air Canada Rouge, and Jazz-operated Air Canada Express flights; it cannot be purchased for connecting or codeshare flights. A service fee applies. Adults accompanying children under 12 must be at least 16.',
      ].join(' ');
    },
  },
  WS: {
    name: 'WestJet',
    sources: [
      { label: 'WestJet domestic tariff (Rule 45)', url: WESTJET_DOMESTIC_TARIFF_URL },
      { label: 'WestJet international tariff (Rule 45)', url: WESTJET_INTERNATIONAL_TARIFF_URL },
    ],
    boundaries: [2, 5, 8, 12, 16],
    describe(ages) {
      const facts = [
        'WestJet’s current tariffs classify travelers under 2 as infants and ages 2–17 as minors. Infants may travel lap-held; an infant in a seat must be next to an accompanying passenger, outside Business cabin, and requires a full fare. A traveler who turns 2 during an itinerary must occupy a seat and pay a full fare for flights after the birthday.',
        'The tariffs require travelers 4 and under to be accompanied by a parent or passenger age 16+, ages 5–11 by a passenger age 12+, and state that ages 12–17 may travel alone as an adult. Travelers age 2+ require a full fare.',
      ];
      if (ages.some(person => person.ages.length > 1 && person.ages[0] < 2 && person.ages.some(age => age >= 2))) {
        facts.push('The supplied birth date places this traveler below age 2 on one searched date and at least 2 on another; the tariff changes infant seating and fare treatment after the birthday.');
      }
      return facts.join(' ');
    },
  },
  DL: {
    name: 'Delta Air Lines',
    sources: [
      { label: 'Delta children and infant travel guidance', url: DELTA_CHILDREN_URL },
      { label: 'Delta international Contract of Carriage', url: DELTA_CONTRACT_URL },
    ],
    boundaries: [2, 5, 8, 15],
    describe(ages) {
      const facts = [
        'Delta’s published guidance says ages 0–4 need an accompanying passenger age 18+, and ages 5–14 require its Unaccompanied Minor service when travelling alone. Its Contract of Carriage limits ages 5–7 to nonstop travel, while ages 8–14 may use Delta connections and specified partner connections; ages 15–17 may travel alone, with optional service. These restrictions depend on the operating carrier and exact route. Delta also says lap-infant tickets outside the U.S. are usually about 10% of the adult fare with country-specific fees and that country-specific discounts may apply to own-seat infants and children.',
      ];
      if (ages.some(person => person.ages.length > 1 && person.ages[0] < 2 && person.ages.some(age => age >= 2))) {
        facts.push('The supplied birth date crosses Delta’s under-2 infant category during the searched dates; confirm the required seat and ticket for each flight with Delta or the seller.');
      }
      return facts.join(' ');
    },
  },
  AA: {
    name: 'American Airlines',
    sources: [
      { label: 'American Airlines traveling with children', url: AMERICAN_CHILDREN_URL },
      { label: 'American Airlines children traveling alone', url: AMERICAN_UNACCOMPANIED_URL },
      { label: 'American Airlines customer service plan', url: AMERICAN_SERVICE_PLAN_URL },
    ],
    boundaries: [2, 5, 15],
    describe(ages) {
      const facts = [
        'American Airlines requires children age 2 and older to have their own seat and ticket. Only one infant may be lap-held by each ticketed accompanying adult; additional infants under 2 need a ticket and seat. If an infant turns 2 during the trip, the child needs a seat for the remainder.',
        'For a child traveling alone, ages 0–4 cannot travel alone; ages 5–14 must use the unaccompanied-minor service; ages 15–17 may use it optionally. American also describes ages 2–14 traveling with someone age 16 or older as accompanied minors. For unaccompanied connecting itineraries, American lists CLT, DCA, DFW, JFK, LAX, LGA, MIA, ORD, PHL and PHX as permitted connection airports; it does not accept other-airline/codeshare connections, overnight connections, or connections that would be the last flight of the day. Its current guidance also says an unaccompanied-minor booking must be made by phone. These rules do not establish a fare discount or prove that a specific itinerary is eligible.',
      ];
      if (ages.some(person => person.ages.length > 1 && person.ages[0] < 2 && person.ages.some(age => age >= 2))) {
        facts.push('The supplied birth date crosses American’s age-2 seat requirement during the searched dates; a lap-infant arrangement cannot cover the whole trip.');
      }
      return facts.join(' ');
    },
  },
  PD: {
    name: 'Porter Airlines',
    sources: [
      { label: 'Porter infant and child booking guidance', url: PORTER_CHILDREN_URL },
      { label: 'Porter children travelling alone', url: PORTER_UNACCOMPANIED_URL },
      { label: 'Porter children and infants FAQ', url: PORTER_CHILDREN_FAQ_URL },
    ],
    boundaries: [2, 8, 12],
    describe(ages) {
      const facts = [
        'Porter’s published booking guidance says infants 7 days to under 2 may travel lap-held or in a paid seat, with a limit of one lap infant per accompanying adult age 16 or older. A paid infant seat must be arranged by contacting Porter. Children over 2 and under 12 require a purchased seat at full fare. Porter’s FAQ says fare types are the same regardless of age.',
        'Porter’s unaccompanied-minor guidance says the service is mandatory for children ages 8–11 travelling alone on nonstop Porter-operated flights; it is optional for ages 12–17. Porter’s FAQ says children under 12 must be accompanied by someone at least 16, while its booking page says older than 16. The published pages differ on this companion threshold, so it is not resolved here.',
      ];
      if (ages.some(person => person.birthDate && person.travelDates?.some(date => {
        const days = ageInDaysOnDate(person.birthDate, date);
        return days !== null && days < 7;
      }))) {
        facts.push('The supplied birth date places this traveler under 7 days old on a searched date; Porter’s published infant booking range starts at 7 days, so confirm age eligibility directly with Porter. This advisory does not treat the trip as permitted.');
      }
      if (ages.some(person => person.ages.length > 1 && person.ages[0] < 2 && person.ages.some(age => age >= 2))) {
        facts.push('The supplied birth date crosses age 2 during the searched dates; Porter states a seat is required after the child reaches age 2 and says the booking must be arranged by contacting the carrier.');
      }
      return facts.join(' ');
    },
  },
  TS: {
    name: 'Air Transat',
    sources: [
      { label: 'Air Transat travelling with children', url: AIR_TRANSAT_CHILDREN_URL },
      { label: 'Air Transat unaccompanied minors', url: AIR_TRANSAT_UNACCOMPANIED_URL },
    ],
    boundaries: [2, 8, 12, 16],
    describe(ages) {
      const facts = [
        'Air Transat defines an infant as at least 8 days old and under age 2; a child aged 2–11 must have their own seat. At most one infant may travel on each passenger’s lap. If an infant turns 2 during the trip, a seat is required for all flight segments.',
        'Air Transat says children age 7 and under must travel in the same cabin as a passenger age 16 or older. Its unaccompanied-minor VIP service is mandatory for ages 8–11; children under 12 travelling without a parent or legal guardian are charged an adult fare plus the service fee. The service is unavailable on connecting or codeshare flights and on flights to or from Colombia. Ages 12–17 may travel alone if they can travel independently; VIP service is optional, and its use involves an adult rate and fee.',
      ];
      if (ages.some(person => person.birthDate && person.travelDates?.some(date => {
        const days = ageInDaysOnDate(person.birthDate, date);
        return days !== null && days < 8;
      }))) {
        facts.push('The supplied birth date places this traveler under 8 days old on a searched date; Air Transat’s published minimum is 8 days. Confirm the exact DOB and travel-date rule with Air Transat; this advisory does not treat the trip as permitted.');
      }
      return facts.join(' ');
    },
  },
  F8: {
    name: 'Flair Airlines',
    sources: [
      { label: 'Flair tariffs currently in effect', url: FLAIR_TARIFFS_URL },
      { label: 'Flair Domestic Scheduled Passenger Tariff (effective June 1, 2026)', url: FLAIR_DOMESTIC_TARIFF_URL },
      { label: 'Flair International Tariff (effective June 1, 2026)', url: FLAIR_INTERNATIONAL_TARIFF_URL },
    ],
    boundaries: [2, 12, 16, 18],
    describe() {
      return [
        'Flair’s domestic tariff says under-2 infants may travel lap-held, one per adult passenger, and the tariff’s child/infant rules require a purchased seat from age 2; a child under 12 must travel with a confirmed passenger age 18 or older for the entire trip. Ages 12–17 are accepted under the domestic rule. If an infant turns 2 before a continuing or return flight, a seat is required for those flights.',
        'Flair’s international tariff says it does not provide an unaccompanied-minor service. For Canada–U.S. travel, children under 16 require an accompanying ticketed passenger age 18 or older throughout; ages 16–17 may travel alone only on nonstop flights. On other international routes, travelers under 18 require a ticketed passenger age 18 or older for the entire trip. Children age 2+ need their own purchased seat.',
        'The tariffs describe different lap-infant pricing by itinerary: domestic and Canada–U.S. lap infants may travel without a seat at no charge, while the tariff states 20% of the applicable adult fare (excluding taxes, fees and charges) for lap infants on other international routes. This is not a quote for the searched fare.',
      ].join(' ');
    },
  },
  LH: {
    name: 'Lufthansa',
    sources: [
      { label: 'Lufthansa planning a trip with children', url: LUFTHANSA_CHILDREN_URL },
      { label: 'Lufthansa general conditions of carriage (Canada)', url: LUFTHANSA_CONDITIONS_URL },
    ],
    boundaries: [2, 5, 12],
    describe() {
      return [
        'Lufthansa’s Canadian children guidance classifies lap-held travelers under age 2 as infants; its published infant price is free on German domestic routes and 10% of the regular fare on other routes. A separate infant seat must be arranged through its Service Centre, is charged at a child fare, and requires an approved child restraint system. Travelers aged 2–11 need their own seat; a child turning 2 during the trip needs a seat and child fare.',
        'Lufthansa’s Canadian Conditions of Carriage say children under 5 may travel only with an accompanying adult age 18 or older. Unaccompanied children ages 5–11 must be registered in advance through the Service Centre and are subject to fees and published conditions. A child under 12 travelling in a different cabin from the accompanying adult must be booked as an unaccompanied minor and use its care service.',
      ].join(' ');
    },
  },
  QR: {
    name: 'Qatar Airways',
    sources: [
      { label: 'Qatar Airways infant and child fares', url: QATAR_CHILDREN_URL },
      { label: 'Qatar Airways young solo traveler service', url: QATAR_YOUNG_TRAVELER_URL },
      { label: 'Qatar Airways children and infants procedures', url: QATAR_TRADE_CHILDREN_URL },
    ],
    boundaries: [2, 5, 12, 16, 18],
    describe(ages) {
      const facts = [
        'Qatar Airways says infants younger than 8 days are accepted only for specified medical or compassionate exceptions with medical clearance; infants from 8 days to under 2 may travel on an accompanying adult’s lap with an infant fare. Its published procedures limit each adult to one lap infant. Guidance for one adult traveling with two infants requires the second infant to be at least 1 year old and occupy a separate seat or car seat; additional-adult conditions apply in some cases.',
        'Qatar Airways describes children ages 2–11 as requiring their own seat and a child fare where the specific fare permits it. Its published young-solo-traveler rules require unaccompanied-minor service for ages 5–11 traveling without an adult age 16 or older; the carrier offers optional young-passenger service for ages 12–15 traveling without an adult age 18 or older.',
      ];
      if (ages.some(person => person.birthDate && person.travelDates?.some(date => {
        const days = ageInDaysOnDate(person.birthDate, date);
        return days !== null && days < 8;
      }))) {
        facts.push('The supplied birth date places this traveler under 8 days old on a searched date; Qatar Airways lists only specified medically cleared exceptions. This advisory does not treat the trip as permitted.');
      }
      facts.push('Qatar Airways states that stricter local-government or other-airline rules may take precedence on codeshare or interline travel. These general rules do not establish eligibility or price for this fare, route, operating carrier, cabin or seller.');
      return facts.join(' ');
    },
  },
  BA: {
    name: 'British Airways',
    sources: [
      { label: 'British Airways tickets and travel documents', url: BRITISH_AIRWAYS_CHILDREN_URL },
      { label: 'British Airways children travelling alone', url: BRITISH_AIRWAYS_SOLO_URL },
      { label: 'British Airways online passenger booking guidance', url: BRITISH_AIRWAYS_BOOKING_URL },
    ],
    boundaries: [2, 12, 14],
    describe(ages) {
      const facts = [
        'British Airways publishes infant ages 0–23 months, child ages 2–11, and young-adult ages 12–15. A lap infant under 2 is ticketed at an infant fare; an infant in a separate seat needs a child fare and approved restraint. A child who turns 2 during the trip needs a seat on flights on and after the birthday, and BA says this booking must be arranged with it directly. The published age table labels adults as “over 16,” so the exact fare category at age 16 is not established by that wording.',
        'British Airways says children under 14 must travel with someone age 16 or older, and ages 14+ may travel alone on BA-operated domestic or international flights. Ages 14–15 must be booked by a parent or legal guardian through BA, cannot check in online, and need consent and guardian-ID documents. Partner airlines can impose different rules.',
        'British Airways’ online passenger guidance says young adults ages 12–15 must include an adult when booking online. This differs from its travel-alone guidance allowing ages 14–15 to fly alone with the specified direct-booking and document conditions. The applicable booking path and acceptance must therefore be confirmed with BA; this advisory cannot resolve it.',
      ];
      if (ages.some(person => person.birthDate && person.ages.some(age => age >= 0 && age < 2))) {
        facts.push('A supplied birth date is checked against each known travel date; confirm the exact under-2 and age-2 seating and ticket treatment with BA, especially if the birthday falls during the trip.');
      }
      return facts.join(' ');
    },
  },
  AF: {
    name: 'Air France',
    sources: [
      { label: 'Air France Canada families and children', url: AIR_FRANCE_FAMILY_URL },
      { label: 'Air France Canada Kids Solo', url: AIR_FRANCE_SOLO_URL },
      { label: 'Air France Canada young traveler age bands', url: AIR_FRANCE_SOLO_AIRPORT_URL },
      { label: 'Air France Canada booking and connection guidance', url: AIR_FRANCE_SOLO_PREPARE_URL },
      { label: 'Air France Canada Kids Solo terms and fees', url: AIR_FRANCE_SOLO_TERMS_URL },
    ],
    boundaries: [2, 4, 5, 12, 15],
    describe() {
      return [
        'Air France’s Canadian family guidance describes infants as under 2. A lap infant may receive up to a 90% fare reduction where applicable (Paris–Corsica has a stated exception); an infant in a seat requires a child-fare ticket and approved car seat or harness, booked with Air France. If the child turns 2 during the trip, the child rate applies to the entire booking. One adult may travel with two infants, but Air France says that booking must be made by phone and one infant must occupy a separately ticketed child seat with an approved restraint.',
        'Air France says eligible child discounts for ages 2–13 depend on the fare and may be up to 20% on short-haul or 33% on medium/long-haul flights. These are published maximums, not a quote or an applied discount. The carrier’s accompaniment and Kids Solo rules vary by network: its Canadian pages describe Kids Solo for ages 4–17 on domestic France networks and 5–17 internationally; the youngest bands (generally 4–11 domestic and 5–14 international) require the service, while older teens may have an optional paid service. The pages list exceptions for routes involving Nouméa and Saint-Pierre-et-Miquelon, and accompaniment ages differ for domestic versus international networks.',
        'Kids Solo availability and fees depend on the actual flight and itinerary. Air France says its service may be full for a flight and directs customers to contact it for connections involving another airline. The specific domestic, overseas, international and exception route rules cannot be resolved from an Air France code alone; verify the exact itinerary and every operating carrier directly.',
      ].join(' ');
    },
  },
  WN: {
    name: 'Southwest Airlines',
    sources: [
      { label: 'Southwest lap child policy', url: SOUTHWEST_INFANT_URL },
      { label: 'Southwest young traveler terms', url: SOUTHWEST_YOUNG_TRAVELERS_URL },
      { label: 'Southwest Contract of Carriage', url: SOUTHWEST_CONTRACT_URL },
      { label: 'Southwest agency GDS policy', url: SOUTHWEST_GDS_POLICY_URL },
    ],
    boundaries: [2, 5, 12, 18],
    describe(ages) {
      const facts = [
        'Southwest’s Contract of Carriage sets a 14-day minimum for infants unless an attending physician supplies written approval. Its direct lap-child guidance accepts one lap child under age 2 per accompanying adult age 18 or older; the Contract of Carriage instead says a lap child may travel with a passenger age 12 or older. The agency GDS policy again requires an adult age 18 or older. These channel-specific age thresholds conflict, so confirm the booking channel and exact guardian rule with Southwest.',
        'Southwest requires unaccompanied children ages 5–11 to use its Unaccompanied Minor service; its Contract of Carriage limits UM travel to flights without a change of aircraft or flight number and excludes international itineraries. Ages 12–17 traveling alone are Young Travelers, not UMs, and Southwest says it does not monitor them. The Contract of Carriage also allows Southwest to refuse an under-18 itinerary with an overnight connection.',
        'Southwest’s agency GDS policy says unaccompanied-minor tickets cannot be issued through a GDS, requires parent/guardian reservation references to be linked by OSI for minors on separate PNRs, and requires Young Travelers on international itineraries to be linked to a parent or guardian age 18 or older with additional documents arranged by phone. Such separate-ticket documentation is not performed by this application.',
      ];
      if (ages.some(person => person.birthDate && person.travelDates?.some(date => {
        const days = ageInDaysOnDate(person.birthDate, date);
        return days !== null && days < 14;
      }))) {
        facts.push('A supplied birth date places this traveler under 14 days old on a searched date. Southwest’s published minimum is 14 days unless its stated physician-approval exception is met; verify the exact flight and documentation directly.');
      }
      if (ages.some(person => person.ages.length > 1 && person.ages[0] < 2 && person.ages.some(age => age >= 2))) {
        facts.push('The supplied birth date crosses age 2 during the searched dates; a lap-child arrangement cannot cover the whole trip and a seat is required after age 2.');
      }
      return facts.join(' ');
    },
  },
  UA: {
    name: 'United Airlines',
    sources: [
      { label: 'United Airlines traveling with children', url: UNITED_CHILDREN_URL },
      { label: 'United Airlines unaccompanied minors', url: UNITED_UNACCOMPANIED_URL },
    ],
    boundaries: [],
    describe() {
      return 'United links separate guidance for traveling with children and unaccompanied minors, but the current public source text could not be verified. This advisory does not assume United-specific age bands, infant seating rules, solo-minor eligibility, route restrictions, charges, or partner rules. Confirm the exact travelers, operated flights, seating and fees directly with United or the issuing seller.';
    },
  },
  KL: {
    name: 'KLM',
    sources: [
      { label: 'KLM Canada children and family travel', url: KLM_CHILDREN_URL },
      { label: 'KLM child ticket options', url: KLM_TICKETS_URL },
      { label: 'KLM children travelling alone', url: KLM_UNACCOMPANIED_URL },
      { label: 'KLM service surcharges', url: KLM_FEES_URL },
    ],
    boundaries: [2, 5, 12, 13, 14, 15, 18],
    describe(ages) {
      const facts = [
        'KLM says a child ticket covers ages 2–11, with regular ticket pricing from age 12 on most routes. Babies under 2 may travel on a parent’s lap at the baby fare or use a separately arranged paid seat. If a baby turns 2 during the trip, KLM says the child fare applies to all flights in the booking and the trip cannot be booked online; contact KLM for assistance.',
        'KLM allows at most two babies per adult, with only one on the adult’s lap; another baby needs a separately arranged seat. For solo children ages 5–14, or a child in a different cabin from the accompanying adult, KLM requires its Unaccompanied Minor service and an accompanying adult age 18+ for the service rule. Ages 15–17 may travel alone without the service or use it optionally. Transfers for children travelling alone are allowed only on KLM, Air France, and Delta flights. The service adds an adult ticket price plus a route-dependent surcharge.',
        'KLM’s Canada family page has differing age wording for the rule that children sit beside an adult: one section says under 13 on Canada routes, while its footnote says 14 and younger for those routes. This advisory preserves that source discrepancy; confirm the child’s seating and exact itinerary with KLM.',
      ];
      if (ages.some(person => person.ages.length > 1 && person.ages[0] < 2 && person.ages.some(age => age >= 2))) {
        facts.push('The supplied birth date crosses age 2 during the searched dates. KLM says a child fare applies to every flight in that booking and online booking is unavailable; confirm the entire itinerary with KLM.');
      }
      return facts.join(' ');
    },
  },
  EK: {
    name: 'Emirates',
    sources: [
      { label: 'Emirates unaccompanied minors', url: EMIRATES_UNACCOMPANIED_URL },
      { label: 'Emirates traveling with infants', url: EMIRATES_INFANTS_URL },
      { label: 'Emirates child and infant ticketing guidance', url: EMIRATES_CHILD_TICKETING_URL },
      { label: 'Emirates child and infant fare table', url: EMIRATES_FARES_URL },
    ],
    boundaries: [2, 5, 12, 16, 18],
    describe(ages) {
      const facts = [
        'Emirates says infants under 2 may travel on a lap or in a separately purchased seat with an approved child restraint; only one of two infants may be carried on an adult’s lap. Its child-ticketing guidance says children ages 2–11 need their own seat and describes discounted child fares, which vary by cabin and fare conditions. Infants under 7 days are accepted only for specified emergency medical or compassionate exceptions.',
        'For solo children ages 5–11, Emirates requires its Unaccompanied Minors service and an adult fare. The service applies only to Emirates-operated flights and must be arranged separately for outbound and return. Emirates describes optional paid service for ages 12–15, but its page also says children “over 12” may travel alone without the service; the exact age-12 threshold is therefore unclear. A child ages 5–11 in a different cabin from the accompanying adult is treated under its unaccompanied/adult-fare rule. Connection limits depend on carrier and airport, including separate limits for Dubai.',
        'Emirates’ guidance for unaccompanied travel to Canada says its service can take a child only as far as Toronto because Air Canada does not accept unaccompanied minors from other airlines; a parent or guardian must meet the child there. This is a Canada-specific transfer limit, not proof that a particular itinerary or codeshare is accepted.',
      ];
      if (ages.some(person => person.birthDate && person.travelDates?.some(date => {
        const days = ageInDaysOnDate(person.birthDate, date);
        return days !== null && days < 7;
      }))) {
        facts.push('The supplied birth date places this traveler under 7 days old on a searched date. Emirates lists only specified emergency medical or compassionate exceptions; this advisory does not treat the trip as permitted.');
      }
      if (ages.some(person => person.ages.length > 1 && person.ages[0] < 2 && person.ages.some(age => age >= 2))) {
        facts.push('The supplied birth date crosses age 2 during the searched dates. Emirates says the traveler needs a seat and applicable child fare on/after the birthday; its guidance says an outbound infant/return child booking cannot be booked online and should be arranged through a local Emirates office.');
      }
      return facts.join(' ');
    },
  },
};

function carrierEvidence(offer) {
  const carriers = new Map();
  const unidentifiedSegments = [];
  const record = (code, name, role, location = null) => {
    const normalizedCode = typeof code === 'string' && /^[A-Z0-9]{2,3}$/.test(code.trim().toUpperCase())
      ? code.trim().toUpperCase()
      : knownCarrierCode(name);
    if (!normalizedCode) return;
    code = normalizedCode;
    const evidence = carriers.get(code) ?? { code, operating: false, marketing: false, names: new Set(), operatingSegments: [], marketingSegments: [] };
    evidence[role] = true;
    if (name) evidence.names.add(name);
    const locations = evidence[`${role}Segments`];
    if (location && !locations.some(item => item.direction === location.direction && item.segment === location.segment)) locations.push(location);
    carriers.set(code, evidence);
  };
  const recordSegments = (segments, direction) => {
    for (const [index, segment] of segments.entries()) {
      const operatingCode = segment?.operating_carrier_code;
      const operatingName = carrierName(segment?.operating_carrier_name);
      const marketingCode = segment?.marketing_carrier_code || segment?.carrierCode;
      const marketingName = carrierName(segment?.marketing_carrier_name);
      const hasOperatingCode = typeof operatingCode === 'string' && /^[A-Z0-9]{2,3}$/.test(operatingCode.trim().toUpperCase());
      const hasMarketingCode = typeof marketingCode === 'string' && /^[A-Z0-9]{2,3}$/.test(marketingCode.trim().toUpperCase());
      const location = { direction, segment: index + 1 };
      if (operatingCode || operatingName) record(operatingCode, operatingName, 'operating', location);
      if (marketingCode || marketingName) record(marketingCode, marketingName, 'marketing', location);
      const missing = [];
      if (!hasOperatingCode && !operatingName) missing.push('operating');
      if (!hasMarketingCode && !marketingName) missing.push('marketing');
      if (missing.length) unidentifiedSegments.push({ direction, segment: index + 1, missing });
    }
  };
  recordSegments(Array.isArray(offer?.segments) ? offer.segments : [], 'outbound');
  recordSegments(Array.isArray(offer?.inbound?.segments) ? offer.inbound.segments : [], 'inbound');
  if (carriers.size === 0 && Array.isArray(offer?.airlines)) {
    // Name-only provider summaries can identify a carrier but cannot map it to every leg.
    for (const value of Array.isArray(offer?.airlines) ? offer.airlines : []) {
      const name = carrierName(value);
      if (/^air canada(?: rouge| express)?$/i.test(name)) record('AC', name, 'marketing');
      else if (/^westjet$/i.test(name)) record('WS', name, 'marketing');
      else if (/^delta(?: air lines)?$/i.test(name)) record('DL', name, 'marketing');
      else if (/^american(?: airlines)?$/i.test(name)) record('AA', name, 'marketing');
      else if (/^porter(?: airlines)?$/i.test(name)) record('PD', name, 'marketing');
      else if (/^air transat$/i.test(name)) record('TS', name, 'marketing');
      else if (/^flair(?: airlines?)?$/i.test(name)) record('F8', name, 'marketing');
      else if (/^lufthansa(?: german airlines)?$/i.test(name)) record('LH', name, 'marketing');
      else if (/^qatar airways$/i.test(name)) record('QR', name, 'marketing');
      else if (/^british airways$/i.test(name)) record('BA', name, 'marketing');
      else if (/^air france$/i.test(name)) record('AF', name, 'marketing');
      else if (/^southwest(?: airlines)?$/i.test(name)) record('WN', name, 'marketing');
      else if (/^united(?: airlines)?$/i.test(name)) record('UA', name, 'marketing');
      else if (/^klm(?: royal dutch airlines)?$/i.test(name)) record('KL', name, 'marketing');
      else if (/^emirates(?: airlines)?$/i.test(name)) record('EK', name, 'marketing');
      else if (/^tap(?: air portugal)?$/i.test(name)) record('TP', name, 'marketing');
    }
  }
  return { carriers: [...carriers.values()].map(item => ({ ...item, names: [...item.names] })), unidentifiedSegments };
}

function travelDates(query, offer) {
  const dates = [];
  const add = value => {
    const date = typeof value === 'string' ? value.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || dates.includes(date)) return;
    dates.push(date);
  };
  add(query?.date);
  for (const segment of Array.isArray(offer?.segments) ? offer.segments : []) {
    add(segment?.departure_time_local);
    add(segment?.arrival_time_local);
  }
  if (query?.tripType === 'round-trip') add(query?.returnDate);
  for (const segment of Array.isArray(offer?.inbound?.segments) ? offer.inbound.segments : []) {
    add(segment?.departure_time_local);
    add(segment?.arrival_time_local);
  }
  return dates;
}

function ageInDaysOnDate(birthDate, travelDate) {
  const birth = Date.parse(`${birthDate}T00:00:00Z`);
  const travel = Date.parse(`${travelDate}T00:00:00Z`);
  if (!Number.isFinite(birth) || !Number.isFinite(travel) || travel < birth) return null;
  return Math.floor((travel - birth) / 86_400_000);
}

function ageEvidence(query, offer) {
  const dates = travelDates(query, offer);
  if (Array.isArray(query?.travelers) && query.travelers.length) {
    try {
      return query.travelers.map(person => ({ birthDate: person.birthDate, travelDates: dates, ages: dates.map(date => ageOnDate(person.birthDate, date)) }));
    } catch {
      return null;
    }
  }
  if (Array.isArray(query?.childrenAges) && query.childrenAges.length) {
    return query.childrenAges.map(age => ({ ages: [age], exactReturnAge: false }));
  }
  if (Number(query?.children) > 0) return [{ ages: [], exactReturnAge: false, unknown: true }];
  return [];
}

function roleDescription(carrier) {
  const format = locations => locations.length ? locations.map(item => `${item.direction} segment ${item.segment}`).join(', ') : '';
  if (carrier.operating && carrier.marketing) {
    const roles = [
      format(carrier.operatingSegments) ? `operating on ${format(carrier.operatingSegments)}` : '',
      format(carrier.marketingSegments) ? `marketing on ${format(carrier.marketingSegments)}` : '',
    ].filter(Boolean);
    return `is identified in both operating and marketing roles${roles.length ? ` (${roles.join('; ')})` : ''}`;
  }
  if (carrier.operating) {
    const locations = format(carrier.operatingSegments);
    return `is identified as an operating carrier${locations ? ` on ${locations}` : ''}`;
  }
  const locations = format(carrier.marketingSegments);
  return `is identified only as a marketing carrier${locations ? ` on ${locations}` : ''}; the operating carrier is not established`;
}

function categoryChanges(carrier, ages) {
  const boundaries = POLICIES[carrier.code]?.boundaries || [];
  return ages.flatMap(person => boundaries
    .filter(boundary => person.ages.length > 1 && person.ages.some(age => age < boundary) && person.ages.some(age => age >= boundary))
    .map(boundary => `A supplied birth date crosses this carrier’s published age-${boundary} age-rule boundary during the searched dates (ages ${person.ages.join(' and ')}).`));
}

/**
 * Provide source-linked carrier guidance without declaring a fare eligible.
 * Marketing-carrier evidence alone does not establish the operating carrier or fare rule.
 */
export function carrierEligibilityGuidance(offer, query) {
  const ages = ageEvidence(query, offer);
  if (!ages || !ages.some(person => person.unknown || person.ages.some(age => age < 18))) return null;

  const evidence = carrierEvidence(offer);
  const unidentifiedSummary = evidence.unidentifiedSegments.length
    ? ` Carrier identity is incomplete: ${evidence.unidentifiedSegments.map(item => {
      const roles = item.missing.length === 2 ? 'marketing and operating carrier identities are missing' : `${item.missing[0]} carrier identity is missing`;
      return `${item.direction} segment ${item.segment} has ${roles}`;
    }).join('; ')}. Eligibility for those segments is not verified.`
    : '';
  const sources = [];
  const suppliedAgeSummary = ages.some(person => person.exactReturnAge !== false && !person.unknown)
    ? (() => {
      const minorAges = ages.filter(person => person.ages.some(age => age < 18)).map(person => person.ages);
      return minorAges.length ? ` Supplied birth dates produce minor-traveler ages across known search and flight dates: ${minorAges.map(values => values.join(' then ')).join('; ')}.` : '';
    })()
    : '';
  const carriers = evidence.carriers.map(carrier => {
    const policy = POLICIES[carrier.code];
    const role = `${policy?.name || carrier.names[0] || carrier.code} ${roleDescription(carrier)}.`;
    const carrierSources = policy?.sources || [];
    for (const source of carrierSources) if (!sources.some(existing => existing.url === source.url)) sources.push(source);
    const unknownAge = ages.some(person => person.unknown || person.exactReturnAge === false);
    const ageText = unknownAge ? ' Count-only or departure-age data does not establish each traveler’s age on every flight date; use actual birth dates.' : '';
    const message = policy
      ? [role, policy.describe(ages), ...categoryChanges(carrier, ages), suppliedAgeSummary, ageText, unidentifiedSummary, 'These are general published rules, not a match to this fare, route, codeshare, cabin or seller. Eligibility and price are not verified; confirm each traveler and flight with the operating carrier or seller.'].filter(Boolean).join(' ')
      : `${role} Child/youth eligibility for this carrier and fare is not verified. A returned price does not establish that each traveler may use it.${suppliedAgeSummary}${ageText}${unidentifiedSummary}`;
    return {
      code: carrier.code,
      name: policy?.name || carrier.names[0] || carrier.code,
      role,
      operatingSegments: carrier.operatingSegments,
      marketingSegments: carrier.marketingSegments,
      message,
      sources: carrierSources,
    };
  });

  if (!carriers.length) {
    const ageText = ages.some(person => person.unknown || person.exactReturnAge === false)
      ? ' Count-only or departure-age data does not establish each traveler’s age on all travel dates; provide actual birth dates.'
      : '';
    return {
      status: 'unverified',
      carriers: [],
      unidentifiedSegments: evidence.unidentifiedSegments,
      sources: [],
      message: `Carrier identity and child/youth eligibility for this fare are not verified. A returned price does not establish that each traveler may use it.${ageText}${unidentifiedSummary}`,
    };
  }

  const sourceUrl = sources.length === 1 ? sources[0].url : undefined;
  return {
    status: 'unverified',
    carriers,
    unidentifiedSegments: evidence.unidentifiedSegments,
    sources,
    ...(sourceUrl ? { sourceUrl } : {}),
    message: carriers.map(carrier => carrier.message).join(' '),
  };
}
