import {createHash} from 'node:crypto';
import {flightOfferError} from './flight-offer.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {validateFilters} from './flight-filters.mjs';
import {validateSearchParty} from './travelers.mjs';

export const SKYSCANNER_RESPONSE_CACHE_TTL_MS=30_000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

/** Hash exact count-party Skyscanner pricing inputs; identified travelers never enter this cache. */
export function skyscannerResponseCacheKey(input,{apiKey=process.env.SKYSCANNER_API_KEY,maxPolls=8,pollIntervalMs=1000}={}){
 if(input?.source!=='skyscanner'||input.travelers!==undefined)return null;
 try{
  const party=validateSearchParty(input),filters=validateFilters(input.filters);
  if(party.people||party.infantsInSeat||party.infantsOnLap||party.adults<1||party.children&&(!Array.isArray(input.childrenAges)||input.childrenAges.length!==party.children))return null;
  if(!Number.isInteger(maxPolls)||maxPolls<0||maxPolls>8||!Number.isInteger(pollIntervalMs)||pollIntervalMs<1000||pollIntervalMs>10000)return null;
  const identity={version:1,provider:'Skyscanner Flights Live Prices API',accountScope:apiKey?createHash('sha256').update(apiKey).digest('hex'):'no-configured-key',market:'CA',currency:'CAD',locale:'en-CA',origin:input.origin,destination:input.destination,date:input.date,tripType:input.tripType??'one-way',returnDate:input.tripType==='round-trip'?input.returnDate:null,adults:party.adults,children:party.children,childrenAges:[...(input.childrenAges??[])],cabin:input.cabin??'economy',filters,maxPolls,pollIntervalMs};
  if(!/^[A-Z]{3}$/.test(identity.origin)||identity.origin===identity.destination||!/^[A-Z]{3}$/.test(identity.destination)||![identity.date,...(identity.tripType==='round-trip'?[identity.returnDate]:[])].every(validDate)||!['one-way','round-trip'].includes(identity.tripType)||identity.returnDate&&identity.returnDate<identity.date)return null;
  return createHash('sha256').update(JSON.stringify(canonical(identity))).digest('hex');
 }catch{return null;}
}

function resultIsFreshAndExact(result,input,now,{maxPolls,pollIntervalMs}={}){
 if(!result||!Array.isArray(result.offers)||result.offers.length===0||!Array.isArray(result.priceObservations)||result.priceObservations.length!==0||!Array.isArray(result.sources)||!result.query)return false;
 let party,filters;try{party=validateSearchParty(input);filters=validateFilters(input.filters);}catch{return false;}
 const expected={origin:input.origin,destination:input.destination,date:input.date,cabin:input.cabin??'economy',tripType:input.tripType??'one-way',returnDate:input.tripType==='round-trip'?input.returnDate:null,adults:party.adults,children:party.children,childrenAges:party.childrenAges,filters};
 if(JSON.stringify(canonical(result.query))!==JSON.stringify(canonical(expected)))return false;
 const source=result.sources.find(row=>row?.provider==='Skyscanner');
 if(source?.status!=='ok'||source.accepted!==result.offers.length||source.received<result.offers.length||!source.polling||source.polling.maxPolls!==maxPolls||source.polling.pollsRequested>maxPolls||source.polling.remainingPolls!==maxPolls-source.polling.pollsRequested)return false;
 return result.offers.every(offer=>offer?.provider==='Skyscanner'&&offer.source==='Skyscanner Flights Live Prices API'&&typeof offer.skyscannerSessionToken==='string'&&offer.skyscannerSessionToken.length>0&&typeof offer.skyscannerItineraryId==='string'&&offer.skyscannerItineraryId.length>0&&flightOfferError(offer,input,{now})===null&&quoteFreshness(offer,now).status==='fresh');
}

function cacheHit(result){return {...structuredClone(result),sources:result.sources.map(source=>source.provider==='Skyscanner'?{...source,cacheStatus:'hit'}:source)};}

/** Cache only complete, positive, exact Skyscanner observations for a short local reuse window. */
export async function searchSkyscannerWithCache(input,{cache,search,apiKey,maxPolls=8,pollIntervalMs=1000,now=Date.now}={}){
 if(typeof search!=='function')throw Error('A Skyscanner search function is required.');
 if(!cache)return search(input);
 const settings={apiKey,maxPolls,pollIntervalMs},key=skyscannerResponseCacheKey(input,settings),at=now();
 if(!key)return search(input);
 const cached=cache.getProviderResponse(key,at);
 if(cached&&resultIsFreshAndExact(cached,input,at,{maxPolls,pollIntervalMs}))return cacheHit(cached);
 if(cached)cache.deleteProviderResponse?.(key);
 const result=await search(input);
 if(!resultIsFreshAndExact(result,input,now(),{maxPolls,pollIntervalMs}))return result;
 const savedAt=now(),expiresAt=Math.min(savedAt+SKYSCANNER_RESPONSE_CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,savedAt).usableUntil));
 if(expiresAt>savedAt)cache.setProviderResponse(key,result,expiresAt,savedAt);
 return result;
}
