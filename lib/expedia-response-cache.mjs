import {createHash} from 'node:crypto';
import {flightOfferError} from './flight-offer.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {validateFilters} from './flight-filters.mjs';
import {validateSearchParty} from './travelers.mjs';

export const EXPEDIA_RESPONSE_CACHE_TTL_MS=30_000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

/** Hash the partner credential pair and exact supported Expedia pricing inputs. */
export function expediaResponseCacheKey(input,{apiKey=process.env.EXPEDIA_TRAVEL_REDIRECT_KEY,authorization=process.env.EXPEDIA_TRAVEL_REDIRECT_AUTHORIZATION}={}){
 if(input?.source!=='expedia'||input.travelers!==undefined||!apiKey||!authorization)return null;
 try{
  const party=validateSearchParty(input),filters=validateFilters(input.filters),tripType=input.tripType??'one-way';
  if(party.people||party.infantsInSeat||party.infantsOnLap||party.children&&(!Array.isArray(input.childrenAges)||input.childrenAges.length!==party.children)||!['one-way','round-trip'].includes(tripType))return null;
  const dates=[input.date,...(tripType==='round-trip'?[input.returnDate]:[])];
  if(dates.some(value=>typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(`${value}T00:00:00Z`))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)||tripType==='round-trip'&&input.returnDate<input.date)return null;
  const credentialScope=createHash('sha256').update(`${apiKey}\0${authorization}`).digest('hex');
  const identity={version:1,provider:'Expedia Travel Redirect Flight Listings API',credentialScope,market:'CA',currency:'CAD',origin:input.origin,destination:input.destination,date:input.date,tripType,returnDate:tripType==='round-trip'?input.returnDate:null,adults:party.adults,children:party.children,childrenAges:[...(input.childrenAges??[])],cabin:input.cabin??'economy',filters};
  if(!/^[A-Z]{3}$/.test(identity.origin)||identity.origin===identity.destination||!/^[A-Z]{3}$/.test(identity.destination))return null;
  return createHash('sha256').update(JSON.stringify(canonical(identity))).digest('hex');
 }catch{return null;}
}

function selectionMatches(offer){
 const expected=Object.fromEntries([['outbound',offer],['return',offer.inbound]].filter(([,leg])=>leg).map(([side,leg])=>[side,leg.segments.map(segment=>[segment.from,segment.to,segment.carrierCode,segment.flightNumber,segment.departureAt,segment.arrivalAt])]));
 return JSON.stringify(canonical(offer.expediaFlightSelection))===JSON.stringify(canonical(expected));
}
const safeExpediaLink=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&['expedia.com','expedia.ca'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`));}catch{return false;}};

function resultIsFreshAndExact(result,input,now){
 if(!result||!Array.isArray(result.offers)||result.offers.length===0||!Array.isArray(result.priceObservations)||result.priceObservations.length!==0||!Array.isArray(result.sources)||!result.query)return false;
 let party,filters;try{party=validateSearchParty(input);filters=validateFilters(input.filters);}catch{return false;}
 const expected={origin:input.origin,destination:input.destination,date:input.date,cabin:input.cabin??'economy',tripType:input.tripType??'one-way',returnDate:input.tripType==='round-trip'?input.returnDate:null,adults:party.adults,children:party.children,childrenAges:party.childrenAges,filters};
 if(JSON.stringify(canonical(result.query))!==JSON.stringify(canonical(expected)))return false;
 const source=result.sources.find(row=>row?.provider==='Expedia');
 if(source?.status!=='ok'||source.accepted!==result.offers.length||source.received<result.offers.length)return false;
 return result.offers.every(offer=>offer?.provider==='Expedia'&&offer.source==='Expedia Travel Redirect Flight Listings API'&&offer.section==='listings'&&typeof offer.expediaOfferId==='string'&&offer.expediaOfferId.length>0&&typeof offer.splitTicket==='boolean'&&safeExpediaLink(offer.sourceUrl)&&selectionMatches(offer)&&flightOfferError(offer,input,{now})===null&&quoteFreshness(offer,now).status==='fresh');
}

function cacheHit(result){return {...structuredClone(result),sources:result.sources.map(source=>source.provider==='Expedia'?{...source,cacheStatus:'hit'}:source)};}

/** Reuse only short-lived exact Expedia partner observations, never a seller refresh. */
export async function searchExpediaWithCache(input,{cache,search,apiKey,authorization,now=Date.now}={}){
 if(typeof search!=='function')throw Error('An Expedia search function is required.');
 if(!cache)return search(input);
 const key=expediaResponseCacheKey(input,{apiKey,authorization}),at=now();
 if(!key)return search(input);
 const cached=cache.getProviderResponse(key,at);
 if(cached&&resultIsFreshAndExact(cached,input,at))return cacheHit(cached);
 if(cached)cache.deleteProviderResponse?.(key);
 const result=await search(input);
 if(!resultIsFreshAndExact(result,input,now()))return result;
 const savedAt=now(),expiresAt=Math.min(savedAt+EXPEDIA_RESPONSE_CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,savedAt).usableUntil));
 if(expiresAt>savedAt)cache.setProviderResponse(key,result,expiresAt,savedAt);
 return result;
}
