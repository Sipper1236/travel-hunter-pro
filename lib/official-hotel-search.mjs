import {discoverOfficialHotels,inspectOfficialHotel,readOfficialWebsite} from './official-hotels.mjs';
import {searchReservit} from './reservit.mjs';
import {sourceFailure,SOURCE_STOP_STATUSES} from './source-errors.mjs';
import {createHash} from 'node:crypto';
import {quoteFreshness} from './quote-freshness.mjs';
import {hotelWorkerResultError} from './hotel-worker-result.mjs';

const CACHE_TTL_MS=30_000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function officialHotelResponseCacheKey(query){
  if(!query||typeof query!=='object'||Array.isArray(query)||!query.destination)return null;
  try{const identity=structuredClone(query);delete identity.destination.observedAt;return createHash('sha256').update(JSON.stringify(canonical({version:1,source:'Official hotel / Reservit',market:'CA',currency:'CAD',query:identity}))).digest('hex');}catch{return null;}
}
function cacheable(result,query,now){
  if(!result||!Array.isArray(result.offers)||!result.offers.length||!Array.isArray(result.sourceResults)||!result.sourceResults.length||result.sourceResults.some(row=>!['observed','no_matching_observation'].includes(row?.status)))return false;
  if(hotelWorkerResultError(result,query,now))return false;
  return result.offers.every(offer=>quoteFreshness(offer,now).status==='fresh'&&(!Array.isArray(offer.roomQuotes)||offer.roomQuotes.every(room=>quoteFreshness({observedAt:room.observedAt},now).status==='fresh')));
}
function hit(result,query){return {...structuredClone(result),query:structuredClone(query),sourceResults:result.sourceResults.map(row=>({...row,cacheStatus:'hit'}))};}

export async function searchOfficialStays(query,{destination,signal,onProgress=()=>{},discover=discoverOfficialHotels,read=readOfficialWebsite,quote=searchReservit,providerCache,now=Date.now}={}){
  if(!destination)throw Error('A verified city/country is required for official hotel searches.');
  const input={...query,destination},offers=[],sourceResults=[];
  signal?.throwIfAborted();
  const cacheKey=providerCache?officialHotelResponseCacheKey(input):null,cacheAt=now();
  if(cacheKey){const cached=providerCache.getProviderResponse(cacheKey,cacheAt);if(cached&&cacheable(cached,input,cacheAt)){const result=hit(cached,input);onProgress({stage:'checking_official_hotel_sites',hotelsChecked:result.sourceResults.length,hotelsPlanned:result.discoveryCoverage?.checkedLimit??result.sourceResults.length,partialResult:result,cacheStatus:'hit'});return result;}if(cached)providerCache.deleteProviderResponse?.(cacheKey);}
  if(query.rooms!==1&&!query.roomAllocations)return {offers:[],query:input,received:0,rejected:0,sourceResults:[{provider:'Official hotel / Reservit',status:'unsupported',reason:'Enter a validated allocation for every room.'}],limitation:'No official rates were requested without room allocations.'};
  const listing=query.officialUrl?{candidates:[{website:query.officialUrl}],coverage:{source:'User-selected property website',discovered:1,checkedLimit:1}}:await discover(destination,{limit:query.officialLimit ?? 5,signal});
  const summarize=()=>({offers:[...offers],query:input,received:sourceResults.length,rejected:sourceResults.filter(row=>!['observed','no_matching_observation'].includes(row.status)).length,sourceResults:[...sourceResults],discoveryCoverage:listing.coverage,limitation:'Official-site observations from supported Reservit booking links only. Directory candidates and search limits are disclosed; unsupported websites are not priced. Direct totals may exclude taxes and do not identify a specific room/rate. Recheck prices, occupancy, cancellation terms and final availability on the property booking page.'});
  for(const candidate of listing.candidates){
    signal?.throwIfAborted();onProgress({stage:'checking_official_hotel_sites',hotelsChecked:sourceResults.length,hotelsPlanned:listing.candidates.length});
    try{
      const response=await read(candidate.website,{signal}),html=await response.text();signal?.throwIfAborted();
      const property=inspectOfficialHotel(html,{pageUrl:response.url || candidate.website,candidate,destination,minStars:query.minStars});
      const result=await quote(input,property,{signal});signal?.throwIfAborted();offers.push(...result.offers);sourceResults.push({provider:'Official hotel / Reservit',name:property.name,status:result.status,observations:result.offers.length,rateRequests:result.requests});
    }catch(error){
      signal?.throwIfAborted();const failure=sourceFailure('Official hotel website',error);sourceResults.push({...failure,name:candidate.name ?? new URL(candidate.website).hostname});
      if(SOURCE_STOP_STATUSES.includes(failure.status))break;
    }
    onProgress({stage:'checking_official_hotel_sites',hotelsChecked:sourceResults.length,hotelsPlanned:listing.candidates.length,partialResult:summarize()});
  }
  const result=summarize();
  if(cacheKey&&cacheable(result,input,now())){
    const savedAt=now(),expiresAt=Math.min(savedAt+CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,savedAt).usableUntil));
    if(expiresAt>savedAt)providerCache.setProviderResponse(cacheKey,result,expiresAt,savedAt);
  }
  return result;
}
