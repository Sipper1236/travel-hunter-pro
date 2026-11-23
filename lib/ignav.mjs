import {fetchSource} from './source-fetch.mjs';
import {readBoundedSourceJson} from './source-json.mjs';
import {validateTravelers,ignavIdentityParty,rejectUnsupportedTravelerFields,ageOnDate,validateIgnavRoundTripAge} from './travelers.mjs';
import {flightOfferError} from './flight-offer.mjs';
import {airportLocalMatchesInstant} from './airport-timezones.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
const API = 'https://ignav.com/api';
const iata = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const bagCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function reportedBaggage(bags) {
  if (!bags || typeof bags !== 'object' || Array.isArray(bags)) return null;
  const carryOn=bagCount(bags.carry_on), checked=bagCount(bags.checked);
  return carryOn===null && checked===null ? null : {carryOn,checked};
}

function keyFrom(options) {
  const key = options.apiKey ?? process.env.IGNAV_API_KEY;
  if (!key) throw new Error('Ignav is not configured. Set IGNAV_API_KEY on the server.');
  return key;
}

function validate(input) {
  if (!iata(input?.origin) || !iata(input?.destination) || input.origin === input.destination) throw new Error('Ignav searches require different three-letter airport or metro codes.');
  if (!date(input.date) || input.date < new Date().toISOString().slice(0, 10)) throw new Error('Enter a valid departure date that is today or later.');
  if (input.travelers) rejectUnsupportedTravelerFields({...input,travelers:undefined});
  const party=input.travelers ? ignavIdentityParty(input) : validateTravelers(input);
  const adults=party.people ? party.adults : party.adults+party.childrenAges.filter(age=>age>=12).length, children=party.people ? party.children : party.childrenAges.filter(age=>age<12).length;
  const cabin = input.cabin ?? 'economy';
  if (!['economy', 'premium_economy', 'business', 'first'].includes(cabin)) throw new Error('Unsupported cabin class.');
  const tripType=input.tripType ?? 'one-way';
  if(!['one-way','round-trip'].includes(tripType))throw Error('Choose one-way or round-trip.');
  if(tripType==='round-trip' && (!date(input.returnDate) || input.returnDate < input.date))throw Error('Enter a return date on or after departure.');
  validateIgnavRoundTripAge(input);
  return { origin: input.origin, destination: input.destination, date: input.date, adults, children, cabin, party, tripType, returnDate:tripType==='round-trip'?input.returnDate:null };
}

function itineraryKey(itinerary) {
  const segments = itinerary?.outbound?.segments;
  if (!Array.isArray(segments) || !segments.length) return null;
  const localTime = value => {
    if(typeof value!=='string')return false;
    const match=/^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)$/.exec(value);
    return Boolean(match&&date(match[1]));
  };
  const offsetInstant = value => {
    if(typeof value!=='string')return null;
    const match=/^(\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?)(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
    if(!match||!date(match[1].slice(0,10)))return null;
    if(match[2]!=='Z'){
      const hours=Number(match[4]),minutes=Number(match[5]);
      if(minutes>59||hours>14||hours===14&&minutes!==0||match[3]==='-'&&hours===0&&minutes===0)return null;
    }
    const instant=Date.parse(value);
    return Number.isFinite(instant)?instant:null;
  };
  if (segments.some(s => !iata(s.departure_airport) || !iata(s.arrival_airport) || offsetInstant(s.departure_time_utc)===null || offsetInstant(s.arrival_time_utc)===null || offsetInstant(s.arrival_time_utc)<=offsetInstant(s.departure_time_utc) || !localTime(s.departure_time_local) || !localTime(s.arrival_time_local) || typeof s.flight_number !== 'string' || !s.flight_number || typeof s.marketing_carrier_code !== 'string' || !s.marketing_carrier_code)) return null;
  for (let i = 1; i < segments.length; i++) if (segments[i - 1].arrival_airport !== segments[i].departure_airport || offsetInstant(segments[i].departure_time_utc) < offsetInstant(segments[i - 1].arrival_time_utc)) return null;
  return JSON.stringify(segments.map(s => [s.marketing_carrier_code, s.flight_number, s.departure_airport, s.departure_time_local, s.departure_time_utc, s.arrival_airport, s.arrival_time_local, s.arrival_time_utc, s.operating_carrier_code ?? null]));
}

