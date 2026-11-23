import {createHash} from 'node:crypto';
import {flightOfferError} from './flight-offer.mjs';
import {airportLocalMatchesInstant} from './airport-timezones.mjs';
import {validateFilters} from './flight-filters.mjs';
import {googleOneWayUrl} from './google-round-trip.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {googleRoundTripParty,validateSearchParty} from './travelers.mjs';
import {googleFlightSelection} from './google-round-trip.mjs';
import {elapsedJourneyMinutes} from './elapsed-duration.mjs';

export const GOOGLE_ONE_WAY_RESPONSE_CACHE_TTL_MS=60_000;
export const GOOGLE_ROUND_TRIP_RESPONSE_CACHE_TTL_MS=30_000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

function googleTimingEvidenceValid(offer){
 for(const leg of [offer,...(offer?.inbound?[offer.inbound]:[])]){
  if(elapsedJourneyMinutes(leg)!==leg?.durationMinutes)return false;
  for(const segment of leg.segments){
   const departure=Date.parse(segment.departure_time_utc),arrival=Date.parse(segment.arrival_time_utc);
   if(!Number.isFinite(departure)||!Number.isFinite(arrival)||arrival<=departure||!Number.isFinite(segment.durationMinutes)||arrival-departure!==segment.durationMinutes*60_000||!airportLocalMatchesInstant(segment.departure_time_local,segment.departure_time_utc,segment.departureTimeZone)||!airportLocalMatchesInstant(segment.arrival_time_local,segment.arrival_time_utc,segment.arrivalTimeZone))return false;
  }
 }
 return true;
}

/** Hash exact one-way pricing inputs without retaining traveler or query data in the key. */
export function googleOneWayResponseCacheKey(input){
 if(input?.source!=='google'||(input.tripType??'one-way')!=='one-way'||input.travelers!==undefined||(input.adults??1)!==1||(input.children??0)!==0||(input.cabin??'economy')!=='economy')return null;
 try{
  const party=validateSearchParty(input),filters=validateFilters(input.filters);
  if(party.people||party.adults!==1||party.children!==0||party.infantsInSeat||party.infantsOnLap)return null;
  const identity={version:1,provider:'Google Flights native one-way',locale:'en-CA',market:'CA',currency:'CAD',origin:input.origin,destination:input.destination,date:input.date,tripType:'one-way',adults:1,children:0,cabin:'economy',filters};
  if(!/^[A-Z]{3}$/.test(identity.origin)||!/^[A-Z]{3}$/.test(identity.destination)||identity.origin===identity.destination||typeof identity.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(identity.date))return null;
  return createHash('sha256').update(JSON.stringify(canonical(identity))).digest('hex');
 }catch{return null;}
}

function resultIsFreshAndExact(result,input,now){
 if(!result||!Array.isArray(result.offers)||result.offers.length===0||!Array.isArray(result.sources)||!result.query)return false;
 let filters;try{filters=validateFilters(input.filters);}catch{return false;}
 const expected={origin:input.origin,destination:input.destination,date:input.date,cabin:'economy',tripType:'one-way',returnDate:null,adults:1,children:0,childrenAges:[],filters};
 if(JSON.stringify(canonical(result.query))!==JSON.stringify(canonical(expected)))return false;
 const status=result.sources.find(row=>row?.provider==='Google Flights'&&row.operation===undefined);
 if(status?.status!=='ok'||status.accepted!==result.offers.length)return false;
 let sourceUrl;try{sourceUrl=googleOneWayUrl(input);}catch{return false;}
 return result.offers.every(offer=>offer?.provider==='Google Flights'&&offer.source==='Google Flights native one-way results-page observation'&&offer.travelers==='1 adult; Google page displayed one passenger'&&offer.sourceUrl===sourceUrl&&googleTimingEvidenceValid(offer)&&flightOfferError(offer,input,{now})===null&&quoteFreshness(offer,now).status==='fresh');
}

function cacheHit(result){
 return {...structuredClone(result),sources:result.sources.map(source=>source.provider==='Google Flights'&&source.operation===undefined?{...source,cacheStatus:'hit'}:source)};
}

/** Reuse only exact, fresh native one-way observations and retain source timestamps. */
export async function searchGoogleOneWayWithCache(input,{cache,search,now=Date.now}={}){
 if(typeof search!=='function')throw Error('A Google one-way search function is required.');
 if(!cache)return search(input);
 const key=googleOneWayResponseCacheKey(input),at=now();
 if(!key)return search(input);
 const cached=cache.getProviderResponse(key,at);
 if(cached&&resultIsFreshAndExact(cached,input,at))return cacheHit(cached);
 if(cached)cache.deleteProviderResponse?.(key);
 const result=await search(input);
 if(!resultIsFreshAndExact(result,input,now()))return result;
 const expiresAt=Math.min(now()+GOOGLE_ONE_WAY_RESPONSE_CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,now()).usableUntil));
 if(expiresAt>now())cache.setProviderResponse(key,result,expiresAt,now());
 return result;
}

