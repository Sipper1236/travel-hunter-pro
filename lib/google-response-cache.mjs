import {createHash} from 'node:crypto';
import {flightOfferError} from './flight-offer.mjs';
import {validateFilters} from './flight-filters.mjs';
import {googleOneWayUrl} from './google-round-trip.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {validateSearchParty} from './travelers.mjs';

export const GOOGLE_ONE_WAY_RESPONSE_CACHE_TTL_MS=60_000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

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
 return result.offers.every(offer=>offer?.provider==='Google Flights'&&offer.source==='Google Flights native one-way results-page observation'&&offer.travelers==='1 adult; Google page displayed one passenger'&&offer.sourceUrl===sourceUrl&&flightOfferError(offer,input,{now})===null&&quoteFreshness(offer,now).status==='fresh');
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