function coherentAirportTimes(itinerary){
 const segments=[itinerary?.outbound?.segments,itinerary?.inbound?.segments].filter(Array.isArray).flat();
 if(!segments.length)return false;
 return segments.every(segment=>{
  return airportLocalMatchesInstant(segment.departure_time_local,segment.departure_time_utc,segment.departure_timezone)&&
   airportLocalMatchesInstant(segment.arrival_time_local,segment.arrival_time_utc,segment.arrival_timezone);
 });
}

function normalize(itinerary, query, observedAt) {
  const amount = itinerary?.price?.amount, currency = itinerary?.price?.currency;
  const key = itineraryKey(itinerary), segments = itinerary?.outbound?.segments;
  if (!key || !coherentAirportTimes(itinerary) || !observedAt || !Number.isFinite(amount) || amount <= 0 || currency !== 'CAD' || itinerary.price.status !== 'verified' || typeof itinerary.ignav_id !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(itinerary.ignav_id)) return null;
  const first = segments[0], last = segments.at(-1);
  if (first.departure_airport !== query.origin || last.arrival_airport !== query.destination || itinerary.cabin_class !== query.cabin || !Number.isFinite(itinerary.outbound.duration_minutes) || itinerary.outbound.duration_minutes <= 0) return null;
  let inbound = null;
  if(query.tripType==='round-trip'){
    const back=itinerary?.inbound?.segments;
    if(!itineraryKey({outbound:itinerary.inbound}) || !Number.isFinite(itinerary.inbound.duration_minutes) || itinerary.inbound.duration_minutes <= 0 || back[0].departure_airport!==last.arrival_airport || back.at(-1).arrival_airport!==first.departure_airport || back[0].departure_time_local.slice(0,10)!==query.returnDate || Date.parse(back[0].departure_time_utc)<Date.parse(last.arrival_time_utc))return null;
    inbound={from:back[0].departure_airport,to:back.at(-1).arrival_airport,departureDate:back[0].departure_time_local.slice(0,10),departureTime:back[0].departure_time_local.slice(11,16),arrivalDate:back.at(-1).arrival_time_local.slice(0,10),arrivalTime:back.at(-1).arrival_time_local.slice(11,16),durationMinutes:itinerary.inbound.duration_minutes,via:back.slice(0,-1).map(segment=>segment.arrival_airport),segments:back};
  }
  if (first.departure_time_local.slice(0, 10) !== query.date || itinerary.cabin_class && itinerary.cabin_class !== query.cabin) return null;
  const allSegments=[...segments,...(inbound?.segments ?? [])];
  if (query.party.people) {
    const category=age=>age<2?'infant':age<12?'child':'adult';
    try {
      if (query.party.people.some(person=>allSegments.some(segment=>[segment.departure_time_local,segment.arrival_time_local].some(time=>category(ageOnDate(person.birthDate,time.slice(0,10)))!==category(person.ages[0]))))) return null;
    } catch {return null;}
  } else {
    try {
      for(const segment of allSegments) for(const time of [segment.departure_time_local,segment.arrival_time_local]) {
        validateIgnavRoundTripAge({tripType:'round-trip',date:query.date,returnDate:time.slice(0,10),childrenAges:query.party.childrenAges});
      }
    } catch {return null;}
  }
  return {
    provider: 'Ignav', source: 'Ignav live fare API', section: query.tripType, observedAt,
    price: amount, currency, travelers: query.party.people ? `${query.party.people.length} identified travelers (${query.party.infantsInSeat} infant seats, ${query.party.infantsOnLap} lap infants)` : `${query.party.adults} adult${query.party.adults === 1 ? '' : 's'}${query.party.children ? `, ${query.party.children} child/youth` : ''}`,
    cabin: itinerary.cabin_class || query.cabin, from: first.departure_airport, to: last.arrival_airport,
    airlines: [...new Set(segments.map(s => s.operating_carrier_name || s.marketing_carrier_code))],
    departureDate: first.departure_time_local.slice(0, 10), departureTime: first.departure_time_local.slice(11, 16),
    arrivalDate: last.arrival_time_local.slice(0, 10), arrivalTime: last.arrival_time_local.slice(11, 16),
    durationMinutes: itinerary.outbound.duration_minutes, via: segments.slice(0, -1).map(s => s.arrival_airport),
    segments, inbound, itineraryKey: inbound ? JSON.stringify([key,itineraryKey({outbound:itinerary.inbound})]) : key, ignavId: itinerary.ignav_id,
    bookingStatus: 'Fare observed; seller availability not rechecked',
    fees: 'Provider-reported fare; verify inclusions, traveler eligibility, infant seating and final price with seller. Ignav uses ages 12+ as adults and ages 2–11 as children.',
    requiresSelfTransfer: Boolean(itinerary.requires_self_transfer),
  };
}

