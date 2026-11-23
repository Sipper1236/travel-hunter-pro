import {createHash,randomBytes} from 'node:crypto';
import {mkdir,open,readFile,rename,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchSource} from './source-fetch.mjs';
import {readBoundedSourceText} from './source-json.mjs';
import {SourceRequestError} from './source-errors.mjs';
import {matrixDetailedItinerary} from './matrix-details.mjs';
import {flightOfferError} from './flight-offer.mjs';
import {getJobStore} from './job-store.mjs';
import {validateMatrixOptions} from './matrix-options.mjs';

export function matrixResponseTimeout(value){
 if(value===undefined||value==='')return 90000;
 const ms=Number(value);if(!Number.isSafeInteger(ms)||ms<1000||ms>180000)throw Error('Matrix response timeout must be 1000–180000 milliseconds.');return ms;
}

const MATRIX_BATCH='https://content-alkalimatrix-pa.googleapis.com/batch';
const MATRIX_SITE='https://matrix.itasoftware.com';
const MATRIX_KEY_RE=/AIza[0-9A-Za-z_-]{35}/;
const KEY_CACHE_VERSION='matrix-production-v1';
const KEY_CACHE=join(dirname(fileURLToPath(import.meta.url)),'..','.cache','ita-matrix','api-key.json'),KEY_TTL=30*24*60*60_000;
const SUMMARIZERS=['carrierStopMatrix','currencyNotice','solutionList','itineraryPriceSlider','itineraryCarrierList','itineraryDepartureTimeRanges','itineraryArrivalTimeRanges','durationSliderItinerary','itineraryOrigins','itineraryDestinations','itineraryStopCountList','warningsItinerary'];
const CACHE_TTL=5*60_000;
export const MATRIX_RESPONSE_MAX_BYTES=5_000_000;
const CACHE_MAX_BYTES=1_000_000;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
const code=(value,field,pattern=/^[A-Z]{3}$/)=>{const result=typeof value==='string'?value.trim().toUpperCase():'';if(!pattern.test(result))throw Error(`Invalid ${field}.`);return result;};

