import {fetchSource} from './source-fetch.mjs';
import {readBoundedSourceJson} from './source-json.mjs';
import {expediaParty} from './travelers.mjs';
import { randomUUID } from 'node:crypto';
const API = 'https://apim.expedia.com/flights/listings';
const iata = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const selectionFor=offer=>Object.fromEntries([['outbound',offer],['return',offer.inbound]].filter(([,leg])=>leg).map(([side,leg])=>[side,leg.segments.map(segment=>[segment.from,segment.to,segment.carrierCode,segment.flightNumber,segment.departureAt,segment.arrivalAt])]));

function config(options) {
  const key = options.apiKey ?? process.env.EXPEDIA_TRAVEL_REDIRECT_KEY;
  const authorization = options.authorization ?? process.env.EXPEDIA_TRAVEL_REDIRECT_AUTHORIZATION;
  if (!key || !authorization) throw new Error('Expedia Travel Redirect is not configured. Set its partner-issued key and Authorization value on the server.');
  return { key, authorization };
}

function durationMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  return match ? Number(match[1] || 0) * 60 + Number(match[2] || 0) : null;
}

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value) || !validDate(value.slice(0, 10))) return null;
  const offset=/([+-])(\d{2}):(\d{2})$/.exec(value);
  if (+value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || (value[16] === ':' && +value.slice(17, 19) > 59) || offset&&(Number(offset[2])>14||Number(offset[3])>59||Number(offset[2])===14&&Number(offset[3])!==0||offset[1]==='-'&&Number(offset[2])===0&&Number(offset[3])===0)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function safeLink(value) {
  try {
    const url = new URL(value);
    const approvedHost = ['expedia.com', 'expedia.ca'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    return url.protocol === 'https:' && approvedHost && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

function normalizeJourney(segmentId, segments, query, origin, destination, date) {
  if (typeof segmentId !== 'string') return null;
  const segment=segments.find(item=>item.SegmentId===segmentId);
  const legs=segment?.Legs;
  if(!Array.isArray(legs)||!legs.length)return null;
  const first=legs[0],last=legs.at(-1);
  if(first?.DepartureAirport?.Code!==origin||last?.ArrivalAirport?.Code!==destination||first?.DepartureDateTime?.slice(0,10)!==date)return null;
  for(let i=1;i<legs.length;i++)if(legs[i-1].ArrivalAirport?.Code!==legs[i].DepartureAirport?.Code)return null;
  const expectedCabin={economy:'ECONOMY',premium_economy:'PREMIUM_ECONOMY',business:'BUSINESS',first:'FIRST'}[query.cabin];
  if(legs.some(leg=>leg.CabinClass!==expectedCabin||typeof leg.FlightNumber!=='string'||!leg.FlightNumber.trim()||typeof leg.MarketingAirlineCode!=='string'||!/^[A-Z0-9]{2}$/.test(leg.MarketingAirlineCode)))return null;
  const airlines=[...new Set(legs.map(leg=>leg.MarketingAirlineName||leg.MarketingAirlineCode).filter(Boolean))];
  if(!airlines.length)return null;
  let previousArrival=null;
  for(const leg of legs){const departure=instant(leg.DepartureDateTime),arrival=instant(leg.ArrivalDateTime);if(departure===null||arrival===null||arrival<=departure||previousArrival!==null&&departure<previousArrival)return null;previousArrival=arrival;}
  const departure=first.DepartureDateTime,arrival=last.ArrivalDateTime,duration=(instant(arrival)-instant(departure))/60000;
  if(!Number.isInteger(duration)||duration<=0)return null;
  return {
    from:origin,to:destination,airlines,
    departureDate:departure.slice(0,10),departureTime:departure.slice(11,16),
    arrivalDate:arrival.slice(0,10),arrivalTime:arrival.slice(11,16),durationMinutes:duration,
    via:legs.slice(0,-1).map(leg=>leg.ArrivalAirport?.Code),
    segments:legs.map(leg=>({from:leg.DepartureAirport?.Code,to:leg.ArrivalAirport?.Code,departureAt:leg.DepartureDateTime,arrivalAt:leg.ArrivalDateTime,flightNumber:leg.FlightNumber,carrierCode:leg.MarketingAirlineCode,carrier:leg.MarketingAirlineName||leg.MarketingAirlineCode,marketing_carrier_code:leg.MarketingAirlineCode,flight_number:leg.FlightNumber,departure_airport:leg.DepartureAirport.Code,arrival_airport:leg.ArrivalAirport.Code,departure_time_local:leg.DepartureDateTime,arrival_time_local:leg.ArrivalDateTime})),
  };
}

function normalize(offer, data, query) {
  const roundTrip=query.tripType==='round-trip',ids=offer?.SegmentIds;
  // One group offer must link the requested outbound and return journeys together.
  if (!Array.isArray(ids) || ids.length !== (roundTrip?2:1) || new Set(ids).size!==ids.length) return null;
  const outbound=normalizeJourney(ids[0],data.Segments,query,query.origin,query.destination,query.date);
  const inbound=roundTrip?normalizeJourney(ids[1],data.Segments,query,query.destination,query.origin,query.returnDate):null;
  if(!outbound||roundTrip&&!inbound)return null;
  if(inbound&&instant(inbound.segments[0].departureAt)<instant(outbound.segments.at(-1).arrivalAt))return null;
  if(inbound&&query.childrenAges.includes(11)){
    const stayDays=(Date.parse(`${query.returnDate}T00:00:00Z`)-Date.parse(`${query.date}T00:00:00Z`))/86400000;
    if(stayDays>0)return null;
  }
  const money = offer?.OfferPrice?.TotalPrice;
  const amount = Number(money?.Value), currency = money?.Currency;
  const categories=offer?.OfferPrice?.PricePerPassengerCategory;
  const expected={ADULT:query.adults+query.childrenAges.filter(age=>age>=12).length,CHILD:query.childrenAges.filter(age=>age<12).length};
  const travelers= query.adults+query.childrenAges.length;
  const average=offer?.OfferPrice?.AveragePricePerTicket;
  const actual={};
  if(typeof offer.SplitTicket!=='boolean'||!Array.isArray(categories))return null;
  for(const row of categories){if(typeof row?.Category!=='string'||!Number.isInteger(row.Count)||row.Count<1||actual[row.Category]!==undefined)return null;actual[row.Category]=row.Count;}
  if(Object.keys(actual).some(category=>!['ADULT','ADULT_CHILD','CHILD'].includes(category))||(actual.ADULT??0)+(actual.ADULT_CHILD??0)!==expected.ADULT||(actual.CHILD??0)!==expected.CHILD)return null;
  if(average?.Count!==travelers||average.Currency!=='CAD'||(categories.some(row=>row.TotalPrice&&row.TotalPrice.Currency!=='CAD')))return null;
  if (!Number.isFinite(amount) || amount <= 0 || currency !== 'CAD' || offer.OpaqueFlight) return null;
  const sourceUrl = safeLink(offer.Links?.WebDetails?.Href);
  if (!sourceUrl) return null;
  const normalized={
    ...outbound,...(inbound?{inbound}:{}),
    provider: 'Expedia', source: 'Expedia Travel Redirect Flight Listings API', section: 'listings', observedAt: new Date().toISOString(),
    price: amount, currency, travelers: `${query.adults+query.childrenAges.filter(age=>age>=12).length} Expedia adult-fare passenger${query.adults+query.childrenAges.filter(age=>age>=12).length===1?'':'s'}${expected.CHILD?`, ${expected.CHILD} child-fare passenger${expected.CHILD===1?'':'s'} (${query.childrenAges.filter(age=>age<12).join(', ')})`:''}; child ages requested: ${query.childrenAges.join(', ')||'none'}`, cabin: query.cabin,
    airlines:[...new Set([...outbound.airlines,...(inbound?.airlines??[])])],sourceUrl,expediaOfferId: offer.offerToken,
    bookingStatus: `Expedia group offer${offer.SplitTicket?' with separate tickets':''}; final seller price not rechecked`,splitTicket:offer.SplitTicket,
    fees: 'Expedia-reported group total; verify fare rules and availability on Expedia',
  };
  normalized.expediaFlightSelection=selectionFor(normalized);
  return normalized;
}

export async function searchExpedia(input, options = {}) {
  const party=expediaParty(input);
  const origin = input?.origin, destination = input?.destination, date = input?.date;
  const adults = party.adults, childrenAges = party.childrenAges;
  const cabin = input?.cabin ?? 'economy';
  if (!iata(origin) || !iata(destination) || origin === destination || !validDate(date) || date < new Date().toISOString().slice(0, 10)) throw new Error('Expedia searches require different IATA airport codes and a valid future date.');
  if (!Number.isInteger(adults) || adults < 1 || adults > 6) throw new Error('Expedia supports at most six travelers and requires an adult.');
  if (!['economy', 'premium_economy', 'business', 'first'].includes(cabin)) throw new Error('Unsupported cabin class.');
  const tripType=input.tripType??'one-way';
  if(!['one-way','round-trip'].includes(tripType)||tripType==='round-trip'&&(!validDate(input.returnDate)||input.returnDate<date))throw new Error('Choose a valid Expedia trip type and return date.');
  if(options.selection!==undefined){
    const required=[['outbound',origin,destination,date]];if(tripType==='round-trip')required.push(['return',destination,origin,input.returnDate]);
    for(const [side,from,to,expectedDate] of required){
      const rows=options.selection?.[side];
      if(!Array.isArray(rows)||rows.length<1||rows.length>6||rows.some(row=>!Array.isArray(row)||row.length!==6||row.some(value=>typeof value!=='string'||value.length>40))||rows[0][0]!==from||rows.at(-1)[1]!==to||rows[0][4].slice(0,10)!==expectedDate)throw Error('Provide the exact previously observed Expedia flights for each direction.');
    }
    if(tripType==='one-way'&&options.selection.return!==undefined)throw Error('A one-way Expedia refresh cannot include a return selection.');
  }
  const credentials = config(options), url = new URL(API);
  const params = new URLSearchParams({ 'segment1.origin': origin, 'segment1.destination': destination, 'segment1.departureDate': date, adult: String(adults), cabinClass: cabin === 'premium_economy' ? 'premiumeconomy' : cabin, sortType: 'Price', limit: '100' });
  if(tripType==='round-trip')for(const [key,value] of [['origin',destination],['destination',origin],['departureDate',input.returnDate]])params.set(`segment2.${key}`,value);
  if (childrenAges.length) params.set('childrenAges', childrenAges.join(','));
  params.set('filterNonFlightOffers','true');params.set('filterNearByAirport','true');
  if(input.filters?.maxStops===0||input.filters?.maxStops===1)params.set('numberOfStops',String(input.filters.maxStops));
  url.search = params.toString();
  const response = await fetchSource('Expedia',url, { headers: {
    Accept: 'application/vnd.exp-flight.v3+json', Key: credentials.key, Authorization: credentials.authorization,
    'Partner-Transaction-Id': `TravelHunter-${(options.transactionId ?? randomUUID()).replace(/[^A-Za-z0-9-]/g, '')}`,
  } }, options);
  if (!response.ok) throw new Error(`Expedia request failed (HTTP ${response.status}).`);
  const data = await readBoundedSourceJson(response,{provider:'Expedia',maxBytes:10_000_000});
  if (!Array.isArray(data.Offers) || !Array.isArray(data.Segments)) throw new Error('Expedia returned an unexpected flight response.');
  const offers = data.Offers.map(offer => normalize(offer, data, { origin, destination, date, adults, childrenAges, cabin,tripType,...(tripType==='round-trip'?{returnDate:input.returnDate}:{}) })).filter(Boolean)
    .filter(offer=>options.selection===undefined||JSON.stringify(offer.expediaFlightSelection)===JSON.stringify(options.selection));
  return { offers, sources: [{ provider: 'Expedia', status: 'ok', received: data.Offers.length, accepted: offers.length }], observedAt: new Date().toISOString(), complete: false };
}

export { durationMinutes as expediaDurationMinutes };
