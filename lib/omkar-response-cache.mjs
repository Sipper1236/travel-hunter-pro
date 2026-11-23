import {createHash} from 'node:crypto';
import {flightOfferError} from './flight-offer.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {validateFilters} from './flight-filters.mjs';
import {validateSearchParty} from './travelers.mjs';

export const OMKAR_RESPONSE_CACHE_TTL_MS=30_000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

/** Hash exact, supported Omkar pricing inputs without retaining its API key or raw query. */
export function omkarResponseCacheKey(input,{accountScope,apiKey}={}){
 if(input?.source!=='omkar-expedia'||!['one-way',undefined].includes(input.tripType)||input.returnDate!=null||input.travelers!==undefined)return null;
 if(['youths','seniors','infantsInLap','infantsInSeat','infantsOnLap','infantInLap','infantInSeat'].some(field=>input[field]!==undefined&&input[field]!==0))return null;
 try{
  const party=validateSearchParty(input),filters=validateFilters(input.filters);
  if(party.people||party.adults!==1||party.children!==0||party.infantsInSeat||party.infantsOnLap)return null;
  const effectiveApiKey=apiKey??process.env.OMKAR_API_KEY;
  const scope=accountScope??(effectiveApiKey?createHash('sha256').update(effectiveApiKey).digest('hex'):'no-configured-key');
  const identity={version:1,provider:'Expedia via Omkar',accountScope:scope,market:'CA',currency:'CAD',origin:input.origin,destination:input.destination,date:input.date,tripType:'one-way',adults:1,children:0,cabin:input.cabin??'economy',filters,originAirport:input.originAirport??null,destinationAirport:input.destinationAirport??null};
  if(!/^[A-Z]{3}$/.test(identity.origin)||identity.origin===identity.destination||!/^[A-Z]{3}$/.test(identity.destination)||typeof identity.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(identity.date)||!['economy','premium_economy','business','first'].includes(identity.cabin))return null;
  return createHash('sha256').update(JSON.stringify(canonical(identity))).digest('hex');
 }catch{return null;}
}

function resultIsFreshAndExact(result,input,now){
 if(!result||!Array.isArray(result.offers)||!result.offers.length||!Array.isArray(result.priceObservations)||result.priceObservations.length||!Array.isArray(result.sources)||!result.query)return false;
 let filters;try{filters=validateFilters(input.filters);}catch{return false;}
 const expected={origin:input.origin,destination:input.destination,date:input.date,cabin:input.cabin??'economy',tripType:'one-way',returnDate:null,adults:1,children:0,childrenAges:[],filters};
 if(JSON.stringify(canonical(result.query))!==JSON.stringify(canonical(expected)))return false;
 const source=result.sources.find(row=>row?.provider==='Expedia via Omkar');
 if(source?.status!=='ok'||source.accepted!==result.offers.length)return false;
 return result.offers.every(offer=>offer?.provider==='Expedia via Omkar'&&offer.source==='Omkar Expedia Scraper API'&&offer.section==='one-way'&&offer.travelers==='1 adult · provider scope: one-way per traveler'&&flightOfferError(offer,input,{now})===null&&quoteFreshness(offer,now).status==='fresh');
}

function cacheHit(result){return {...structuredClone(result),sources:result.sources.map(source=>source.provider==='Expedia via Omkar'?{...source,cacheStatus:'hit'}:source)};}

/** Reuse only fresh, exact, complete one-adult Omkar observations; retain original observation time. */
export async function searchOmkarWithCache(input,{cache,search,apiKey,now=Date.now}={}){
 if(typeof search!=='function')throw Error('An Omkar Expedia search function is required.');
 if(!cache)return search(input);
 const key=omkarResponseCacheKey(input,{apiKey}),at=now();
 if(!key)return search(input);
 const cached=cache.getProviderResponse(key,at);
 if(cached&&resultIsFreshAndExact(cached,input,at))return cacheHit(cached);
 if(cached)cache.deleteProviderResponse?.(key);
 const result=await search(input);
 if(!resultIsFreshAndExact(result,input,now()))return result;
 const expiresAt=Math.min(now()+OMKAR_RESPONSE_CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,now()).usableUntil));
 if(expiresAt>now())cache.setProviderResponse(key,result,expiresAt,now());
 return result;
}