async function readBoundedText(response,maxBytes){
 const length=Number(response.headers.get('content-length'));if(Number.isFinite(length)&&length>maxBytes)throw new SourceRequestError('Matrix key page exceeded its size limit.',{status:'invalid_response'});
 if(!response.body){const text=await response.text();if(Buffer.byteLength(text)>maxBytes)throw new SourceRequestError('Matrix key page exceeded its size limit.',{status:'invalid_response'});return text;}
 const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new SourceRequestError('Matrix key page exceeded its size limit.',{status:'invalid_response'});}chunks.push(value);}}finally{reader.releaseLock();}
 return new TextDecoder().decode(Buffer.concat(chunks));
}
function extractMatrixKey(text){return typeof text==='string'?text.match(/\b[A-Za-z_$][\w$]*\.matrix\s*=\s*(["'])(AIza[0-9A-Za-z_-]{35})\1/)?.[2]??null:null;}
const allowedMatrixAsset=url=>url.origin===MATRIX_SITE||url.origin==='https://www.gstatic.com'&&url.pathname.startsWith('/alkali/');
async function persistMatrixKey(path,key){
 await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=`${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`,handle=await open(temp,'w',0o600);
 try{await handle.writeFile(JSON.stringify({key,fetchedAt:Date.now(),source:KEY_CACHE_VERSION}));}finally{await handle.close();}await rename(temp,path);
}
async function cachedMatrixKey(path,now){
 try{const [record,details]=await Promise.all([readFile(path,'utf8'),stat(path)]);if((now-details.mtimeMs)>KEY_TTL)return null;const value=JSON.parse(record);return value.source===KEY_CACHE_VERSION&&typeof value.key==='string'&&new RegExp(`^${MATRIX_KEY_RE.source}$`).test(value.key)?value.key:null;}catch{return null;}
}
const memoryKeys=new Map();
export async function resolveMatrixApiKey({fetcher=fetch,signal,cachePath=KEY_CACHE,now=Date.now(),policy}={}){
 const configured=process.env.ITA_MATRIX_API_KEY?.trim();if(configured&&new RegExp(`^${MATRIX_KEY_RE.source}$`).test(configured))return configured;
 const memory=memoryKeys.get(cachePath);if(memory&&memory.expires>now)return memory.key;memoryKeys.delete(cachePath);
 const cached=await cachedMatrixKey(cachePath,now);if(cached){memoryKeys.set(cachePath,{key:cached,expires:now+KEY_TTL});return cached;}
  const page=await fetchSource('ITA Matrix',MATRIX_SITE,{headers:{Accept:'text/html'},signal},{fetcher,policy:policy??(fetcher===fetch?getJobStore():undefined),retrySafe:true,timeoutMs:10000});
 if(new URL(page.url||MATRIX_SITE).origin!==MATRIX_SITE)throw new SourceRequestError('Matrix key discovery redirected away from the official site.',{status:'blocked'});
 let text=await readBoundedText(page,2_000_000),key=extractMatrixKey(text);
 if(!key){
  const scripts=[...text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].slice(0,8).map(match=>match[1].replaceAll('&amp;','&'));
   for(const source of scripts){let scriptUrl;try{scriptUrl=new URL(source,MATRIX_SITE);}catch{continue;}if(!allowedMatrixAsset(scriptUrl))continue;
    const script=await fetchSource('ITA Matrix',scriptUrl,{headers:{Accept:'*/*'},signal},{fetcher,policy:policy??(fetcher===fetch?getJobStore():undefined),retrySafe:true,timeoutMs:10000});
    if(!allowedMatrixAsset(new URL(script.url||scriptUrl)))continue;
   key=extractMatrixKey(await readBoundedText(script,5_000_000));if(key)break;
  }
 }
 if(!key)throw new SourceRequestError('Matrix did not expose a public API key in its current web assets.',{status:'temporarily_unavailable'});
 memoryKeys.set(cachePath,{key,expires:now+KEY_TTL});try{await persistMatrixKey(cachePath,key);}catch{}return key;
}

export function validateMatrixSearch(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Provide a Matrix search request.');
 const origin=code(input.origin,'origin'),destination=code(input.destination,'destination');
 if(origin===destination)throw Error('Origin and destination must differ.');
 if(!date(input.departureDate)||input.departureDate<new Date().toISOString().slice(0,10))throw Error('Invalid departureDate.');
 if(input.returnDate!==undefined&&input.returnDate!==''&&(!date(input.returnDate)||input.returnDate<input.departureDate))throw Error('Invalid returnDate.');
 const p=input.passengers??{adults:1},allowed=['adults','youths','children','seniors','infantsInSeat','infantsInLap'];
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!allowed.includes(k)))throw Error('Invalid passenger counts.');
 const passengers={};for(const key of allowed){const n=p[key]??0;if(!Number.isSafeInteger(n)||n<0||n>9)throw Error(`Invalid passenger count: ${key}.`);if(n)passengers[key]=n;}
 if(!Object.values(passengers).some(Boolean)||Object.values(passengers).reduce((sum,n)=>sum+n,0)>9)throw Error('Matrix searches require 1–9 travelers.');
 const cabin=input.cabin??'COACH';if(!['COACH','PREMIUM-COACH','BUSINESS','FIRST'].includes(cabin))throw Error('Invalid cabin.');
 const matrixOptions=validateMatrixOptions(input);
 const currency=code(input.currency??'CAD','currency',/^[A-Z]{3}$/),pageSize=input.pageSize??50,stops=input.maxExtraLegsRelativeToMinimum??1;
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw Error('Invalid pageSize.');
 if(!Number.isInteger(stops)||stops<0||stops>5)throw Error('Invalid maxExtraLegsRelativeToMinimum.');
 if(input.allowAirportChanges!==undefined&&typeof input.allowAirportChanges!=='boolean')throw Error('Invalid allowAirportChanges.');
 const salesCity=input.salesCity?code(input.salesCity,'salesCity'):undefined;
 return {origin,destination,departureDate:input.departureDate,...(date(input.returnDate)?{returnDate:input.returnDate}:{}),passengers,cabin,currency,pageSize,...matrixOptions,...(salesCity?{salesCity}:{})};
}

const slice=(origin,destination,date)=>({origins:[origin],destinations:[destination],date,dateModifier:{minus:0,plus:0},isArrivalDate:false,filter:{warnings:{values:[]}},selected:false});
export function makeMatrixBody(input){
 const q=validateMatrixSearch(input),slices=[slice(q.origin,q.destination,q.departureDate)];if(q.returnDate)slices.push(slice(q.destination,q.origin,q.returnDate));
 const pax=Object.fromEntries(Object.entries(q.passengers).map(([key,count])=>[key==='youths'?'youth':key,count]));
 return {summarizers:SUMMARIZERS,inputs:{filter:{},page:{current:1,size:q.pageSize},pax,slices,firstDayOfWeek:'SUNDAY',internalUser:false,sliceIndex:0,sorts:'default',cabin:q.cabin,maxLegsRelativeToMin:q.maxExtraLegsRelativeToMinimum,changeOfAirport:q.allowAirportChanges,checkAvailability:true,currency:q.currency,...(q.salesCity?{salesCity:q.salesCity}:{})},summarizerSet:'wholeTrip',name:'specificDatesSlice'};
}
function makeBatch(inner,key){
 const boundary=`batch${randomBytes(12).toString('hex')}`,body=[`--${boundary}`,'Content-Type: application/http','Content-Transfer-Encoding: binary',`Content-ID: <${boundary}+gapiRequest@googleapis.com>`,'',`POST /v1/search?key=${encodeURIComponent(key)}&alt=json`,'x-alkali-application-key: applications/matrix','x-alkali-auth-apps-namespace: alkali_v2','x-alkali-auth-entities-namespace: alkali_v2','X-Requested-With: XMLHttpRequest','Content-Type: application/json','',JSON.stringify(inner),`--${boundary}--`,''].join('\r\n');
 return {url:`${MATRIX_BATCH}?${new URLSearchParams({'$ct':`multipart/mixed; boundary=${boundary}`})}`,body,boundary};
}

export function parseMatrixBatch(text,contentType=''){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MATRIX_RESPONSE_MAX_BYTES)throw new SourceRequestError('Matrix returned an invalid or oversized response.',{status:'invalid_response'});
 const boundary=contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i),delimiter=boundary?.[1]??boundary?.[2];
 const candidates=delimiter?text.split(`--${delimiter}`).map(part=>part.slice(part.indexOf('\r\n\r\n')+4).replace(/\r?\n--?\s*$/,'').trim()).filter(Boolean):[text.trim()];
 for(const candidate of candidates){const start=candidate.indexOf('{');if(start<0)continue;try{const value=JSON.parse(candidate.slice(start));if(value&&typeof value==='object'&&!Array.isArray(value)){if(value.error){const code=Number.isInteger(value.error.code)?value.error.code:undefined,status=typeof value.error.status==='string'&&/^[A-Z_]{1,40}$/.test(value.error.status)?value.error.status:undefined,label=[status,code?`code ${code}`:null].filter(Boolean).join(', ');throw new SourceRequestError(`Matrix API rejected the request${label?` (${label})`:''}.`,{status:code===401?'auth':code===403?'blocked':code===429?'rate_limited':code>=500?'temporarily_unavailable':'error',...(code>=400&&code<=599?{httpStatus:code}:{})});}return value;}}catch(error){if(error instanceof SourceRequestError)throw error;}}
 throw new SourceRequestError('Matrix response format changed; no valid JSON part was found.',{status:'invalid_response'});
}

