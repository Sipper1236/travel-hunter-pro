import {flightOfferError} from './flight-offer.mjs';
import {isDeepStrictEqual} from 'node:util';
import {validateFilters} from './flight-filters.mjs';
import {validateTravelerIdentities,validateTravelers} from './travelers.mjs';

const airport=value=>typeof value==='string'&&/^[A-Z]{3}$/.test(value);
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)&&day(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&!/[+-]14:(?!00)/.test(value);
const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const count=value=>Number.isSafeInteger(value)&&value>=0;
const airportCodes=rows=>Array.isArray(rows)?[...new Set(rows.map(row=>typeof row==='string'?row:row?.code).filter(airport))]:[];

function sourceRowsError(sources){
 if(!Array.isArray(sources))return 'source statuses must be an array';
 for(const source of sources){
  if(!object(source)||!text(source.status))return 'a source status is missing its status value';
  if(source.provider!==undefined&&!text(source.provider))return 'a source status has an invalid provider';
  for(const field of ['received','accepted','rejected','priceObservations'])if(source[field]!==undefined&&!count(source[field]))return `a source status has an invalid ${field} count`;
  if(count(source.received))for(const field of ['accepted','rejected','priceObservations'])if(count(source[field])&&source[field]>source.received)return `a source status has an invalid ${field} count`;
 }
 return null;
}

function sourceRowsForRoute(result,offer){
 const coverage=result.coverage;
 if(coverage?.side==='both'){
  const from=offer.from??offer.origin,to=offer.to??offer.destination;
  const route=coverage.checked?.find(row=>row?.origin?.code===from&&row?.destination?.code===to);
  return route?.sources??[];
 }
 if(coverage?.side==='origin'){
  const route=coverage.checked?.find(row=>row?.airport?.code===(offer.from??offer.origin));
  return route?.sources??[];
 }
 if(coverage?.side==='destination'){
  const route=coverage.checked?.find(row=>row?.airport?.code===(offer.to??offer.destination));
  return route?.sources??[];
 }
 return result.sources;
}

function sourceSupports(value,item,kind){
 if(!object(value)||value.provider!==item.provider||!['ok','partial','complete'].includes(value.status))return false;
 if(value.operation!==undefined&&value.operation!==item.section)return false;
 const count=kind==='offer'?value.accepted:value.priceObservations;
 if(!Number.isSafeInteger(count)||count<1)return false;
 return value.received===undefined||count<=value.received;
}

function itemSourceError(result,item,kind){
 const rows=sourceRowsForRoute(result,item);
 return Array.isArray(rows)&&rows.some(source=>sourceSupports(source,item,kind))?null:`a ${kind==='offer'?'flight offer':'price-only observation'} has no matching successful source status with accepted coverage`;
}

function resultRoutes(result,input){
 const exactOrigin=airport(input.origin)?[input.origin]:null,exactDestination=airport(input.destination)?[input.destination]:null;
 const airportCodes=(side)=>{
  const configured=input[`${side}Airports`];
  const resolved=result.locationResolution?.[side]?.airports;
  const coverage=result.coverage?.[side]?.airports;
  const rows=Array.isArray(configured)?configured:Array.isArray(resolved)?resolved:Array.isArray(coverage)?coverage:[];
  return [...new Set(rows.map(row=>typeof row==='string'?row:row?.code).filter(airport))];
 };
 const origins=exactOrigin??airportCodes('origin'),destinations=exactDestination??airportCodes('destination');
 const pairs=new Set();
 if(Array.isArray(result.coverage?.checked))for(const row of result.coverage.checked){
  const origin=row?.origin?.code??row?.origin,destination=row?.destination?.code??row?.destination;
  if(airport(origin)&&airport(destination))pairs.add(`${origin}:${destination}`);
 }
 if(result.coverage?.side==='origin'&&Array.isArray(result.coverage.checked)){
  const destination=exactDestination?.[0]??destinations[0];
  if(destination)for(const row of result.coverage.checked){const origin=row?.airport?.code??row?.airport;if(airport(origin))pairs.add(`${origin}:${destination}`);}
 }
 if(result.coverage?.side==='destination'&&Array.isArray(result.coverage.checked)){
  const origin=exactOrigin?.[0]??origins[0];
  if(origin)for(const row of result.coverage.checked){const destination=row?.airport?.code??row?.airport;if(airport(destination))pairs.add(`${origin}:${destination}`);}
 }
 if(!pairs.size&&origins.length&&destinations.length)for(const origin of origins)for(const destination of destinations)if(origin!==destination)pairs.add(`${origin}:${destination}`);
 return pairs;
}

function queryError(query,input){
 if(!object(query))return 'query is missing';
 const tripType=input.tripType??'one-way',cabin=input.cabin??'economy';
 if(query.origin!==input.origin||query.destination!==input.destination||query.date!==input.date||(query.tripType??'one-way')!==tripType||(query.returnDate??null)!==(tripType==='round-trip'?input.returnDate:null)||(query.cabin??'economy')!==cabin)return 'query does not preserve the submitted route, dates, trip type, or cabin';
 if(!day(input.date)||tripType==='round-trip'&&(!day(input.returnDate)||input.returnDate<input.date))return 'submitted dates are invalid';
 if(input.travelers!==undefined){
  if(['adults','children','childrenAges'].some(key=>input[key]!==undefined)||query.adults!==undefined||query.children!==undefined||query.childrenAges!==undefined||!Array.isArray(query.travelers))return 'query does not preserve the submitted identified traveler party';
  try{
   const travelDates=tripType==='round-trip'?[input.date,input.returnDate]:[input.date];
   const expected=validateTravelerIdentities(input.travelers,travelDates).map(({ages,...traveler})=>traveler);
   if(!isDeepStrictEqual(query.travelers,expected))return 'query does not preserve the submitted traveler identities, birth dates, guardians, or infant seating';
  }catch{return 'submitted identified traveler data is invalid';}
 }else{
  if(query.travelers!==undefined)return 'query changed the submitted count-based party to identified travelers';
  try{
   const expected=validateTravelers(input);
   if((query.adults??1)!==expected.adults||(query.children??0)!==expected.children||!isDeepStrictEqual(query.childrenAges??[],expected.childrenAges))return 'query does not preserve the submitted traveler counts and exact child ages';
  }catch{return 'submitted count-based traveler data is invalid';}
 }
 const allowedFilterFields=new Set(['maxStops','maxPrice','maxDurationMinutes','departureWindow','sort','minLayover','maxLayover','airlinesInclude','airlinesExclude','countriesExclude']);
 for(const value of [input.filters??{},query.filters??{}])if(!object(value)||Object.keys(value).some(key=>!allowedFilterFields.has(key)))return 'query has malformed or unsupported flight filters';
 try{
  if(!isDeepStrictEqual(validateFilters(query.filters),validateFilters(input.filters)))return 'query does not preserve the submitted flight filters';
 }catch{return 'query has malformed flight filters';}
 return null;
}

function observationError(observation,input,routes,resultAt){
 if(!object(observation)||!text(observation.provider)||!airport(observation.origin)||!airport(observation.destination)||!routes.has(`${observation.origin}:${observation.destination}`))return 'a price-only observation has no eligible exact route';
 if(!day(observation.departureDate)||observation.departureDate!==input.date||(input.tripType==='round-trip'&&observation.returnDate!==input.returnDate)||(input.tripType!=='round-trip'&&observation.returnDate!==undefined))return 'a price-only observation does not match the exact travel dates';
 if(!Number.isFinite(observation.price)||observation.price<=0||observation.currency!=='CAD'||!text(observation.priceScope)||!text(observation.travelers)||!text(observation.cabin)||observation.cabin!==(input.cabin??'economy'))return 'a price-only observation has invalid price or party scope';
 if(observation.itineraryVerified!==false||!instant(observation.observedAt)||Date.parse(observation.observedAt)>resultAt+120000)return 'a price-only observation must remain explicitly unverified and have a valid observation time';
 try{const url=new URL(observation.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)return 'a price-only observation has an unsafe source URL';}catch{return 'a price-only observation has an invalid source URL';}
 return null;
}

/** Validate flight-worker output before it can be persisted or streamed as a completed result. */
export function flightWorkerResultError(result,input){
 if(!object(result)||!object(input))return 'result and request must be objects';
 const queryProblem=queryError(result.query,input);if(queryProblem)return queryProblem;
 if(!instant(result.observedAt)||!Array.isArray(result.offers)||!Array.isArray(result.sources)||typeof result.complete!=='boolean')return 'result observation time, offers, sources, and completion flag are required';
 if(result.priceObservations!==undefined&&!Array.isArray(result.priceObservations))return 'price observations must be an array';
 const routes=resultRoutes(result,input);if(!routes.size)return 'no exact searched airport route can be established';
 const sourceProblem=sourceRowsError(result.sources);if(sourceProblem)return sourceProblem;
 for(const offer of result.offers){
  if(!object(offer)||!routes.has(`${offer.from}:${offer.to}`))return 'an offer is outside the exact searched airport routes';
  const offerSourceProblem=itemSourceError(result,offer,'offer');if(offerSourceProblem)return offerSourceProblem;
  const offerQuery={origin:offer.from,destination:offer.to,date:input.date,tripType:input.tripType??'one-way',...(input.tripType==='round-trip'?{returnDate:input.returnDate}:{}),cabin:input.cabin??'economy'};
  if(flightOfferError(offer,offerQuery))return 'an offer failed exact route, traveler-price provenance, freshness, or segment validation';
  if(Date.parse(offer.observedAt)>Date.parse(result.observedAt)+120000)return 'an offer observation occurs after the result observation time';
 }
 for(const observation of result.priceObservations??[]){const problem=observationError(observation,input,routes,Date.parse(result.observedAt));if(problem)return problem;const sourceProblem=itemSourceError(result,observation,'price observation');if(sourceProblem)return sourceProblem;}
 if(result.coverage!==undefined){
  if(!object(result.coverage)||!Array.isArray(result.coverage.checked))return 'route coverage is malformed';
  if(result.coverage.side==='both'){
   if(!Number.isSafeInteger(result.coverage.pairsChecked)||result.coverage.pairsChecked!==result.coverage.checked.length||!Number.isSafeInteger(result.coverage.pairsPlanned)||result.coverage.pairsChecked>result.coverage.pairsPlanned)return 'region pair coverage counters do not match exact checked routes';
   const originCodes=new Set([...airportCodes(input.originAirports),...airportCodes(result.coverage.origin?.airports),...airportCodes(result.coverage.origin?.uncheckedAirports)]);
   const destinationCodes=new Set([...airportCodes(input.destinationAirports),...airportCodes(result.coverage.destination?.airports),...airportCodes(result.coverage.destination?.uncheckedAirports)]);
   const checked=new Set();
   for(const row of result.coverage.checked){
    const origin=row?.origin?.code,destination=row?.destination?.code,key=`${origin}:${destination}`;
    if(!airport(origin)||!airport(destination)||origin===destination||checked.has(key)||originCodes.size&&!originCodes.has(origin)||destinationCodes.size&&!destinationCodes.has(destination)||!Array.isArray(row.sources)||!count(row.offers)||typeof row.complete!=='boolean')return 'region pair coverage has an invalid or unselected airport route';
    const problem=sourceRowsError(row.sources);if(problem)return problem;
    checked.add(key);
   }
  }else if(['origin','destination'].includes(result.coverage.side)){
   for(const row of result.coverage.checked){
    const code=row?.airport?.code;
    if(!airport(code)||!Array.isArray(row.sources)||!count(row.offers)||typeof row.complete!=='boolean')return 'single-region coverage has an invalid checked airport';
    const problem=sourceRowsError(row.sources);if(problem)return problem;
   }
  }else return 'region coverage side is invalid';
 }
 return null;
}