async function request(path, body, options = {}) {
  const apiKey = keyFrom(options);
  const response = await fetchSource('Ignav',`${API}${path}`, {
    method: 'POST',
    ...(options.signal?{signal:options.signal}:{}),
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }, {...options, retrySafe:true,retryIgnav424:['/fares/one-way','/fares/round-trip'].includes(path)});
  if (!response.ok) throw new Error(`Ignav request failed (HTTP ${response.status}).`);
  return readBoundedSourceJson(response,{provider:'Ignav',maxBytes:10_000_000});
}

export async function searchIgnav(input, options = {}) {
  const query = validate(input), data = await request(query.tripType==='round-trip'?'/fares/round-trip':'/fares/one-way', {
    origin: query.origin, destination: query.destination, departure_date: query.date,
    adults: query.adults, children: query.children, ...(query.party.people?{infants_in_seat:query.party.infantsInSeat,infants_on_lap:query.party.infantsOnLap}:{}), cabin_class: query.cabin, market: 'CA', ...(query.returnDate?{return_date:query.returnDate}:{}),
  }, options);
  if (!Array.isArray(data.itineraries)) throw new Error('Ignav returned an unexpected fare response.');
  if ((data.origin && data.origin !== query.origin) || (data.destination && data.destination !== query.destination) || (data.departure_date && data.departure_date !== query.date) || (query.returnDate && data.return_date && data.return_date !== query.returnDate)) throw new Error('Ignav response did not match the requested route and date.');
  const observedAt = typeof data.observed_at === 'string' && Number.isFinite(Date.parse(data.observed_at)) ? data.observed_at : null;
  const offers=[],rejectionReasons={};
  for(const item of data.itineraries){
    const offer=normalize(item,query,observedAt),reason=offer?flightOfferError(offer,input,{now:options.now ?? Date.now()}):'unusable';
    if(reason)rejectionReasons[reason]=(rejectionReasons[reason]??0)+1;else offers.push(offer);
  }
  const rejected=Object.values(rejectionReasons).reduce((sum,count)=>sum+count,0);
  return {
    query, observedAt, offers,
    sources: [{ provider: 'Ignav', status: 'ok', received: data.itineraries.length, accepted: offers.length, rejected,...(rejected?{rejectionReasons,reason:`${rejected} returned itineraries were excluded: ${Object.entries(rejectionReasons).map(([code,count])=>`${count} ${code}`).join(', ')}.`}:{}) }],
    complete: false,
    limitations: ['Returned itineraries are provider results, not exhaustive market coverage.', 'Search prices and availability can change; booking links do not guarantee a final price.', 'Age-only child fares are withheld when observed flight dates could cross age 12. Supply birth dates to validate those itineraries.'],
  };
}