export function parseMatrixMoney(value,preferredCurrency='CAD'){
 if(typeof value!=='string')return null;const match=value.trim().match(/^([A-Z]{3})\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)$/);if(!match)return null;const amount=Number(match[2].replaceAll(',','')),cents=Math.round(amount*100);return Number.isFinite(amount)&&amount>0&&Number.isSafeInteger(cents)&&Math.abs(amount*100-cents)<1e-6?{currency:match[1]||preferredCurrency,amount}:null;
}

const passengerNouns={adults:['adult','adults'],youths:['youth','youths'],children:['child','children'],seniors:['senior','seniors'],infantsInSeat:['infant in seat','infants in seats'],infantsInLap:['lap infant','lap infants']};
function matrixTravelerSummary(passengers){
 return Object.entries(passengers).map(([type,count])=>`${count} ${(passengerNouns[type]??[type,type])[count===1?0:1]}`).join(', ');
}

export function buildMatrixUrl(input,{calendar=false,duration=7}={}){
 const q=validateMatrixSearch(input);if(calendar&&(!Number.isInteger(duration)||duration<0||duration>365))throw Error('Invalid calendar duration.');
 const dates={searchDateType:calendar?'calendar':'specific',departureDate:q.departureDate,departureDateType:'depart',departureDateModifier:'0',departureDatePreferredTimes:[],...(calendar?(q.returnDate?{duration:String(duration)}:{}):{returnDate:q.returnDate??''}),returnDateType:'depart',returnDateModifier:'0',returnDatePreferredTimes:[]};
 const pax={};for(const [key,value] of Object.entries(q.passengers)){const stateKey=key==='youths'?'youth':key==='infantsInSeat'?'infantsInSeat':key==='infantsInLap'?'infantsInLap':key;pax[key==='adults'?'adults':stateKey]=String(value);}
 const state={type:q.returnDate?'round-trip':'one-way',slices:[{origin:[q.origin],dest:[q.destination],dates}],options:{cabin:q.cabin==='PREMIUM-COACH'?'PREMIUM_COACH':q.cabin,stops:'-1',extraStops:'-1',allowAirportChanges:String(q.allowAirportChanges),showOnlyAvailable:'true'},pax};
 return `${MATRIX_SITE}/${calendar?'calendar':'flights'}?search=${encodeURIComponent(Buffer.from(JSON.stringify(state)).toString('base64'))}`;
}

