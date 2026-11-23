import {quoteFreshness} from './quote-freshness.mjs';
const code = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const time = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export function connectionAirports(leg){
  const segments=leg?.segments;
  if(Array.isArray(segments)&&segments.length&&segments.some(segment=>segment?.departure_airport!==undefined||segment?.arrival_airport!==undefined||segment?.from!==undefined||segment?.to!==undefined)){
    const airports=segments.map(segment=>({from:segment?.departure_airport??segment?.from,to:segment?.arrival_airport??segment?.to}));
    if(airports.some((airport,index)=>!code(airport.from)||!code(airport.to)||index>0&&airports[index-1].to!==airport.from))return null;
    return airports.slice(0,-1).map(airport=>airport.to);
  }
  return Array.isArray(leg?.via)&&leg.via.every(code)?leg.via:null;
}

function hasUtcChronology(leg){
 const segments=leg?.segments;
 if(!Array.isArray(segments)||!segments.length)return false;
 return segments.every((segment,index)=>{
  const departure=segment.departure_time_utc,arrival=segment.arrival_time_utc;
  return typeof departure==='string'&&departure.endsWith('Z')&&typeof arrival==='string'&&arrival.endsWith('Z')&&Number.isFinite(Date.parse(departure))&&Date.parse(arrival)>Date.parse(departure)&&(!index||Date.parse(departure)>=Date.parse(segments[index-1].arrival_time_utc));
 });
}

function legError(leg, from, to, departureDate) {
  if (!leg || !code(leg.from) || !code(leg.to) || (code(from) && leg.from !== from) || (code(to) && leg.to !== to)) return 'route';
  if (!date(leg.departureDate) || leg.departureDate !== departureDate || !date(leg.arrivalDate) || leg.arrivalDate < leg.departureDate && !hasUtcChronology(leg) || !time(leg.departureTime) || !time(leg.arrivalTime)) return 'travel_time';
  if (leg.durationMinutes !== null && (!Number.isFinite(leg.durationMinutes) || leg.durationMinutes <= 0)) return 'duration';
  if (!Array.isArray(leg.via) || !leg.via.every(code)) return 'connections';
  const actual=connectionAirports(leg);
  if(actual===null||actual.length!==leg.via.length||actual.some((airport,index)=>airport!==leg.via[index]))return 'connections';
  // A route summary alone is not an itinerary. Require each priced leg to retain
  // the provider's actual flight segments before it can be shown as an offer.
  if (!Array.isArray(leg.segments) || leg.segments.length < 1 || leg.segments.length > 16) return 'segments';
  const endpoint = (segment, side) => side === 'from'
    ? segment?.departure_airport ?? segment?.from
    : segment?.arrival_airport ?? segment?.to;
  const flightNumber = segment => segment?.flight_number ?? segment?.flightNumber;
  const carrier = segment => segment?.marketing_carrier_code ?? segment?.carrierCode ?? segment?.marketing_carrier_name ?? segment?.carrier;
  const stamp = (segment, side, {allowUtc = false} = {}) => {
    const values = side === 'departure'
      ? [segment?.departure_time_local, segment?.departureAt, ...(allowUtc ? [segment?.departure_time_utc] : [])]
      : [segment?.arrival_time_local, segment?.arrivalAt, ...(allowUtc ? [segment?.arrival_time_utc] : [])];
    return values.find(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?$/.test(value));
  };
  const segmentAirports = leg.segments.map(segment => ({from: endpoint(segment, 'from'), to: endpoint(segment, 'to')}));
  if (segmentAirports.some((segment, index) => !code(segment.from) || !code(segment.to) || index > 0 && segmentAirports[index - 1].to !== segment.from)) return 'segments';
  if (segmentAirports[0].from !== leg.from || segmentAirports.at(-1).to !== leg.to) return 'segments';
  if (leg.segments.some(segment => !text(flightNumber(segment)) || !text(carrier(segment)) || !stamp(segment, 'departure', {allowUtc: true}) || !stamp(segment, 'arrival', {allowUtc: true}))) return 'segments';
  const firstDeparture = stamp(leg.segments[0], 'departure'), lastArrival = stamp(leg.segments.at(-1), 'arrival');
  if (firstDeparture && (firstDeparture.slice(0, 10) !== leg.departureDate || firstDeparture.slice(11, 16) !== leg.departureTime) || lastArrival && (lastArrival.slice(0, 10) !== leg.arrivalDate || lastArrival.slice(11, 16) !== leg.arrivalTime)) return 'segments';
  return null;
}

/** Validate source observations without filling missing evidence from the query. */
export function flightOfferError(offer, query, {now = Date.now()} = {}) {
  if (!offer || typeof offer !== 'object') return 'offer';
  if (!Number.isFinite(offer.price) || offer.price <= 0 || offer.currency !== 'CAD') return 'price';
  if (!text(offer.provider) || !text(offer.source) || !text(offer.travelers) || !text(offer.bookingStatus) || !text(offer.fees)) return 'provenance';
  if (typeof offer.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(offer.observedAt) || !Number.isFinite(Date.parse(offer.observedAt))) return 'quote_time';
  if (quoteFreshness(offer, now).status !== 'fresh') return 'quote_freshness';
  if (!['economy','premium_economy','business','first'].includes(offer.cabin) || offer.cabin !== (query.cabin ?? 'economy')) return 'cabin';
  if (!Array.isArray(offer.airlines) || !offer.airlines.length || !offer.airlines.every(text)) return 'airlines';
  if (offer.sourceUrl != null) {
    try { const url = new URL(offer.sourceUrl); if (url.protocol !== 'https:' || url.username || url.password) return 'source_url'; }
    catch { return 'source_url'; }
  }
  const outboundError = legError(offer, query.origin, query.destination, query.date);
  if (outboundError) return outboundError;
  if (query.tripType === 'round-trip') return legError(offer.inbound, offer.to, offer.from, query.returnDate);
  if (offer.inbound) return 'unexpected_return';
  return null;
}
