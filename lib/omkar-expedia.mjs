import {randomUUID} from 'node:crypto';
import {fetchSource} from './source-fetch.mjs';
import {readBoundedSourceJson} from './source-json.mjs';
import {SourceRequestError} from './source-errors.mjs';
import {flightOfferError} from './flight-offer.mjs';
import {validateSearchParty} from './travelers.mjs';

const API='https://expedia-scraper.omkar.cloud/expedia/flights/one-way';
const code=value=>typeof value==='string'&&/^[A-Z]{3}$/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const cabins={economy:'coach',premium_economy:'premium_economy',business:'business',first:'first'};

function localTime(value){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)){const parsed=offsetInstant(value);return parsed===null?null:value.slice(11,16);}
 if(typeof value!=='string')return null;const s=value.trim().toLowerCase(),m=s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
 if(m){let hour=Number(m[1]);if(hour<1||hour>12||Number(m[2])>59)return null;hour=hour%12+(m[3]==='pm'?12:0);return `${String(hour).padStart(2,'0')}:${m[2]}`;}
 return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)?s:null;
}
function offsetInstant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value))return null;
 const day=value.slice(0,10),dateObj=new Date(`${day}T00:00:00Z`),offset=/([+-])(\d{2}):(\d{2})$/.exec(value);
 if(!Number.isFinite(dateObj.valueOf())||dateObj.toISOString().slice(0,10)!==day||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||value[16]===':'&&Number(value.slice(17,19))>59||offset&&(Number(offset[2])>14||Number(offset[2])===14&&Number(offset[3])!==0||offset[1]==='-'&&Number(offset[2])===0&&Number(offset[3])===0))return null;
 const instant=Date.parse(value);return Number.isFinite(instant)?instant:null;
}
function elapsedFromSegments(segments){
 if(!Array.isArray(segments)||!segments.length)return null;let prior=null;
 for(const segment of segments){const departure=offsetInstant(segment?.departure_time),arrival=offsetInstant(segment?.arrival_time);if(departure===null||arrival===null||arrival<=departure||prior!==null&&departure<prior)return null;prior=arrival;}
 const total=(prior-offsetInstant(segments[0].departure_time))/60000;return Number.isInteger(total)&&total>0?total:null;
}
function priceFor(fare,flight){
 const display=String(fare?.price_detail??fare?.display_price??fare?.price?.display??'').trim();
 const strings=[fare?.display_price,fare?.price_detail,fare?.price?.display].filter(value=>typeof value==='string').map(value=>value.trim());
 const prefixes=strings.map(value=>value.match(/^([A-Z]{3})\b/)?.[1]).filter(Boolean);
 const prefix=display.match(/^([A-Z]{3})\b/)?.[1];
 const explicit=fare?.currency??fare?.currency_code??fare?.price?.currency??flight?.currency??flight?.currency_code??null;
 const currency=explicit??prefix;
 if(prefix&&explicit&&prefix!==explicit||currency&&prefixes.some(value=>value!==currency))return {reason:'conflicting_currency'};
 if(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency))return {reason:'missing_currency'};
 const numeric=[fare?.price?.amount,fare?.amount,fare?.display_price,fare?.price_detail,fare?.price?.value].find(value=>value!==undefined&&value!==null);
 const match=typeof numeric==='string'?numeric.trim().match(/^(?:[A-Z]{3}\s*)?\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?:\s+one way for 1 traveler)?$/i):null;
 const amount=typeof numeric==='number'?numeric:match?Number(match[1].replaceAll(',','')):NaN;
 const cents=Math.round(amount*100);
 if(!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(cents)||Math.abs(amount*100-cents)>=1e-6)return {reason:'invalid_amount'};
 if(currency!=='CAD')return {reason:'non_cad_currency'};
 return {price:{amount,currency}};
}
function scopeIsOneTraveler(flight,fare){
 const type=String(flight?.fare_type??'').trim().toLowerCase(),detail=String(fare?.price_detail??'').toLowerCase();
 if(/round[ -]trip/.test(`${type} ${detail}`)||[...detail.matchAll(/\bfor\s+(\d+)\s+travelers?\b/g)].some(match=>Number(match[1])!==1))return false;
 if(type&&!/^one[ -]way per traveler$/.test(type))return false;
 return /^one[ -]way per traveler$/.test(type)||/\bone[ -]way for 1 traveler\b/.test(detail);
}
function safeExpediaUrl(value){
 try{const url=new URL(value),host=['expedia.com','expedia.ca'].some(domain=>url.hostname===domain||url.hostname.endsWith(`.${domain}`));return url.protocol==='https:'&&host&&!url.username&&!url.password?url.toString():null;}catch{return null;}
}
function inclusions(values){return Array.isArray(values)?values.map(item=>typeof item==='string'?item:item&&typeof item.label==='string'?`${item.label}${typeof item.fee==='string'&&item.fee?` ${item.fee}`:''}`:null).filter(Boolean):[];}
function routeSegments(flight,query){
 const itinerary=flight?.itineraries?.[0],segments=itinerary?.segments;
 if(!Array.isArray(segments)||!segments.length)return null;
 if(segments[0]?.origin_code!==query.origin||segments.at(-1)?.destination_code!==query.destination)return null;
 for(let i=0;i<segments.length;i++)if(!code(segments[i]?.origin_code)||!code(segments[i]?.destination_code)||(i&&segments[i-1].destination_code!==segments[i].origin_code))return null;
 if(Number.isInteger(flight.stop_count)&&flight.stop_count!==segments.length-1)return null;
 return {itinerary,segments};
}
function normalizeFare(flight,fare,route,price,query,observedAt,searchUrl,index){
 const {segments}=route,first=segments[0],last=segments.at(-1),departureStamp=first.departure_time,arrivalStamp=last.arrival_time,departureTime=localTime(departureStamp),arrivalTime=localTime(arrivalStamp);
 const duration=elapsedFromSegments(segments),departureDate=typeof departureStamp==='string'&&offsetInstant(departureStamp)!==null?departureStamp.slice(0,10):null,arrivalDate=typeof arrivalStamp==='string'&&offsetInstant(arrivalStamp)!==null?arrivalStamp.slice(0,10):null;
 const airlines=[...new Set((flight.airlines??[]).map(item=>typeof item==='string'?item:item?.name).filter(Boolean))];
 const cabinValue=fare?.cabin_class??fare?.cabin;
 const cabin=typeof cabinValue==='string'?Object.keys(cabins).find(k=>cabins[k]===cabinValue.toLowerCase()):null;
 const via=segments.slice(0,-1).map(item=>item.destination_code);
 const link=safeExpediaUrl(fare?.booking_url)||searchUrl;
 const details=`${fare?.fare_name||'Fare tier'} · Omkar reports one-way per traveler; ${flight?.fare_type||'scope not otherwise stated'}.`;
 const observation={id:`omkar:${String(flight.offer_id??index)}:${String(fare.fare_name??index)}`,provider:'Expedia via Omkar',origin:query.origin,destination:query.destination,departureDate:query.date,price:price.amount,currency:price.currency,priceScope:'One adult · one-way per traveler',travelers:'1 adult',cabin:query.cabin,observedAt,sourceUrl:link,linkLabel:safeExpediaUrl(fare?.booking_url)?'View Expedia fare details':'Open Expedia search',details,itineraryVerified:false};
 if(!departureTime||!arrivalTime||departureDate!==query.date||!arrivalDate||duration===null||!cabin||price.currency!=='CAD'||!airlines.length)return {observation};
 const offer={provider:'Expedia via Omkar',source:'Omkar Expedia Scraper API',section:'one-way',observedAt,price:price.amount,currency:price.currency,travelers:'1 adult · provider scope: one-way per traveler',cabin,from:query.origin,to:query.destination,airlines,departureDate,departureTime,arrivalDate,arrivalTime,durationMinutes:duration,via,
   segments:segments.map(segment=>({marketing_carrier_code:segment.marketing_airline_code??segment.marketing_carrier_code??segment.airline_code,flight_number:segment.flight_number??segment.flight_no,departure_airport:segment.origin_code,arrival_airport:segment.destination_code,departure_time_local:segment.departure_time,arrival_time_local:segment.arrival_time})),
  sourceUrl:link,expediaOfferId:flight.offer_id,bookingStatus:'Provider fare link; seller price and availability must be rechecked',fees:inclusions(fare.inclusions).join('; ')||'Fare inclusions and mandatory charges not fully verified',fareName:fare.fare_name};
 return flightOfferError(offer,{origin:query.origin,destination:query.destination,date:query.date,tripType:'one-way',cabin:query.cabin})?{observation}:{offer};
}