function mapMatrixSlice(slice,from,to,expectedDate,carrier){
 const dep=slice?.departure,arr=slice?.arrival,depMs=typeof dep==='string'?Date.parse(dep):NaN,arrMs=typeof arr==='string'?Date.parse(arr):NaN;
 if(!slice||slice.origin?.code!==from||slice.destination?.code!==to||!date(expectedDate)||!Number.isFinite(depMs)||!Number.isFinite(arrMs)||arrMs<=depMs||dep.slice(0,10)!==expectedDate||!/[+-]\d{2}:?\d{2}$|Z$/.test(dep)||!/[+-]\d{2}:?\d{2}$|Z$/.test(arr)||!Number.isFinite(slice.duration)||slice.duration<=0||!Array.isArray(slice.flights)||slice.flights.length!==1||typeof slice.flights[0]!=='string'||!slice.flights[0].trim())return null;
 const departureTime=dep.slice(11,16),arrivalTime=arr.slice(11,16),arrivalDate=arr.slice(0,10);
 if(!/^\d{2}:\d{2}$/.test(departureTime)||!/^\d{2}:\d{2}$/.test(arrivalTime)||!date(arrivalDate))return null;
 return {from,to,departureDate:expectedDate,departureTime,arrivalDate,arrivalTime,durationMinutes:slice.duration,via:[],airlines:[carrier.shortName||carrier.code],segments:[{marketing_carrier_code:carrier.code,flight_number:slice.flights[0],departure_airport:from,arrival_airport:to,departure_time_local:dep,arrival_time_local:arr,departure_time_utc:new Date(depMs).toISOString(),arrival_time_utc:new Date(arrMs).toISOString()}]};
}

