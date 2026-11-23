import {createHash} from 'node:crypto';
import {quoteFreshness} from './quote-freshness.mjs';
import {packageWorkerResultError} from './package-worker-result.mjs';
import {validateVacationQuery} from './vacation-query.mjs';

export const VACATION_RESPONSE_CACHE_TTL_MS=30_000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

export function vacationResponseCacheKey(input){
 try{
  const query=validateVacationQuery(input);
  return createHash('sha256').update(JSON.stringify(canonical({version:1,source:'Air Canada Vacations structured widget response',market:'CA',currency:'CAD',query}))).digest('hex');
 }catch{return null;}
}

function valid(result,input,now){
 if(!result||result.status!=='observed'||!Array.isArray(result.offers)||result.offers.length===0||result.coverage?.mode!=='structured_widget_response'||result.coverage.pageLoadStopped)return false;
 if(packageWorkerResultError(result,input,now))return false;
 return result.offers.every(offer=>quoteFreshness(offer,now).status==='fresh');
}

/** Reuse only fresh, exact positive results from the ACV structured package-search widget. */
export async function searchVacationWithCache(input,{cache,search,now=Date.now,onProgress=()=>{},signal}={}){
 if(typeof search!=='function')throw Error('An Air Canada Vacations search function is required.');
 signal?.throwIfAborted();
 if(!cache)return search(input,{signal,onProgress});
 const query=validateVacationQuery(input),key=vacationResponseCacheKey(input),at=now();
 if(!key)return search(input,{signal,onProgress});
 const cached=cache.getProviderResponse(key,at);
 if(cached&&valid(cached,query,at)){
  const result={...structuredClone(cached),cacheStatus:'hit'};
  onProgress({stage:'validating_structured_package_results',cacheStatus:'hit',partialResult:result});
  return result;
 }
 if(cached)cache.deleteProviderResponse?.(key);
 const result=await search(input,{signal,onProgress});
 if(!valid(result,query,now()))return result;
 const savedAt=now(),expiresAt=Math.min(savedAt+VACATION_RESPONSE_CACHE_TTL_MS,...result.offers.map(offer=>quoteFreshness(offer,savedAt).usableUntil));
 if(expiresAt>savedAt)cache.setProviderResponse(key,result,expiresAt,savedAt);
 return result;
}
