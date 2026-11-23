import {chromium} from 'playwright-core';
import {selectVacationLocation,vacationLocationSelection,typeVacationLocation} from './vacation-form.mjs';
import {getJobStore} from './job-store.mjs';
import {SourceRequestError,retryAfter} from './source-errors.mjs';
import {reserveBrowserSource} from './browser-source-policy.mjs';

let active=false;
const SUGGESTION_RESPONSE_MAX_BYTES=1_000_000;
const SUGGESTION_CACHE_TTL_MS=5*60_000,SUGGESTION_CACHE_MAX_ENTRIES=100;
const suggestionCache=new Map();
export async function readVacationSuggestionResponse(response,term,{maxBytes=SUGGESTION_RESPONSE_MAX_BYTES}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new TypeError('A positive suggestion response byte limit is required.');
 const declared=Number(response.headers?.()['content-length']);
 if(Number.isFinite(declared)&&declared>maxBytes)throw new SourceRequestError('Air Canada Vacations location suggestions exceeded their size limit.',{status:'invalid_response'});
 let body;
 try{body=await response.body();}catch{throw new SourceRequestError('Air Canada Vacations location suggestions could not be read.',{status:'invalid_response'});}
 if(!Buffer.isBuffer(body))body=Buffer.from(body);
 if(body.byteLength>maxBytes)throw new SourceRequestError('Air Canada Vacations location suggestions exceeded their size limit.',{status:'invalid_response'});
 let parsed;try{parsed=JSON.parse(body.toString('utf8'));}catch{throw new SourceRequestError('Air Canada Vacations location suggestions were not valid JSON.',{status:'invalid_response'});}
 return normalizeVacationSuggestions(parsed,term);
}
export function matchesVacationSuggestionUrl(value,kind,term){
 try{const u=new URL(value),journey=u.searchParams.get('journeyType');return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&u.hostname==='vacations-api.aircanada.com'&&u.pathname==='/geo-insight/suggestions'&&u.searchParams.get('query')?.toLocaleLowerCase()===term.toLocaleLowerCase()&&(kind==='from'?journey==='origin':journey===null||journey==='destination');}catch{return false;}
}
export function normalizeVacationSuggestions(body,term){
 if(!body||typeof body.term!=='string'||body.term.trim().toLocaleLowerCase()!==term.trim().toLocaleLowerCase()||!Array.isArray(body.suggestions))throw Error('Provider location suggestions did not match the requested text.');
 const seen=new Set(),items=[];
 for(const group of body.suggestions){
  if(!Array.isArray(group?.entities))continue;
  for(const entity of group.entities){
   if(typeof entity?.name!=='string'||entity.name.trim().length<3||entity.name.length>160||typeof entity.type!=='string'||!entity.type||seen.has(entity.name))continue;
   seen.add(entity.name);items.push({label:entity.name.trim(),type:entity.type,...(/^[A-Z]{3}$/.test(entity.code ?? '')?{code:entity.code}:{})});
   if(items.length===20)return {items,truncated:true};
  }
 }
 return {items,truncated:false};
}

function suggestionCacheKey(input,term){
 return JSON.stringify([input.kind,term.toLocaleLowerCase(),input.kind==='to'?(input.origin??'').toUpperCase():null,input.kind==='to'?input.originLabel.trim().toLocaleLowerCase():null]);
}
function readSuggestionCache(cache,key,at){
 for(const [entryKey,value] of cache)if(value.expiresAt<=at)cache.delete(entryKey);
 const value=cache.get(key);if(!value)return null;
 cache.delete(key);cache.set(key,value);return value;
}
function writeSuggestionCache(cache,key,value){
 for(const [entryKey,entry] of cache)if(entry.expiresAt<=value.storedAt)cache.delete(entryKey);
 cache.delete(key);cache.set(key,value);
 while(cache.size>SUGGESTION_CACHE_MAX_ENTRIES)cache.delete(cache.keys().next().value);
}