// Matrix's response is undocumented; support only its observed one-flight-per-slice shape.
export function normalizeMatrix(raw,input,observedAt=new Date().toISOString()){
 const q=validateMatrixSearch(input),solutions=raw?.solutionList?.solutions;if(!Array.isArray(solutions))throw new SourceRequestError('Matrix response schema changed: solutionList.solutions is missing.',{status:'invalid_response'});
 const travelers=matrixTravelerSummary(q.passengers);
 const searchUrl=buildMatrixUrl(q),offers=[],priceObservations=[];let rejected=0;
 for(const [index,solution] of solutions.entries()){
  if(Object.entries(q.passengers).some(([key,count])=>key!=='adults'&&count>0)){
   const echoed={};for(const pricing of solution?.pricings??[])for(const [key,count]of Object.entries(pricing?.ext?.pax??{}))echoed[key]=(echoed[key]??0)+count;
   const expected=Object.fromEntries(Object.entries(q.passengers).map(([key,count])=>[key==='youths'?'youth':key,count]));
   if(solution.passengerCount!==Object.values(expected).reduce((a,b)=>a+b,0)||Object.keys({...expected,...echoed}).some(key=>expected[key]!==echoed[key])||solution.ext?.totalPrice!==solution.displayTotal){rejected++;continue;}
  }
  const price=parseMatrixMoney(solution?.displayTotal,q.currency),itinerary=solution?.itinerary,carriers=itinerary?.carriers;
  if(!price||price.currency!=='CAD'||!Array.isArray(itinerary?.slices)||itinerary.slices.length!==(q.returnDate?2:1)){rejected++;continue;}
  const [out,back]=itinerary.slices,scoped=out?.origin?.code===q.origin&&out?.destination?.code===q.destination&&typeof out?.departure==='string'&&out.departure.slice(0,10)===q.departureDate&&(!q.returnDate||back?.origin?.code===q.destination&&back?.destination?.code===q.origin&&typeof back?.departure==='string'&&back.departure.slice(0,10)===q.returnDate);
  if(!scoped){rejected++;continue;}
  const carrier=Array.isArray(carriers)&&carriers.length===1&&/^[A-Z0-9]{2,3}$/.test(carriers[0]?.code??'')?carriers[0]:null;
  const cabinValues=itinerary.slices.flatMap(slice=>Array.isArray(slice.cabins)?slice.cabins:[]);
  if(cabinValues.some(value=>typeof value!=='string'||value.replaceAll('_','-')!==q.cabin)){rejected++;continue;}
  const cabinVerified=itinerary.slices.every(slice=>Array.isArray(slice.cabins)&&slice.cabins.length===slice.flights?.length&&slice.cabins.length>0);
  const detailed=solution.matrixDetails?matrixDetailedItinerary(solution,solution.matrixDetails,q):null;
  const leg=solution.matrixDetails?detailed?.outbound:carrier&&cabinVerified?mapMatrixSlice(out,q.origin,q.destination,q.departureDate,carrier):null;
  const inbound=solution.matrixDetails?detailed?.inbound:q.returnDate&&carrier&&cabinVerified?mapMatrixSlice(back,q.destination,q.origin,q.returnDate,carrier):null;
  const cabin=q.cabin==='COACH'?'economy':q.cabin==='PREMIUM-COACH'?'premium_economy':q.cabin.toLowerCase();
  const id=String(solution.id??`matrix-${index}`);
  if(!leg||q.returnDate&&!inbound){priceObservations.push({id,provider:'ITA Matrix',origin:q.origin,destination:q.destination,departureDate:q.departureDate,...(q.returnDate?{returnDate:q.returnDate}:{}),price:price.amount,currency:price.currency,priceScope:'Matrix-reported group total',travelers,cabin,observedAt,sourceUrl:searchUrl,linkLabel:'Open Matrix search',itineraryVerified:false,details:'Matrix reported this CAD total for the matching route and dates, but full flight and connection details could not be validated.'});continue;}
  const offer={...leg,...(inbound?{inbound}:{}),id,provider:'ITA Matrix',source:'ITA Matrix (unofficial endpoint)',observedAt,price:price.amount,currency:price.currency,travelers,cabin,sourceUrl:searchUrl,bookingStatus:'Matrix research link only; seller availability unconfirmed',fees:'Taxes and baggage inclusions require seller verification'};
  const query={origin:q.origin,destination:q.destination,date:q.departureDate,tripType:q.returnDate?'round-trip':'one-way',...(q.returnDate?{returnDate:q.returnDate}:{}),cabin};
  if(flightOfferError(offer,query)){priceObservations.push({id,provider:'ITA Matrix',origin:q.origin,destination:q.destination,departureDate:q.departureDate,...(q.returnDate?{returnDate:q.returnDate}:{}),price:price.amount,currency:price.currency,priceScope:'Matrix-reported group total',travelers:offer.travelers,cabin,observedAt,sourceUrl:searchUrl,linkLabel:'Open Matrix search',itineraryVerified:false,details:'Matrix reported this CAD total for the matching route and dates, but this itinerary did not pass the app’s full verification checks.'});continue;}
  offers.push(offer);
 }
 return {offers,priceObservations,sources:[{provider:'ITA Matrix',status:'ok',...(raw.matrixTiming?{matrixTiming:raw.matrixTiming}:{}),...(raw.matrixDetailCoverage?{detailCoverage:raw.matrixDetailCoverage}:{}),received:solutions.length,accepted:offers.length,priceObservations:priceObservations.length,...(priceObservations.length?{reason:`${priceObservations.length} matching CAD price observations are shown separately because complete itinerary details could not be verified.`}:{}),...(rejected?{rejected,reason:`${priceObservations.length} matching CAD prices shown; ${rejected} responses lacked a supported CAD total or matching route/date evidence.`}:{})}],searchUrl,observedAt,complete:false,limitations:['Unofficial, reverse-engineered Matrix endpoint; access and response format may change.','Matrix search links are fare-research links, not booking links or seller confirmation.','Browser searches expand up to three connecting or mixed-carrier itineraries for detailed validation; other incomplete observations remain separate.','Price-only observations match the requested route/dates and explicit CAD total, but are not verified itineraries and may not satisfy filters.']};
}