export async function getIgnavBookingLinks(ignavId, options = {}) {
  if (typeof ignavId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(ignavId)) throw new Error('Invalid fare reference. Run a fresh search and try again.');
  const {expectedOffer,...requestOptions}=options;
  const data = await request('/fares/booking-links', { ignav_id: ignavId }, requestOptions);
  const cadPrice = price => Number.isFinite(price?.amount) && price.amount > 0 && price.currency === 'CAD' && ['verified','unverified'].includes(price.status) ? {amount:price.amount,currency:'CAD',status:price.status} : null;
  const expected = itineraryCoverage(data.itinerary);
  const itineraryMatch = expectedOffer ? compareBookingItinerary(expectedOffer,data.itinerary) : 'unknown';
  const normalizedOptions = Array.isArray(data.booking_options) ? data.booking_options.map(option => ({
    legs: Array.isArray(option.legs) && option.legs.length && option.legs.every(leg => ['outbound','inbound'].includes(leg)) && new Set(option.legs).size === option.legs.length ? option.legs : [],
    legIndexes: Array.isArray(option.leg_indexes) && option.leg_indexes.length && option.leg_indexes.every(index => Number.isSafeInteger(index) && index >= 0) && new Set(option.leg_indexes).size === option.leg_indexes.length ? option.leg_indexes : [],
    coverageKnown: validOptionCoverage(option),
    links: (Array.isArray(option.links) ? option.links : []).flatMap(link => {
      if (typeof link.url !== 'string') return [];
      try {
        const url = new URL(link.url.startsWith('https://') ? link.url : `https://${link.url}`);
        if (url.protocol !== 'https:' || url.username || url.password) return [];
        return [{ provider: typeof link.provider_name === 'string' && link.provider_name.trim() ? link.provider_name : 'Unknown seller', host:url.host, type: typeof link.provider_type === 'string' ? link.provider_type : 'unknown', specificity: ['exact_flight','search_results'].includes(link.specificity) ? link.specificity : 'unknown', url: url.toString(), price: cadPrice(link.price) }];
      } catch { return []; }
    }),
  })) : [];
  const verifiedItinerary = !expectedOffer || itineraryMatch==='matched';
  const bookingOptions = (verifiedItinerary?normalizedOptions:[]).filter(option => option.links.length);
  const coverage = verifiedItinerary?assessBookingCoverage(expected, normalizedOptions):{status:'unknown',covered:[]};
  const linkedPrices=bookingOptions.flatMap(option=>option.links.map(link=>link.price).filter(Boolean));
  const observedAt=typeof data.observed_at==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(data.observed_at)&&!/^-00:00$/.test(data.observed_at.slice(-6))&&date(data.observed_at.slice(0,10))&&Number.isFinite(Date.parse(data.observed_at))&&!/[+-]14:(?!00)/.test(data.observed_at)?data.observed_at:null;
  const providerResponseFreshnessStatus=observedAt?quoteFreshness({observedAt},requestOptions.now??Date.now()).status:'unknown';
  return {
    itinerary: data.itinerary ? { ...data.itinerary, price: cadPrice(data.itinerary.price) } : null, bookingOptions,
    linkedPriceEvidenceStatus: linkedPrices.some(price=>price.status==='verified')?'provider_reported_verified':linkedPrices.length?'provider_reported_unverified':'not_provided',
    linkedPriceFreshnessStatus:'unknown',
    linkedPriceFreshnessReason:'The provider timestamp applies to the overall handoff response; no timestamp tied to each seller link price was supplied.',
    providerResponseFreshnessStatus,
    sellerAvailabilityStatus:'not_checked', bookingStatus:'not_booked',
    baggage: reportedBaggage(data.itinerary?.bags), mandatoryChargesStatus:'not_itemized',
    expectedCoverage: expected?.labels ?? [], coveredCoverage: coverage.covered,
    coverageStatus: itineraryMatch==='mismatch'?'unknown':coverage.status, itineraryMatch,
    observedAt,
    status: itineraryMatch==='mismatch'?'itinerary_mismatch':expectedOffer&&itineraryMatch!=='matched'?'itinerary_unverified':bookingOptions.some(option => option.links.some(link => link.price?.status === 'verified')) ? 'priced_handoff' : bookingOptions.length ? 'handoff_unpriced' : 'no_links',
    limitation: itineraryMatch==='mismatch'?'Ignav returned a different itinerary from the stored search result. Seller links were suppressed. Run a fresh search and review the returned itinerary.':expectedOffer&&itineraryMatch!=='matched'?'Ignav did not return enough validated itinerary detail to match the saved flights. Seller links were suppressed; run a fresh search before opening a seller.':'Each link price applies only to the legs listed for its option. Links within one option are alternatives; separate options can require separate bookings. Ignav price verification is a provider-reported check, not seller checkout and not a reservation. Confirm itinerary, price, baggage, and availability on the seller site before purchase.',
  };
}