/** Read the widget's own public suggestion response in its original browser session. */
export async function lookupVacationSuggestions(input,{launch=options=>chromium.launch(options),signal,policy=getJobStore(),now=Date.now,cache=suggestionCache}={}){
 if(!input||!['from','to'].includes(input.kind)||typeof input.term!=='string'||input.term.trim().length<2||input.term.length>60||!/^[\p{L}\p{M}\p{N} .,'()-]+$/u.test(input.term))throw Error('Enter 2–60 characters for a package location.');
 if(input.kind==='to'&&(!/^[A-Z]{3}$/.test(input.origin ?? '')||typeof input.originLabel!=='string'||input.originLabel.length<3||input.originLabel.length>160))throw Error('Select a provider origin before looking up a destination.');
 const term=input.term.trim(),key=suggestionCacheKey(input,term),cached=readSuggestionCache(cache,key,now());
 if(cached){signal?.throwIfAborted();return {...cached.result,cached:true,cacheExpiresAt:new Date(cached.expiresAt).toISOString()};}
 signal?.throwIfAborted();if(active)throw Error('A package location lookup is already running.');active=true;
 let browser;const abort=()=>void browser?.close().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
 try{
  await reserveBrowserSource(policy,'Air Canada Vacations',{signal});
  browser=await launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:10000});signal?.throwIfAborted();
  const timeout=setTimeout(()=>void browser.close().catch(()=>{}),60000);timeout.unref();
  try{
   const page=await browser.newPage();await page.goto('https://vacations.aircanada.com/en/all-booking-options/flight-hotel/',{waitUntil:'domcontentloaded',timeout:30000});
   const field=page.locator(`#flight_hotel_tab-${input.kind}-input`);await field.waitFor({state:'visible',timeout:20000});
   const cookie=page.getByRole('button',{name:'Accept all',exact:true});if(await cookie.isVisible())await cookie.click();
   if(input.kind==='to')await selectVacationLocation(page,vacationLocationSelection({originLabel:input.originLabel},'from'));
   const response=page.waitForResponse(r=>matchesVacationSuggestionUrl(r.url(),input.kind,term),{timeout:20000}).catch(error=>({waitFailure:error.name}));
   await typeVacationLocation(field,term);
   const observed=await response;signal?.throwIfAborted();
   if(observed.waitFailure)throw Object.assign(Error(observed.waitFailure==='TimeoutError'?'Provider location suggestions timed out before a matching response arrived.':'Provider location suggestion browser wait failed.'),{code:observed.waitFailure==='TimeoutError'?'provider_suggestion_timeout':'provider_suggestion_wait_failed',status:502});
   if(!observed.ok()){
    const status=observed.status(),headers=observed.headers?.()??{},hint=retryAfter(headers['retry-after'],now());
    let retryAt=hint,state=status===429?'rate_limited':status===401?'auth':status===403?'blocked':'temporarily_unavailable';
    if(status===429)retryAt=Math.max(hint??0,now()+60000);
    if(status===401||status===403)retryAt=Math.max(hint??0,now()+300000);
    if(retryAt)policy?.deferSource('Air Canada Vacations',retryAt,state);
    const error=new SourceRequestError(`Provider location suggestions are temporarily unavailable (HTTP ${status}).`,{status:state,httpStatus:status,retryAt,providerCode:'provider_suggestion_refused'});error.code='provider_suggestion_refused';error.status=status===429?429:502;error.providerStatus=status;throw error;
   }
   const result={...await readVacationSuggestionResponse(observed,term),observedAt:new Date(now()).toISOString(),source:'Air Canada Vacations widget'};
   const storedAt=now(),expiresAt=storedAt+SUGGESTION_CACHE_TTL_MS;
   writeSuggestionCache(cache,key,{result,storedAt,expiresAt});
   return {...result,cached:false,cacheExpiresAt:new Date(expiresAt).toISOString()};
  }finally{clearTimeout(timeout);}
 }finally{signal?.removeEventListener('abort',abort);await browser?.close().catch(()=>{});active=false;}
}