export function expediaSearchUrl({origin,destination,date:departureDate,returnDate,tripType='one-way',cabin='economy',adults=1,originAirport,destinationAirport}){
 if(!code(origin)||!code(destination)||origin===destination||!date(departureDate)||tripType==='round-trip'&&(!date(returnDate)||returnDate<departureDate))throw Error('Expedia search links require valid airport codes and dates.');
 if(adults!==1||!cabins[cabin])throw Error('This Expedia search link builder supports one adult and a known cabin only.');
 const human=iso=>{const [year,month,day]=iso.split('-');return `${day}/${month}/${year}`;};
 const safeName=value=>typeof value==='string'&&value.length<=100?value.trim().replace(/[^\p{L}\p{N}\s.'’&-]/gu,'').replace(/\s+/g,' ').trim():'';
 const airport=(code,item)=>{
  if(!item||item.code!==code)return `${code} (${code})`;
  const name=safeName(item.name),city=safeName(item.city),region=safeName(item.region),country=safeName(item.country);
  if(!name)return `${code} (${code})`;
  const location=[city,region].filter(Boolean);
  if(country&&(!region||country.toLocaleLowerCase('en')!=='canada'))location.push(country);
  return `${location.join(', ')||code} (${code}-${name})`;
 };
 const leg=(from,to,dateValue,fromAirport,toAirport)=>`from:${airport(from,fromAirport)},to:${airport(to,toAirport)},departure:${human(dateValue)}TANYT,fromType:AIRPORT,toType:AIRPORT`;
 const url=new URL('https://www.expedia.ca/Flights-Search');url.searchParams.set('flight-type','on');url.searchParams.set('mode','search');url.searchParams.set('trip',tripType==='round-trip'?'roundtrip':'oneway');url.searchParams.set('leg1',leg(origin,destination,departureDate,originAirport,destinationAirport));
 if(tripType==='round-trip'){url.searchParams.set('leg2',leg(destination,origin,returnDate,destinationAirport,originAirport));url.searchParams.set('toDate',human(returnDate));url.searchParams.set('d2',returnDate);}
 url.searchParams.set('options',`cabinclass:${cabin}`);url.searchParams.set('fromDate',human(departureDate));url.searchParams.set('d1',departureDate);url.searchParams.set('passengers','adults:1,infantinlap:N');return url.toString();
}

export async function searchOmkarExpedia(input,options={}){
 const apiKey=options.apiKey??process.env.OMKAR_API_KEY;if(!apiKey)throw new SourceRequestError('Omkar Expedia is not configured; set OMKAR_API_KEY on the server.',{status:'unconfigured'});
 if(input?.tripType==='round-trip'||input?.returnDate)throw new SourceRequestError('Omkar Expedia documents one-way search only.',{status:'unsupported_trip'});
 const party=validateSearchParty(input),extraPassengerFields=['youths','seniors','infantsInLap','infantsInSeat','infantsOnLap','infantInLap','infantInSeat'];
 if(party.people||party.adults!==1||party.children!==0||extraPassengerFields.some(field=>input?.[field]!==undefined&&input[field]!==0))throw new SourceRequestError('Omkar Expedia currently supports one adult only; no family or identified-party price was requested.',{status:'unsupported_party'});
 const query={origin:input?.origin,destination:input?.destination,date:input?.date,cabin:input?.cabin??'economy',originAirport:input?.originAirport,destinationAirport:input?.destinationAirport};
 if(!code(query.origin)||!code(query.destination)||query.origin===query.destination||!date(query.date)||query.date<new Date().toISOString().slice(0,10)||!cabins[query.cabin])throw Error('Omkar Expedia requires valid airport codes, a future departure date, and a supported cabin.');
 const url=new URL(API);url.search=new URLSearchParams({departure_airport_code:query.origin,arrival_airport_code:query.destination,departure_date:query.date,cabin_class:cabins[query.cabin]}).toString();
 const response=await fetchSource('Expedia via Omkar',url,{headers:{'API-Key':apiKey,Accept:'application/json'},signal:options.signal},{fetcher:options.fetcher,retrySafe:true,timeoutMs:45000});
 const data=await readBoundedSourceJson(response,{provider:'Omkar Expedia',maxBytes:10_000_000});
 if(!Array.isArray(data?.flights))throw new SourceRequestError('Omkar Expedia response schema changed; flights list is missing.',{status:'invalid_response'});
 const observedAt=new Date().toISOString(),searchUrl=expediaSearchUrl({...query,adults:1}),offers=[],priceObservations=[];let rejected=0,routeMismatchFlights=0,flightsWithoutFareOptions=0,fareOptionsExamined=0,unverifiedPrice=0,missingCurrencyEvidence=0,conflictingCurrencyEvidence=0,nonCadCurrency=0,invalidPriceAmount=0,unverifiedTravelerScope=0,priceOnly=0;
 for(const [i,flight] of data.flights.entries()){
  const route=routeSegments(flight,query);if(!route){rejected++;routeMismatchFlights++;continue;}
  const fares=Array.isArray(flight.fare_options)?flight.fare_options:[];
  if(!fares.length)flightsWithoutFareOptions++;
  for(const [j,fare] of fares.entries()){
   fareOptionsExamined++;
   const parsedPrice=priceFor(fare,flight);if(!parsedPrice.price){rejected++;unverifiedPrice++;if(parsedPrice.reason==='missing_currency')missingCurrencyEvidence++;else if(parsedPrice.reason==='conflicting_currency')conflictingCurrencyEvidence++;else if(parsedPrice.reason==='non_cad_currency')nonCadCurrency++;else invalidPriceAmount++;continue;}const price=parsedPrice.price;
   if(!scopeIsOneTraveler(flight,fare)){rejected++;unverifiedTravelerScope++;continue;}
   const result=normalizeFare(flight,fare,route,price,query,observedAt,searchUrl,i*100+j);
   if(result.offer)offers.push(result.offer);else{priceObservations.push(result.observation);priceOnly++;}
  }
 }
 const diagnostics={flightsReceived:data.flights.length,routeMismatchFlights,flightsWithoutFareOptions,fareOptionsExamined,unverifiedPrice,missingCurrencyEvidence,conflictingCurrencyEvidence,nonCadCurrency,invalidPriceAmount,unverifiedTravelerScope,priceOnlyObservations:priceOnly,verifiedOffers:offers.length};
 return {offers,priceObservations,sources:[{provider:'Expedia via Omkar',status:'ok',received:data.flights.length,accepted:offers.length,priceObservations:priceObservations.length,diagnostics,...(rejected?{rejected,reason:`${rejected} Omkar flight/fare rows lacked a matching route, explicit CAD pricing, or verified one-traveler scope.`}:{})}],observedAt,complete:false};
}