export function compareBookingItinerary(expectedOffer, returnedItinerary) {
  if (!expectedOffer || !Array.isArray(expectedOffer.segments) || !expectedOffer.segments.length || !returnedItinerary) return 'unknown';
  const expectedOutbound=itineraryKey({outbound:{segments:expectedOffer.segments}}), actualOutbound=itineraryKey(returnedItinerary);
  if (!expectedOutbound || !actualOutbound) return 'unknown';
  if (expectedOutbound!==actualOutbound) return 'mismatch';
  const expectsInbound=expectedOffer.inbound!==undefined && expectedOffer.inbound!==null;
  const hasInbound=returnedItinerary.inbound!==undefined && returnedItinerary.inbound!==null;
  if (expectsInbound!==hasInbound) return 'mismatch';
  if (expectsInbound) {
    const expectedInbound=itineraryKey({outbound:{segments:expectedOffer.inbound?.segments}}), actualInbound=itineraryKey({outbound:returnedItinerary.inbound});
    if (!expectedInbound || !actualInbound) return 'unknown';
    if (expectedInbound!==actualInbound) return 'mismatch';
  }
  if (expectedOffer.cabin!==undefined && expectedOffer.cabin!==null) {
    if (typeof returnedItinerary.cabin_class!=='string' || !returnedItinerary.cabin_class) return 'unknown';
    if (returnedItinerary.cabin_class!==expectedOffer.cabin) return 'mismatch';
  }
  return 'matched';
}

function itineraryCoverage(itinerary) {
  if (Array.isArray(itinerary?.legs)) {
    if (!itinerary.legs.length || itinerary.legs.some(leg => !Array.isArray(leg?.segments) || !leg.segments.length)) return null;
    return { mode:'indexes', keys:itinerary.legs.map((_, index)=>index), labels:itinerary.legs.map((_, index)=>`leg ${index+1}`) };
  }
  const outbound=itinerary?.outbound, inbound=itinerary?.inbound;
  if (!Array.isArray(outbound?.segments) || !outbound.segments.length) return null;
  if (inbound !== undefined && (!Array.isArray(inbound?.segments) || !inbound.segments.length)) return null;
  const keys=['outbound',...(inbound?['inbound']:[])];
  return { mode:'legs', keys, labels:keys };
}

function validOptionCoverage(option) {
  if (!option || typeof option !== 'object') return false;
  const hasLegs=Object.hasOwn(option,'legs'), hasIndexes=Object.hasOwn(option,'leg_indexes');
  if (hasLegs===hasIndexes) return false;
  if (hasLegs) return Array.isArray(option.legs) && option.legs.length>0 && option.legs.every(leg=>['outbound','inbound'].includes(leg)) && new Set(option.legs).size===option.legs.length;
  return Array.isArray(option.leg_indexes) && option.leg_indexes.length>0 && option.leg_indexes.every(index=>Number.isSafeInteger(index)&&index>=0) && new Set(option.leg_indexes).size===option.leg_indexes.length;
}

function assessBookingCoverage(expected, options) {
  if (!expected || !options.length) return {status:'unknown',covered:[]};
  const known=new Set(), expectedSet=new Set(expected.keys);
  for (const option of options) {
    if (!option.coverageKnown) return {status:'unknown',covered:[...known].map(key=>expected.labels[expected.keys.indexOf(key)])};
    const keys=expected.mode==='legs'?option.legs:option.legIndexes;
    if (expected.mode==='legs' ? !option.legs.length || option.legIndexes.length : !option.legIndexes.length || option.legs.length) return {status:'unknown',covered:[...known].map(key=>expected.labels[expected.keys.indexOf(key)])};
    if (keys.some(key=>!expectedSet.has(key))) return {status:'unknown',covered:[...known].map(key=>expected.labels[expected.keys.indexOf(key)])};
    if (keys.some(key=>known.has(key))) return {status:'unknown',covered:[...known].map(key=>expected.labels[expected.keys.indexOf(key)])};
    if (!option.links.length) continue;
    for (const key of keys) known.add(key);
  }
  const covered=[...known].map(key=>expected.labels[expected.keys.indexOf(key)]);
  return {status:known.size===expectedSet.size?'complete':'partial',covered};
}