export async function searchMatrix(input,{apiKey=process.env.ITA_MATRIX_API_KEY,fetcher=fetch,signal,policy,timeoutMs,cacheStore,now=Date.now,browserSearch}={}){
 const responseTimeout=matrixResponseTimeout(timeoutMs??process.env.TRAVEL_MATRIX_RESPONSE_TIMEOUT_MS);
 const validated=validateMatrixSearch(input);
 const needsBrowserForParty=Object.entries(validated.passengers).some(([key,count])=>key!=='adults'&&count>0);
 const useBrowser=validated.expandDetailedItineraries||(fetcher===fetch&&needsBrowserForParty);
 if(useBrowser){
  if(validated.cabin!=='COACH')throw new SourceRequestError('Detailed Matrix itineraries are supported only for economy searches.',{status:'unsupported_trip'});
  if(validated.maxExtraLegsRelativeToMinimum>2)throw new SourceRequestError('The Matrix website currently supports detailed expansion only through two extra stops; lower the extra-stop setting or turn off detail expansion.',{status:'unsupported_trip'});
  if(!browserSearch&&fetcher!==fetch)throw new SourceRequestError('Detailed Matrix itineraries require the native Matrix website search path.',{status:'unsupported_trip'});
  const search=browserSearch??(await import('./matrix-browser.mjs')).matrixBrowserSearch;
  return normalizeMatrix(await search(validated,{signal,policy,timeoutMs:responseTimeout}),validated);
 }
 const override=typeof apiKey==='string'&&new RegExp(`^${MATRIX_KEY_RE.source}$`).test(apiKey.trim())?apiKey.trim():null;
 const key=override??await resolveMatrixApiKey({fetcher,signal,policy});
 const q=validateMatrixSearch(input),cacheKey=createHash('sha256').update(JSON.stringify([q,key])).digest('hex'),cacheCandidate=fetcher===fetch?(cacheStore??getJobStore()):null;
 const sharedCache=cacheCandidate&&typeof cacheCandidate.getMatrixResponse==='function'&&typeof cacheCandidate.setMatrixResponse==='function'?cacheCandidate:null;
 if(sharedCache){const hit=sharedCache.getMatrixResponse(cacheKey,now());if(hit)return {...hit,sources:hit.sources.map(source=>({...source,cached:true}))};}
 const batch=makeBatch(makeMatrixBody(q),key);
 const response=await fetchSource('ITA Matrix',batch.url,{method:'POST',headers:{'Content-Type':'text/plain; charset=UTF-8',Accept:'*/*',Origin:MATRIX_SITE,Referer:`${MATRIX_SITE}/`},body:batch.body,signal},{fetcher,policy:policy??(fetcher===fetch?getJobStore():undefined),retrySafe:false,timeoutMs:responseTimeout});
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw new SourceRequestError(`Matrix request failed (HTTP ${response.status}).`,{status:response.status===429?'rate_limited':response.status===403?'blocked':'error',httpStatus:response.status});}
 const text=await readBoundedSourceText(response,{provider:'ITA Matrix',maxBytes:MATRIX_RESPONSE_MAX_BYTES});
 let parsed;
 try{parsed=parseMatrixBatch(text,response.headers.get('content-type')??'');}
 catch(error){if([401,403,429].includes(error.httpStatus)){const sourcePolicy=policy??(fetcher===fetch?getJobStore():null);error.retryAt=Date.now()+(error.httpStatus===429?60000:300000);sourcePolicy?.deferSource('ITA Matrix',error.retryAt,error.sourceStatus);}throw error;}
 const result=normalizeMatrix(parsed,q);
 if(sharedCache){const savedAt=now();const serialized=JSON.stringify(result);if(Buffer.byteLength(serialized)<=CACHE_MAX_BYTES)sharedCache.setMatrixResponse(cacheKey,result,savedAt+CACHE_TTL,savedAt);}
 return result;
}