/** Hash count-party round-trip pricing inputs; identified travelers are never cache eligible. */
export function googleRoundTripResponseCacheKey(input){
 if(input?.source!=='google'||input.tripType!=='round-trip'||input.travelers!==undefined||(input.cabin??'economy')!=='economy')return null;
 try{
  const party=googleRoundTripParty(input),filters=validateFilters(input.filters),counts=validateSearchParty(input);
  if(party.total!==counts.adults+counts.children)return null;
  const identity={version:1,provider:'Google Flights native selected round-trip',locale:'en-CA',market:'CA',currency:'CAD',origin:input.origin,destination:input.destination,date:input.date,returnDate:input.returnDate,adults:counts.adults,children:counts.children,childrenAges:[...counts.childrenAges],cabin:'economy',filters};
  if(!/^[A-Z]{3}$/.test(identity.origin)||!/^[A-Z]{3}$/.test(identity.destination)||identity.origin===identity.destination||![identity.date,identity.returnDate].every(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)))return null;
  return createHash('sha256').update(JSON.stringify(canonical(identity))).digest('hex');
 }catch{return null;}
}

function googleBookingUrl(value){
 try{const url=new URL(value);return url.origin==='https://www.google.com'&&url.pathname==='/travel/flights/booking'&&!url.username&&!url.password&&Boolean(url.searchParams.get('tfs'))&&Boolean(url.searchParams.get('tfu'))&&url.searchParams.get('curr')==='CAD'&&url.toString().length<=20_000&&[...url.searchParams.keys()].every(key=>['tfs','tfu','hl','gl','curr'].includes(key));}catch{return false;}
}

function roundTripIsFreshAndExact(result,input,now){
 if(!result||!Array.isArray(result.offers)||result.offers.length===0||!Array.isArray(result.sources)||!result.query)return false;
 let party,filters;try{party=validateSearchParty(input);googleRoundTripParty(input);filters=validateFilters(input.filters);}catch{return false;}
 const expected={origin:input.origin,destination:input.destination,date:input.date,cabin:'economy',tripType:'round-trip',returnDate:input.returnDate,adults:party.adults,children:party.children,childrenAges:party.childrenAges,filters};
 if(JSON.stringify(canonical(result.query))!==JSON.stringify(canonical(expected)))return false;
 const status=result.sources.find(row=>row?.provider==='Google Flights'&&row.operation===undefined);
 if(status?.status!=='ok'||status.accepted!==result.offers.length)return false;
 const googleParty=googleRoundTripParty(input),travelerLabel=`${googleParty.total} ${googleParty.total===1?'traveler':'travelers'}; source fare categories: ${googleParty.adults} adult${googleParty.adults===1?'':'s'}, ${googleParty.children} ${googleParty.children===1?'child':'children'}`;
 return result.offers.every(offer=>offer?.provider==='Google Flights'&&offer.source==='Google Flights native selected round-trip observation'&&offer.travelers===travelerLabel&&JSON.stringify(canonical(offer.googleParty))===JSON.stringify(canonical(googleParty))&&['online','phone'].includes(offer.googleBookingMode)&&typeof offer.googleSellerId==='string'&&offer.googleSellerId.length>0&&googleBookingUrl(offer.sourceUrl)&&JSON.stringify(canonical(offer.googleFlightSelection))===JSON.stringify(canonical(googleFlightSelection(offer)))&&googleTimingEvidenceValid(offer)&&flightOfferError(offer,input,{now})===null&&quoteFreshness(offer,now).status==='fresh');
}

export async function searchGoogleRoundTripWithCache(input,{cache,search,now=Date.now}={}){
 if(typeof search!=='function')throw Error('A Google round-trip search function is required.');
 if(!cache)return search(input);
 const key=googleRoundTripResponseCacheKey(input),at=now();
 if(!key)return search(input);
 const cached=cache.getProviderResponse(key,at);
 if(cached&&roundTripIsFreshAndExact(cached,input,at))return cacheHit(cached);
 if(cached)cache.deleteProviderResponse?.(key);
 const result=await search(input);
 if(!roundTripIsFreshAndExact(result,input,now()))return result;
 const expiresAt=Math.min(now()+GOOGLE_ROUND_TRIP_RESPONSE_CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,now()).usableUntil));
 if(expiresAt>now())cache.setProviderResponse(key,result,expiresAt,now());
 return result;
}
