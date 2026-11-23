import {chromium} from 'playwright-core';
import {getJobStore} from './job-store.mjs';
import {reserveBrowserSource} from './browser-source-policy.mjs';
import {SourceRequestError,retryAfter} from './source-errors.mjs';

const SERVICE='/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetCalendarPicker';
const RESPONSE_LIMIT=1_000_000;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
let active=false;

function jsonEnd(text,start){
 let depth=0,quoted=false,escaped=false;
 for(let index=start;index<text.length;index++){
  const char=text[index];
  if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
  if(char==='"'){quoted=true;continue;}
  if(char==='['||char==='{')depth++;
  else if(char===']'||char==='}'){if(--depth===0)return index+1;}
 }
 return -1;
}
function parseFrames(body){
 let text=body.trimStart();if(text.startsWith(")]}'"))text=text.slice(4).trim();
 const frames=[];
 while(text){
  const prefix=/^(\d+)[ \t]*\r?\n\s*/.exec(text);
  if(!prefix)break;
  const start=prefix[0].length,end=jsonEnd(text,start);
  if(end<0)throw Error('Google calendar response has a malformed frame.');
  frames.push(JSON.parse(text.slice(start,end)));text=text.slice(end).trim();
 }
 if(frames.length)return frames;
 try{return [JSON.parse(text)];}catch{throw Error('Google calendar response is not valid JSON.');}
}
function collectStrings(value,found=[],depth=0){
 if(depth>8)return found;
 if(typeof value==='string'){
  const text=value.trim();
  if(/^[\[{]/.test(text))try{collectStrings(JSON.parse(text),found,depth+1);}catch{}
  found.push(value);return found;
 }
 if(Array.isArray(value))for(const child of value)collectStrings(child,found,depth+1);
 return found;
}
function dateRange(query){
 if(!query||!/^([A-Z]{3})$/.test(query.origin??'')||!/^([A-Z]{3})$/.test(query.destination??'')||query.origin===query.destination||!day(query.start)||!day(query.end)||query.end<query.start)throw Error('Google price calendars require two exact airports and a valid date range.');
 if(!['one-way','round-trip'].includes(query.tripType??'one-way')||query.tripType==='round-trip'&&(!day(query.returnDate)||query.returnDate<query.end)||query.tripType!=='round-trip'&&query.returnDate!==undefined)throw Error('Google price calendars require an exact one-way query or one fixed return date after every departure.');
 const days=Math.round((Date.parse(`${query.end}T00:00:00Z`)-Date.parse(`${query.start}T00:00:00Z`))/86400000)+1;
 if(days>31)throw Error('Google price calendars are limited to 31 departure dates per request.');
 return Array.from({length:days},(_,index)=>new Date(Date.parse(`${query.start}T00:00:00Z`)+index*86400000).toISOString().slice(0,10));
}
function flightsUrl(query,date=query.start){
 const url=new URL('https://www.google.com/travel/flights');
 const trip=query.tripType==='round-trip'?` on ${date} through ${query.returnDate}`:` on ${date} one way`;
 url.search=new URLSearchParams({q:`Flights from ${query.origin} to ${query.destination}${trip}`,hl:'en-CA',gl:'CA',curr:'CAD'}).toString();
 return url.toString();
}
function normalizePriceRows(body,query,observedAt,sourceUrl,maxBytes=RESPONSE_LIMIT){
 if(typeof body!=='string'||Buffer.byteLength(body)>maxBytes)throw new SourceRequestError('Google price calendar response exceeded its size limit.',{status:'invalid_response'});
 const requestedDates=dateRange(query),requested=new Set(requestedDates),frames=parseFrames(body),frameRows=frames.flatMap(frame=>Array.isArray(frame)?frame:[]);
 const rpc=frameRows.find(row=>Array.isArray(row)&&row[0]==='wrb.fr'&&(row[1]===null||typeof row[1]==='string')&&typeof row[2]==='string');
 if(!rpc){const marker=frameRows.find(row=>Array.isArray(row)&&row[0]==='e'&&Number.isSafeInteger(row[1])&&row[1]>=0&&row[1]<=9999);throw new SourceRequestError('Google returned no supported price calendar RPC frame.',{status:'invalid_response',...(marker?{providerCode:`google_calendar_error_${marker[1]}`}:{})});}
 let payload;try{payload=JSON.parse(rpc[2]);}catch{throw new SourceRequestError('Google price calendar payload is malformed.',{status:'invalid_response'});}
 const rows=payload?.[1];
 if(!Array.isArray(rows)||rows.length>100)throw new SourceRequestError('Google price calendar has an unsupported date-grid shape.',{status:'invalid_response'});
 const byDate=new Map();
 for(const row of rows){
  if(!Array.isArray(row)||!day(row[0]))throw new SourceRequestError('Google price calendar contains an invalid date row.',{status:'invalid_response'});
  if(!requested.has(row[0]))continue;
  const rawPrice=row?.[2]?.[0]?.[1];
  const price=rawPrice===null||rawPrice===undefined||rawPrice===0?null:rawPrice;
  if(price!==null&&(!Number.isSafeInteger(price)||price<1||price>10_000_000))throw new SourceRequestError('Google price calendar contains an invalid CAD amount.',{status:'invalid_response'});
  const previous=byDate.get(row[0]);
  if(previous&&previous.price!==price)throw new SourceRequestError('Google returned conflicting prices for one calendar date.',{status:'invalid_response'});
  const tripType=query.tripType??'one-way',returnDate=tripType==='round-trip'?query.returnDate:undefined;
  const priceScope=tripType==='round-trip'?`round-trip one adult economy; return ${returnDate}; itinerary details not returned`:'one-way one adult economy; itinerary details not returned';
  byDate.set(row[0],{provider:'Google Flights',source:'Google Flights price calendar RPC',from:query.origin,to:query.destination,date:row[0],calendarStart:query.start,calendarEnd:query.end,...(returnDate?{returnDate}:{}),tripType,price,currency:'CAD',observedAt,sourceUrl,priceScope,itineraryVerified:false,bookingStatus:`Price-only calendar observation; no ${tripType==='round-trip'?'round-trip ':''}itinerary, seller availability, baggage or final charges verified.`});
 }
 const missingDates=requestedDates.filter(date=>!byDate.has(date));
 return {observations:requestedDates.filter(date=>byDate.has(date)).map(date=>byDate.get(date)),coverage:{requestedDates:requestedDates.length,datesReturned:byDate.size,pricedDates:[...byDate.values()].filter(row=>row.price!==null).length,noPriceDates:[...byDate.values()].filter(row=>row.price===null).length,missingDates,complete:missingDates.length===0,rpcId:typeof rpc[1]==='string'?rpc[1]:null}};
}
function requestContainsRoute(postData,origin,destination){
 try{
  const form=new URLSearchParams(postData??''),request=form.get('f.req');if(!request)return false;
  const values=collectStrings(JSON.parse(request));return values.includes(origin)&&values.includes(destination);
 }catch{return false;}
}
export function googleCalendarPageMatchesQuery(pageUrl,query,date=query.start){
 try{
  const actual=new URL(pageUrl),expected=new URL(flightsUrl(query,date));
  return actual.origin==='https://www.google.com'&&actual.pathname==='/travel/flights'&&actual.searchParams.get('q')===expected.searchParams.get('q')&&actual.searchParams.get('hl')==='en-CA'&&actual.searchParams.get('gl')==='CA'&&actual.searchParams.get('curr')==='CAD';
 }catch{return false;}
}
export function googleCurrencyIsVisible(text){return typeof text==='string'&&(/\bCurrency\s*CAD\b/i.test(text)||/\bShowing prices in CAD\b/i.test(text));}
function sourceRefusal(status,headers,policy){
 const state=status===429?'rate_limited':status===401?'auth':status===403?'blocked':status>=500?'temporarily_unavailable':'error';
 const hint=retryAfter(headers?.['retry-after']);let retryAt=hint;
 if(status===429)retryAt=Math.max(hint??0,Date.now()+60000);
 if(status===401||status===403)retryAt=Math.max(hint??0,Date.now()+300000);
 if(retryAt)policy?.deferSource('Google Flights',retryAt,state);
 return new SourceRequestError(`Google price calendar request was refused (HTTP ${status}).`,{status:state,httpStatus:status,retryAt});
}

/** Parse the current Google Flights picker response captured from its ordinary CAD UI flow. */
export function parseGoogleCalendarResponse(body,query,observedAt=new Date().toISOString(),sourceUrl=flightsUrl(query)){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(observedAt)||!Number.isFinite(Date.parse(observedAt)))throw Error('Google calendar observation time must include an explicit timezone.');
 const parsed=normalizePriceRows(body,query,observedAt,sourceUrl);
 return {query,provider:'Google Flights',status:parsed.coverage.complete?'ok':'partial',observedAt,priceObservations:parsed.observations.filter(row=>row.price!==null),noPriceDates:parsed.observations.filter(row=>row.price===null).map(row=>row.date),coverage:parsed.coverage,sourceUrl,limitations:['Google returned date-level CAD prices without flight-segment or fare-rule details. These are price-only observations, not seller-confirmed itineraries.']};
}

/** Obtain the structured date grid by opening the date picker in Google's ordinary flight search UI. */
export async function searchGoogleCalendar(query,{signal,policy=getJobStore(),launch=options=>chromium.launch(options),timeoutMs=45000}={}){
 const dates=dateRange(query);if(query.cabin&&query.cabin!=='economy'||query.adults!==undefined&&query.adults!==1||query.children!==undefined&&query.children!==0)throw Error('Google price calendar supports one adult in economy only.');
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>45000)throw Error('Google price calendar deadline must be between 100 ms and 45 seconds.');
 signal?.throwIfAborted();if(active)throw Error('A Google price calendar request is already running.');active=true;
 let browser,stage='source_reservation';const abort=()=>void browser?.close().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
 const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 try{
  await reserveBrowserSource(policy,'Google Flights',{signal:combined});
  stage='launching_browser';browser=await launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:10000});combined.throwIfAborted();
  stage='opening_google_flights';const page=await browser.newPage({locale:'en-CA'});page.setDefaultTimeout(Math.min(timeoutMs,15000));
  let observedRequest;
  await page.goto(flightsUrl(query,dates[0]),{waitUntil:'domcontentloaded',timeout:timeoutMs});combined.throwIfAborted();
  const initialText=await page.locator('body').innerText();
  if(/unusual traffic|verify (?:that )?you(?:’|')?re (?:a )?human|not a robot|captcha|before you continue to google/i.test(initialText)){
   const retryAt=Date.now()+300000;policy?.deferSource('Google Flights',retryAt,'blocked');
   throw new SourceRequestError('Google requires a human access or consent check. Price-calendar search stopped.',{status:'blocked',retryAt});
  }
  stage='waiting_for_departure';const departure=page.getByRole('textbox',{name:'Departure',exact:true}).first();await departure.waitFor({state:'visible'});
  const requestPromise=page.waitForRequest(request=>{try{const url=new URL(request.url());return url.origin==='https://www.google.com'&&url.pathname===SERVICE&&request.method()==='POST';}catch{return false;}},{timeout:timeoutMs}).then(request=>({request}),error=>({error}));
  const responsePromise=page.waitForResponse(response=>{try{const url=new URL(response.url());return url.origin==='https://www.google.com'&&url.pathname===SERVICE;}catch{return false;}},{timeout:timeoutMs}).then(response=>({response}),error=>({error}));
  stage='clicking_date_picker';await departure.click();stage='waiting_for_calendar_request';
  const requestOutcome=await requestPromise;if(requestOutcome.error)throw requestOutcome.error;observedRequest=requestOutcome.request;combined.throwIfAborted();
  if(!requestContainsRoute(observedRequest.postData(),query.origin,query.destination)&&!googleCalendarPageMatchesQuery(page.url(),query,dates[0]))throw new SourceRequestError('Google calendar request was not bound to the exact submitted airport query.',{status:'invalid_response'});
  stage='waiting_for_calendar_response';const responseOutcome=await responsePromise;if(responseOutcome.error)throw responseOutcome.error;const response=responseOutcome.response;combined.throwIfAborted();
  const headers=response.headers(),status=response.status();
  if(status>=400)throw sourceRefusal(status,headers,policy);
  const length=Number(headers['content-length']);if(Number.isFinite(length)&&length>RESPONSE_LIMIT)throw new SourceRequestError('Google price calendar response exceeded its size limit.',{status:'invalid_response'});
  stage='validating_calendar_response';const body=await response.text();if(Buffer.byteLength(body)>RESPONSE_LIMIT)throw new SourceRequestError('Google price calendar response exceeded its size limit.',{status:'invalid_response'});
  const currencyText=await page.locator('body').innerText();
  if(!googleCurrencyIsVisible(currencyText))throw new SourceRequestError('Google did not visibly confirm CAD for this price calendar.',{status:'invalid_response'});
  combined.throwIfAborted();
  const observedAt=new Date().toISOString(),sourceUrl=flightsUrl(query,dates[0]);
  const result=parseGoogleCalendarResponse(body,query,observedAt,sourceUrl);
  result.currencyEvidence={status:'observed',currency:'CAD',method:'Google Flights date-picker UI says “Showing prices in CAD for”.'};
  result.coverage.endpointResponses=1;result.coverage.responseBytes=Buffer.byteLength(body);
  return result;
 }catch(error){
  if(signal?.aborted)throw signal.reason;
  if(error instanceof SourceRequestError)throw error;
  if(combined.aborted)throw new SourceRequestError(`Google price calendar exceeded its ${timeoutMs/1000}-second deadline.`,{status:'temporarily_unavailable'});
  throw new SourceRequestError(`Google date-picker flow did not return a supported price-calendar response (${stage}).`,{status:'invalid_response'});
 }finally{signal?.removeEventListener('abort',abort);await browser?.close().catch(()=>{});active=false;}
}
