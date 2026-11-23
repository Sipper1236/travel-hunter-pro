import {chromium} from 'playwright-core';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {googleRoundTripParty,googleDirectionCandidates,normalizeGoogleRoundTrip,normalizeGoogleOneWay,googleOneWayUrl,parseGoogleRpcFrames} from './google-round-trip.mjs';
import {airportTimezones} from './airport-timezones.mjs';
import {applyFlightFilters,validateFilters} from './flight-filters.mjs';
import {SourceRequestError,retryAfter} from './source-errors.mjs';
import {getJobStore} from './job-store.mjs';

const home='https://www.google.com/travel/flights?hl=en-CA&gl=CA&curr=CAD';
const service='/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/';
const scope='At most three eligible outbound choices per exact query, stopping at the first complete matching return; each direction list examines at most 80 returned rows. This is a bounded observation, not an exhaustive Google minimum. Browser assets and RPCs are additional to the logical search budget and are outside shared HTTP transport counters.';
const rpcLatencyNames=['0_100','100_250','250_500','500_1000','1000_2500','2500_5000','5000_10000','10000_30000','30000_plus'];
const rpcLatencyLimits=[100,250,500,1000,2500,5000,10000,30000,Infinity];
const newRpcLatency=()=>({samples:0,totalMs:0,maxMs:0,buckets:Object.fromEntries(rpcLatencyNames.map(name=>[name,0]))});
const rpcLatencyP95=value=>{if(!value.samples)return null;const target=Math.ceil(value.samples*.95);let count=0;for(let i=0;i<rpcLatencyNames.length;i++){count+=value.buckets[rpcLatencyNames[i]];if(count>=target)return Number.isFinite(rpcLatencyLimits[i])?rpcLatencyLimits[i]:null;}return null;};
const addRpcLatency=(value,duration)=>{const ms=Math.max(0,Math.round(duration)),index=rpcLatencyLimits.findIndex(limit=>ms<=limit);value.samples++;value.totalMs+=ms;value.maxMs=Math.max(value.maxMs,ms);value.buckets[rpcLatencyNames[index<0?rpcLatencyNames.length-1:index]]++;};
const isRpc=(value,name)=>{try{const url=value instanceof URL?value:new URL(typeof value==='string'?value:value.url());return url.origin==='https://www.google.com'&&url.pathname===service+name;}catch{return false;}};
const fingerprint=leg=>JSON.stringify(leg.segments.map(segment=>[segment.from,segment.to,segment.marketing_carrier_code,segment.flight_number,segment.departureAt,segment.arrivalAt]));
const explicitNoResults=/no flights found|no results found|couldn.t find any flights/i;