export { itineraryKey };

/** Provider-observed cheapest dates; these are unverified indications, not bookable fares. */
export async function getIgnavCalendar(input, options = {}) {
  rejectUnsupportedTravelerFields(input);
  const query=validate({...input,date:input.start,tripType:'one-way'});
  if(!date(input.end) || input.end<input.start || (Date.parse(input.end)-Date.parse(input.start))/86400000>30)throw Error('Choose a departure range of at most 31 days.');
  const nights=input.nights ?? null;
  if(nights!==null && (!Number.isInteger(nights)||nights<0||nights>365))throw Error('Enter a stay length between 0 and 365 nights.');
  const maxStops=input.maxStops ?? null;
  if(maxStops!==null && (!Number.isInteger(maxStops)||maxStops<0||maxStops>2))throw Error('Choose a maximum of 0, 1 or 2 stops.');
  const data=await request('/fares/cheapest-dates',{origin:query.origin,destination:query.destination,departure_date_range:{start:input.start,end:input.end},adults:query.adults,children:query.children,cabin_class:query.cabin,market:'CA',...(nights!==null?{stay_days:nights}:{}),...(maxStops!==null?{max_stops:maxStops}:{})},options);
  if(!Array.isArray(data.dates)||(data.origin && data.origin!==query.origin)||(data.destination && data.destination!==query.destination))throw Error('Ignav returned an unexpected calendar response.');
  const seen=new Set(),dates=[];
  for(const row of data.dates){
    if(!date(row?.departure_date)||row.departure_date<input.start||row.departure_date>input.end||seen.has(row.departure_date))continue;
    seen.add(row.departure_date);
    const expectedReturn=nights===null?null:new Date(Date.parse(row.departure_date+'T00:00:00Z')+nights*86400000).toISOString().slice(0,10);
    if(nights!==null && row.return_date!==expectedReturn)continue;
    const price=row.price;
    const validPrice=price===null || (price && price.currency==='CAD' && Number.isFinite(price.amount) && price.amount>0 && price.status==='unverified');
    if(!validPrice)continue;
    dates.push({date:row.departure_date,returnDate:expectedReturn,price:price===null?null:price.amount,currency:'CAD',status:price===null?'no_fare':'unverified'});
  }
  dates.sort((a,b)=>a.date.localeCompare(b.date));
  return {dates,received:data.dates.length,query:{origin:query.origin,destination:query.destination,start:input.start,end:input.end,nights,cabin:query.cabin,adults:query.party.adults,childrenAges:query.party.childrenAges,maxStops},observedAt:typeof data.observed_at==='string' && Number.isFinite(Date.parse(data.observed_at))?data.observed_at:null,limitation:'Ignav calendar prices are unverified provider observations, not booked or confirmed fares. Select a date and run an exact search to recheck.'};
}

export async function searchIgnavAirports(query, options = {}) {
 if(typeof query!=='string'||query.trim().length<2||query.length>80)throw Error('Enter at least two characters.');
 const url=new URL(`${API}/airports`);url.search=new URLSearchParams({q:query.trim(),limit:'10'}).toString();
 const response=await fetchSource('Ignav',url,{headers:{'X-Api-Key':keyFrom(options),Accept:'application/json'},}, {...options,timeoutMs:10000});
 if(!response.ok)throw Error(`Airport lookup failed (HTTP ${response.status}).`);
 const data=await readBoundedSourceJson(response,{provider:'Ignav airport lookup',maxBytes:1_000_000});if(!Array.isArray(data))throw Error('Airport lookup returned an unexpected response.');
 return data.filter(item=>iata(item.code)&&typeof item.name==='string'&&typeof item.city==='string'&&typeof item.country==='string').slice(0,10).map(item=>{
  const region=[item.region,item.region_name,item.region_code,item.state,item.state_name,item.state_code,item.province,item.province_name,item.province_code].find(value=>typeof value==='string'&&value.trim());
  return {code:item.code,name:item.name,city:item.city,country:item.country,...(region?{region}:{}),source:'Ignav'};
 });
}
