import {createHash} from 'node:crypto';
import {flightOfferError} from './flight-offer.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {validateFilters} from './flight-filters.mjs';
import {validateSearchParty} from './travelers.mjs';

export const IGNAV_RESPONSE_CACHE_TTL_MS=5*60*1000;

/** Hash only pricing inputs; never store a raw query or traveler identity in the cache key. */
export function ignavResponseCacheKey(input,{market='CA',currency='CAD',accountScope}={}){
 if(input?.source!=='ignav'||input.travelers||input.infantsInSeat||input.infantsOnLap||input.infantSeating)return null;
 try{
  const party=validateSearchParty(input);
  if(party.people||party.infantsInSeat||party.infantsOnLap)return null;
  if(party.children&&(!Array.isArray(input.childrenAges)||input.childrenAges.length!==party.children||input.childrenAges.some(age=>!Number.isInteger(age)||age<2||age>17)))return null;
  const filters=validateFilters(input.filters);
  const configuredScope=accountScope??(process.env.IGNAV_API_KEY?createHash('sha256').update(process.env.IGNAV_API_KEY).digest('hex'):'no-configured-key');
  const identity={version:1,provider:'Ignav',accountScope:configuredScope,market,currency,origin:input.origin,destination:input.destination,date:input.date,tripType:input.tripType??'one-way',returnDate:input.tripType==='round-trip'?input.returnDate:null,adults:party.adults,children:party.children,childrenAges:[...(input.childrenAges??[])],cabin:input.cabin??'economy',filters};
  if(!/^[A-Z]{3}$/.test(identity.origin)||!/^[A-Z]{3}$/.test(identity.destination)||typeof identity.date!=='string')return null;
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
 }catch{return null;}
}

function resultIsFreshAndExact(result,input,now){
 if(!result||!Array.isArray(result.offers)||result.offers.length===0||!Array.isArray(result.sources))return false;
 const source=result.sources.find(row=>row.provider==='Ignav');
 if(source?.status!=='ok'||source.accepted!==result.offers.length)return false;
 return result.offers.every(offer=>flightOfferError(offer,input,{now})===null&&quoteFreshness(offer,now).status==='fresh');
}

function cacheHit(result){
 return {...structuredClone(result),sources:result.sources.map(source=>source.provider==='Ignav'?{...source,cacheStatus:'hit'}:source)};
}

/** Reuse only fresh, complete, exact count-party Ignav results and retain original observedAt values. */
export async function searchIgnavWithCache(input,{cache,search,now=Date.now}={}){
 if(typeof search!=='function')throw Error('An Ignav search function is required.');
 if(!cache)return search(input);
 const key=ignavResponseCacheKey(input),at=now();
 if(!key)return search(input);
 const cached=cache.getProviderResponse(key,at);
 if(cached&&resultIsFreshAndExact(cached,input,at))return cacheHit(cached);
 const result=await search(input);
 if(!resultIsFreshAndExact(result,input,now()))return result;
 const expiresAt=Math.min(now()+IGNAV_RESPONSE_CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,now()).usableUntil));
 if(expiresAt>now())cache.setProviderResponse(key,result,expiresAt,now());
 return result;
}