/** Read-only one-way results-page flow; returns exact segment observations, never seller confirmation. */
export async function searchGoogleOneWay(input,options={}){
 input={...input,tripType:input?.tripType??'one-way'};
 const filters=validateFilters(input.filters);
 if(input?.tripType!=='one-way'||input.travelers!==undefined||(input.adults??1)!==1||(input.children??0)!==0||(input.cabin??'economy')!=='economy')throw new SourceRequestError('Google native one-way search supports one adult in economy only.',{status:'unsupported_party'});
 const url=googleOneWayUrl(input),timeoutMs=options.timeoutMs??30000;
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>45000)throw Error('Google native query timeout must be at most 45 seconds.');
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs),policy=options.policy===undefined?getJobStore():options.policy;
 const coverage={scope:'One Google results-page response for one exact airport/date query; at most 80 returned rows are normalized. This is not exhaustive market coverage or seller confirmation.',nativeRpcRequests:0,nativeRpcResponses:0,maxNativeRpcRequests:1,resultRows:0,validatedCandidates:0,nativeRpcLatency:newRpcLatency()};
 let browser,page,stage='starting',upstreamFailure;const closeOnAbort=()=>{void browser?.close().catch(()=>{});};signal.addEventListener('abort',closeOnAbort,{once:true});
 const refusal=async(status,headers)=>{if(status<400)return;const state=status===429?'rate_limited':status===401?'auth':status===403?'blocked':status>=500?'temporarily_unavailable':'error';const at=retryAfter(headers?.['retry-after'])??(status===429?Date.now()+60000:[401,403].includes(status)?Date.now()+300000:undefined);if(at)policy?.deferSource('Google Flights',at,state);throw new SourceRequestError(`Google native flight request failed (HTTP ${status}).`,{status:state,httpStatus:status,retryAt:at});};
 const check=async()=>{signal.throwIfAborted();if(upstreamFailure)throw upstreamFailure;const body=await page.locator('body').innerText();if(/unusual traffic|verify (?:that )?you(?:’|')?re (?:a )?human|not a robot|captcha|before you continue to google/i.test(body)){const at=Date.now()+300000;policy?.deferSource('Google Flights',at,'blocked');throw new SourceRequestError('Google requires a human access or consent check. Native search stopped.',{status:'blocked',retryAt:at});}};
 try{
  signal.throwIfAborted();
  if(policy)for(;;){const slot=policy.reserveSource('Google Flights',1000);if(slot.blockedUntil)throw new SourceRequestError('Google Flights is cooling down after an access or rate refusal.',{status:slot.status,retryAt:slot.blockedUntil});if(!slot.waitMs)break;await delay(slot.waitMs,undefined,{signal});}
  stage='timezones';const timezones=await (options.loadTimezones??airportTimezones)({signal});signal.throwIfAborted();
  stage='browser';browser=await (options.browserFactory??(()=>chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:Math.min(15000,timeoutMs)})))();signal.throwIfAborted();
  page=await browser.newPage();page.setDefaultTimeout(Math.min(15000,timeoutMs));
  let requestCount=0;await page.route(requestUrl=>isRpc(requestUrl,'GetShoppingResults'),async route=>{if(++requestCount>coverage.maxNativeRpcRequests){upstreamFailure=new SourceRequestError('Google native one-way query reached its one-request bound.',{status:'invalid_response',providerCode:'native_request_bound'});await route.abort();return;}coverage.nativeRpcRequests++;await route.fallback();});
  stage='results';const started=performance.now();const responsePromise=page.waitForResponse(response=>isRpc(response,'GetShoppingResults'),{timeout:timeoutMs});void responsePromise.catch(()=>null);
  const documentResponse=await page.goto(url,{waitUntil:'domcontentloaded',timeout:timeoutMs});await refusal(documentResponse.status(),documentResponse.headers());await check();
  const noResultsPromise=page.getByRole('main').getByText(explicitNoResults).waitFor({state:'visible',timeout:timeoutMs}).then(()=>({type:'no-results'}),()=>null);
  const firstEvidence=await Promise.race([responsePromise.then(response=>({type:'response',response})),noResultsPromise]);
  if(firstEvidence?.type==='no-results'){
   await check();const actualUrl=new URL(page.url());
   if(actualUrl.origin!=='https://www.google.com'||actualUrl.pathname!=='/travel/flights'||actualUrl.href!==new URL(url).href)throw new SourceRequestError('Google did not retain the exact one-way results page.',{status:'invalid_response'});
   const currencyLabel=await page.getByRole('button',{name:'Currency CAD',exact:true}).getAttribute('aria-label');
   const partyLabel=await page.getByRole('button',{name:/^1 passenger,/}).getAttribute('aria-label');
   if(currencyLabel!=='Currency CAD'||!/^1 passenger(?:,|$)/.test(partyLabel??''))throw new SourceRequestError('Google did not confirm the exact one-adult CAD query.',{status:'invalid_response'});
   coverage.noResultsConfirmed=true;
   const reason='Google explicitly displayed no matching flights for the exact one-adult CAD query. This is a bounded source observation, not exhaustive market coverage.';
   return {query:input,observedAt:new Date().toISOString(),offers:[],priceObservations:[],filterCoverage:{},sources:[{provider:'Google Flights',status:'ok',received:0,accepted:0,nativeCoverage:structuredClone(coverage),reason}],complete:true,limitations:[reason]};
  }
  const response=firstEvidence.response;await refusal(response.status(),response.headers());await check();coverage.nativeRpcResponses=1;
  const raw=await response.text();if(Buffer.byteLength(raw)>8_000_000)throw new SourceRequestError('Google native one-way results exceeded the 8 MB response limit.',{status:'invalid_response'});
  let actualUrl;try{actualUrl=new URL(page.url());}catch{throw new SourceRequestError('Google did not retain the exact one-way results page.',{status:'invalid_response'});}
  if(actualUrl.origin!=='https://www.google.com'||actualUrl.pathname!=='/travel/flights'||actualUrl.href!==new URL(url).href)throw new SourceRequestError('Google did not retain the exact one-way results page.',{status:'invalid_response'});
  const currencyLabel=await page.getByRole('button',{name:'Currency CAD',exact:true}).getAttribute('aria-label');
  const partyLabel=await page.getByRole('button',{name:/^1 passenger,/}).getAttribute('aria-label');
  const pageText=await page.getByRole('main').innerText();
  if(explicitNoResults.test(pageText)){
   if(currencyLabel!=='Currency CAD'||!/^1 passenger(?:,|$)/.test(partyLabel??''))throw new SourceRequestError('Google did not confirm the exact one-adult CAD query.',{status:'invalid_response'});
   coverage.resultRows=0;coverage.validatedCandidates=0;coverage.noResultsConfirmed=true;addRpcLatency(coverage.nativeRpcLatency,performance.now()-started);coverage.nativeRpcLatency.p95UpperBoundMs=rpcLatencyP95(coverage.nativeRpcLatency);
   const reason='Google explicitly displayed no matching flights for the exact one-adult CAD query. This is a bounded source observation, not exhaustive market coverage.';
   return {query:input,observedAt:new Date().toISOString(),offers:[],priceObservations:[],filterCoverage:{},sources:[{provider:'Google Flights',status:'ok',received:0,accepted:0,nativeCoverage:structuredClone(coverage),reason}],complete:true,limitations:[reason]};
  }
  await page.getByRole('heading',{name:/search results|departing flights/i}).waitFor();
  stage='normalization';const normalized=normalizeGoogleOneWay(raw,input,{timezones,evidence:{currencyLabel,partyLabel,sourceUrl:actualUrl.href}});
  coverage.resultRows=normalized.received;coverage.validatedCandidates=normalized.candidates;coverage.partial=normalized.partial;addRpcLatency(coverage.nativeRpcLatency,performance.now()-started);coverage.nativeRpcLatency.p95UpperBoundMs=rpcLatencyP95(coverage.nativeRpcLatency);
  const filtered=await applyFlightFilters(normalized.offers,filters,options.filterOptions);
  const source={provider:'Google Flights',status:'ok',received:normalized.received,accepted:filtered.offers.length,nativeCoverage:structuredClone(coverage),reason:normalized.limitation,...(normalized.received>normalized.candidates?{rejected:normalized.received-normalized.candidates}:{})};
  if(filtered.offers.length<normalized.offers.length)source.filterRejected=normalized.offers.length-filtered.offers.length;
  return {query:input,observedAt:normalized.observedAt,offers:filtered.offers,priceObservations:[],filterCoverage:filtered.rejected,sources:[source],complete:true,limitations:[normalized.limitation]};
 }catch(error){
  await options.onFailure?.({stage,error});if(options.signal?.aborted)throw options.signal.reason;
  if(upstreamFailure)throw upstreamFailure;if(error instanceof SourceRequestError)throw error;
  if(signal.aborted)throw new SourceRequestError(`Google native one-way query exceeded its ${timeoutMs/1000}-second deadline.`,{status:'temporarily_unavailable',providerCode:'native_query_timeout'});
  throw new SourceRequestError(`Google native one-way workflow did not produce complete evidence (${stage}).`,{status:'invalid_response',providerCode:'native_one_way_evidence_incomplete'});
 }finally{signal.removeEventListener('abort',closeOnAbort);await browser?.close().catch(()=>{});}
}

/** Read-only native return flow. Never follows seller continuations or creates an order. */
export async function searchGoogleRoundTrip(input,options={}){
 const party=googleRoundTripParty(input),filters=validateFilters(input.filters);
 if(!/^[A-Z]{3}$/.test(input.origin??'')||!/^[A-Z]{3}$/.test(input.destination??'')||input.origin===input.destination||input.date<new Date().toISOString().slice(0,10))throw Error('Choose different exact airports and a future departure date.');
 const timeoutMs=options.timeoutMs??45000;
 if(options.selection!==undefined){
  for(const [side,from,to,date] of [['outbound',input.origin,input.destination,input.date],['return',input.destination,input.origin,input.returnDate]]){
   const rows=options.selection?.[side];
   if(!Array.isArray(rows)||rows.length<1||rows.length>6||rows.some(row=>!Array.isArray(row)||row.length!==6||row.some(value=>typeof value!=='string'||value.length>40))||rows[0][0]!==from||rows.at(-1)[1]!==to||rows[0][4].slice(0,10)!==date)throw Error('Provide the exact observed Google flights for both directions.');
  }
 }
 let bookingUrl;
 if(options.bookingUrl!==undefined){
  if(options.selection===undefined)throw Error('Exact originally observed Google flights are required for booking-page refresh.');
  try{
   bookingUrl=new URL(options.bookingUrl);
   if(bookingUrl.origin!=='https://www.google.com'||bookingUrl.pathname!=='/travel/flights/booking'||bookingUrl.username||bookingUrl.password||bookingUrl.toString().length>20000||!bookingUrl.searchParams.get('tfs')||!bookingUrl.searchParams.get('tfu')||bookingUrl.searchParams.get('curr')!=='CAD'||[...bookingUrl.searchParams.keys()].some(key=>!['tfs','tfu','hl','gl','curr'].includes(key)))throw Error();
  }catch{throw Error('Provide the original Google booking page for an exact itinerary refresh.');}
 }
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>45000)throw Error('Google native query timeout must be at most 45 seconds.');
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
 const policy=options.policy===undefined?getJobStore():options.policy;
 const coverage={scope,nativeRpcRequests:0,nativeRpcResponses:0,maxNativeRpcRequests:12,nativeRpcLatency:newRpcLatency(),outboundRows:0,returnRows:0,outboundSelected:0,returnSelected:0,sellerQuotes:0};
 let browser,page,upstreamFailure,stage='starting';const pendingRpcs=new Map(),retiredRpcs=new Set();
 const advance=value=>{stage=value;options.onStage?.(value);};
 const closeOnAbort=()=>{void browser?.close().catch(()=>{});};signal.addEventListener('abort',closeOnAbort,{once:true});
 const refusal=async(status,headers)=>{
  if(status<400)return;
  const state=status===429?'rate_limited':status===401?'auth':status===403?'blocked':status>=500?'temporarily_unavailable':'error';
  const at=retryAfter(headers?.['retry-after'])??(status===429?Date.now()+60000:[401,403].includes(status)?Date.now()+300000:undefined);
  if(at)policy?.deferSource('Google Flights',at,state);
  throw new SourceRequestError(`Google native flight request failed (HTTP ${status}).`,{status:state,httpStatus:status,retryAt:at});
 };
 async function check(){
  signal.throwIfAborted();if(upstreamFailure)throw upstreamFailure;
  const text=await page.locator('body').innerText();
  if(/unusual traffic|verify (?:that )?you(?:’|')?re (?:a )?human|not a robot|captcha|before you continue to google/i.test(text)){
   const at=Date.now()+300000;policy?.deferSource('Google Flights',at,'blocked');
   throw new SourceRequestError('Google requires a human access or consent check. Native search stopped.',{status:'blocked',retryAt:at});
  }
 }
 async function rpc(name,action,accept){
  await check();
  const started=performance.now();
  let rejectPending;const pending=new Promise((resolve,reject)=>{rejectPending=reject;pendingRpcs.set(name,{resolve,reject,accept});});
  const abort=()=>rejectPending(signal.reason);signal.addEventListener('abort',abort,{once:true});
  try{const [raw]=await Promise.all([pending,action()]);return raw;}
  finally{addRpcLatency(coverage.nativeRpcLatency,performance.now()-started);const done=pendingRpcs.get(name);if(done?.id)retiredRpcs.add(done.id);pendingRpcs.delete(name);signal.removeEventListener('abort',abort);}
 }
 function coverageSnapshot(){const snapshot=structuredClone(coverage);snapshot.nativeRpcLatency.p95UpperBoundMs=rpcLatencyP95(snapshot.nativeRpcLatency);return snapshot;}
 function result(offers,reason){return {query:input,offers,sources:[{provider:'Google Flights',status:'ok',received:offers.length,accepted:offers.length,reason:reason??scope,nativeCoverage:coverageSnapshot()}],observedAt:new Date().toISOString(),limitations:[scope],complete:true};}
 async function eligible(raw,from,to,date,side,timezones,excluded=new Set()){
  const candidates=googleDirectionCandidates(raw,{timezones}).filter(candidate=>candidate.leg.from===from&&candidate.leg.to===to&&candidate.leg.departureDate===date);
  const allowed=[];
  for(const candidate of candidates){
   if(excluded.has(fingerprint(candidate.leg))||options.selection&&fingerprint(candidate.leg)!==JSON.stringify(options.selection[side]))continue;
   const filtered=await applyFlightFilters([{...candidate.leg,price:candidate.indicativePrice}],{...filters,maxPrice:null,sort:'price'},options.filterOptions);
   if(filtered.offers.length)allowed.push(candidate);
  }
  return allowed;
 }
 async function choose(raw,from,to,date,side,timezones,excluded=new Set()){
  const frames=parseGoogleRpcFrames(raw),last=frames.at(-1),rows=[...(last?.[2]?.[0]??[]),...(last?.[3]?.[0]??[])];
  coverage[side==='outbound'?'outboundRows':'returnRows']=rows.length;
  if(!rows.length){
   const text=await page.getByRole('main').innerText();
   if(!/No flights found|No results found|couldn.t find any flights/i.test(text))throw new SourceRequestError('Google did not supply a complete direction list or an explicit no-results statement.',{status:'temporarily_unavailable',providerCode:'native_direction_incomplete'});
   return null;
  }
  if(rows.length)await page.getByRole('heading',{name:side==='outbound'?/^(?:Top )?departing flights$/i:/^Returning flights$/i}).waitFor();
  for(const candidate of await eligible(raw,from,to,date,side,timezones,excluded)){
   const link=page.locator(`[data-id="${candidate.id}"]`).getByRole('link',{name:/Select flight$/}).first();
   try{await link.waitFor({state:'attached',timeout:1000});}catch{continue;}
   return {candidate,link};
  }
  return null;
 }
 try{
  signal.throwIfAborted();
  if(policy)for(;;){const slot=policy.reserveSource('Google Flights',1000);if(slot.blockedUntil)throw new SourceRequestError('Google Flights is cooling down after an access or rate refusal.',{status:slot.status,retryAt:slot.blockedUntil});if(!slot.waitMs)break;await delay(slot.waitMs,undefined,{signal});}
  advance('timezones');const timezones=await (options.loadTimezones??airportTimezones)({signal});signal.throwIfAborted();
  advance('browser');browser=await (options.browserFactory??(()=>chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:Math.min(15000,timeoutMs)})))();signal.throwIfAborted();
  page=await browser.newPage();page.setDefaultTimeout(Math.min(15000,timeoutMs));
  const binding=`__travelGoogle_${randomUUID().replaceAll('-','')}`;
  await page.exposeBinding(binding,async({frame},packet)=>{
   if(frame!==page.mainFrame()||!packet||typeof packet.url!=='string'||typeof packet.id!=='string'||packet.id.length>100||retiredRpcs.has(packet.id))return;
   let url;try{url=new URL(packet.url);}catch{return;}
   const name=url.pathname.slice(service.length),pending=pendingRpcs.get(name);
   if(url.origin!=='https://www.google.com'||url.pathname!==service+name||!['GetShoppingResults','GetBookingResults'].includes(name)||!pending)return;
   try{
    await refusal(packet.status,packet.headers);
    if(packet.error||typeof packet.body!=='string'||Buffer.byteLength(packet.body)>8_000_000)throw new SourceRequestError('Google native response was unavailable or exceeded its size limit.',{status:'invalid_response'});
    if(!packet.complete){if(!pending.accept)return;try{if(!await pending.accept(packet.body))return;}catch{return;}}
    pending.id=packet.id;pending.resolve(packet.body);
   }catch(error){pending.reject(error);}
  });
  // Read the browser's actual response before app navigation can discard its protocol resource ID.
  // No request, cookie, passenger field or source header is changed.
  await page.addInitScript(({binding,service})=>{
   const eligible=value=>{try{const url=new URL(value,location.href);return url.origin==='https://www.google.com'&&['GetShoppingResults','GetBookingResults'].some(name=>url.pathname===service+name);}catch{return false;}};
   const emit=packet=>globalThis[binding](packet).catch(()=>{});
   const context=crypto.randomUUID();let sequence=0;
   const identity=()=>context+':'+(++sequence);
   const nativeFetch=globalThis.fetch;
   globalThis.fetch=async function(...args){
    const response=await nativeFetch.apply(this,args);if(!eligible(response.url))return response;
    const packet={id:identity(),url:response.url,status:response.status,headers:{'retry-after':response.headers.get('retry-after')}};
    const shopping=response.url.includes('/GetShoppingResults');
    const capture=async()=>{
     let body='',size=0,lastEnd=0,updates=0;const decoder=new TextDecoder();
     try{const reader=response.clone().body.getReader();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8_000_000){void reader.cancel();throw Error();}body+=decoder.decode(value,{stream:true});
      const end=body.lastIndexOf('\n')+1;
      if(shopping&&end>lastEnd&&updates++<128){lastEnd=end;await emit({...packet,body:body.slice(0,end),complete:false});}
     }body+=decoder.decode();await emit({...packet,body,complete:true});}
     catch{await emit({...packet,error:'body_unavailable',complete:true});}
    };
    if(shopping)void capture();else await capture();return response;
   };
   const NativeXHR=globalThis.XMLHttpRequest;
   globalThis.XMLHttpRequest=class extends NativeXHR{
    constructor(){super();const id=identity();let lastEnd=0,updates=0;this.addEventListener('readystatechange',()=>{
     if(this.readyState<3||!eligible(this.responseURL))return;
     const complete=this.readyState===4,shopping=this.responseURL.includes('/GetShoppingResults');if(!complete&&!shopping)return;
     const packet={id,url:this.responseURL,status:this.status,headers:{'retry-after':this.getResponseHeader('retry-after')},complete};
     try{let body=this.responseType==='arraybuffer'?new TextDecoder().decode(this.response):this.responseText;if(body.length>8_000_000)throw Error();
      if(!complete){const end=body.lastIndexOf('\n')+1;if(end<=lastEnd||updates++>=128)return;lastEnd=end;body=body.slice(0,end);}packet.body=body;
     }catch{if(!complete)return;packet.error='body_unavailable';}
     void emit(packet);
    },{capture:true});}
   };

  },{binding,service});
  await page.route(url=>url.origin==='https://www.google.com'&&['GetShoppingResults','GetBookingResults'].some(name=>url.pathname===service+name),async route=>{
   if(coverage.nativeRpcRequests>=12){
    upstreamFailure=new SourceRequestError('Google native query reached its 12-fare-request bound.',{status:'invalid_response',providerCode:'native_request_bound'});
    await route.abort();void browser.close().catch(()=>{});return;
   }
   coverage.nativeRpcRequests++;await route.fallback();
  });
  page.on('response',response=>{
   if(isRpc(response,'GetShoppingResults')||isRpc(response,'GetBookingResults')){
    coverage.nativeRpcResponses++;
    if(response.status()>=400)void refusal(response.status(),response.headers()).catch(error=>{upstreamFailure=error;});
   }
  });
  if(bookingUrl){
   advance('booking-refresh');
   const booking=await rpc('GetBookingResults',()=>page.goto(bookingUrl.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs}));
   await page.getByRole('heading',{name:/Booking options/}).waitFor();await check();
   const currencyLabel=await page.getByRole('button',{name:'Currency CAD',exact:true}).getAttribute('aria-label');
   if(currencyLabel!=='Currency CAD')throw new SourceRequestError('Google did not confirm CAD currency.',{status:'invalid_response'});
   advance('normalization');
   const normalized=normalizeGoogleRoundTrip(booking,input,{timezones,evidence:{currency:'CAD',text:await page.getByRole('main').innerText(),sourceUrl:page.url()}});
   const exact=normalized.offers.filter(offer=>JSON.stringify(offer.googleFlightSelection)===JSON.stringify(options.selection));
   coverage.sellerQuotes+=exact.length;
   const filtered=await applyFlightFilters(exact,filters,options.filterOptions);
   return result(filtered.offers,'Google rechecked the original booking page. Only the exact previously observed flights and matching full-party group quotes are returned; seller acceptance remains unverified.');
  }
  advance('form');const response=await page.goto(home,{waitUntil:'domcontentloaded',timeout:timeoutMs});await refusal(response.status(),response.headers());await check();
  advance('party');
  await page.getByRole('button',{name:/1 passenger, change number of passengers/}).click();
  const dialog=page.getByRole('dialog');
  for(let i=1;i<party.adults;i++)await dialog.getByRole('button',{name:'Add adult',exact:true}).click();
  for(let i=0;i<party.children;i++)await dialog.getByRole('button',{name:'Add child aged 2 to 11',exact:true}).click();
  await dialog.getByRole('button',{name:'Done',exact:true}).click();
  advance('route');for(const [name,code] of [['Where from?',input.origin],['Where to?',input.destination]]){
   await page.getByRole('combobox',{name,exact:true}).fill(code);
   const option=page.getByRole('option').filter({hasText:code}).first();
   await option.click();
  }
  advance('dates');await page.getByRole('textbox',{name:'Departure',exact:true}).filter({visible:true}).first().click();
  for(const date of [input.date,input.returnDate])await page.locator(`[role="gridcell"][data-iso="${date}"]`).filter({visible:true}).first().click();
  await page.getByRole('button',{name:/^Done\./}).click();
  for(const [label,date] of [['Departure',input.date],['Return',input.returnDate]]){
   const expected=new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
   const value=await page.getByRole('textbox',{name:label,exact:true}).filter({visible:true}).first().inputValue();
   if(!value.includes(expected))throw new SourceRequestError('Google did not retain the selected exact dates.',{status:'invalid_response'});
  }
  const tried=new Set(),acceptOutbound=async raw=>(await eligible(raw,input.origin,input.destination,input.date,'outbound',timezones,tried)).length>0,acceptReturn=async raw=>(await eligible(raw,input.destination,input.origin,input.returnDate,'return',timezones)).length>0;
  advance('outbound');const departing=await rpc('GetShoppingResults',()=>page.getByRole('button',{name:'Search',exact:true}).click(),acceptOutbound);
  await check();
  let current=departing;const searchUrl=page.url();
  for(let attempt=0;attempt<3;attempt++){
   const outbound=await choose(current,input.origin,input.destination,input.date,'outbound',timezones,tried);
   if(!outbound)break;
   tried.add(fingerprint(outbound.candidate.leg));coverage.outboundSelected++;
   advance('return');const returning=await rpc('GetShoppingResults',()=>outbound.link.locator('..').click(),acceptReturn);
   const inbound=await choose(returning,input.destination,input.origin,input.returnDate,'return',timezones);
   if(inbound){
    coverage.returnSelected++;
    advance('booking');const booking=await rpc('GetBookingResults',()=>inbound.link.press('Enter'));
    await page.getByRole('heading',{name:/Booking options/}).waitFor();await check();
    const currencyLabel=await page.getByRole('button',{name:'Currency CAD',exact:true}).getAttribute('aria-label');
    if(currencyLabel!=='Currency CAD')throw new SourceRequestError('Google did not confirm CAD currency.',{status:'invalid_response'});
    advance('normalization');const normalized=normalizeGoogleRoundTrip(booking,input,{timezones,evidence:{currency:'CAD',text:await page.getByRole('main').innerText(),sourceUrl:page.url()}});
    if(normalized.offers.some(offer=>fingerprint(offer)!==fingerprint(outbound.candidate.leg)||fingerprint(offer.inbound)!==fingerprint(inbound.candidate.leg)))throw new SourceRequestError('Google changed the selected flights before returning seller quotes.',{status:'invalid_response'});
    coverage.sellerQuotes+=normalized.offers.length;
    const filtered=await applyFlightFilters(normalized.offers,filters,options.filterOptions);
    if(filtered.offers.length)return result(filtered.offers);
   }
   if(attempt<2){advance('outbound');current=await rpc('GetShoppingResults',()=>page.goto(searchUrl,{waitUntil:'domcontentloaded',timeout:timeoutMs}),acceptOutbound);}
  }
  return result([],'No complete matching return within the bounded examined choices. '+scope);
 }catch(error){
  coverage.failureStage=stage;
  if(stage==='timezones')coverage.failureCode=typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:error?.name==='TypeError'?'TYPE_ERROR':'TIMEZONE_LOOKUP_FAILED';
  await options.onFailure?.({stage,error});
  if(options.signal?.aborted)throw options.signal.reason;
  const observed=error=>{error.nativeCoverage=coverageSnapshot();return error;};
  if(upstreamFailure)throw observed(upstreamFailure);
  if(error instanceof SourceRequestError)throw observed(error);
  if(signal.aborted)throw observed(new SourceRequestError(`Google native query exceeded its ${timeoutMs/1000}-second deadline.`,{status:'temporarily_unavailable',providerCode:'native_query_timeout'}));
  // Browser errors can contain full query URLs, selectors or source content. Do not relay them.
  throw observed(new SourceRequestError(`Google native return workflow did not produce complete verified evidence (${stage}).`,{status:'invalid_response',providerCode:'native_evidence_incomplete'}));
 }finally{signal.removeEventListener('abort',closeOnAbort);await browser?.close().catch(()=>{});}
}
