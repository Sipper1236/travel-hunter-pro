import {calendarDatePairs} from './calendar-query.mjs';
import {flightOfferError} from './flight-offer.mjs';

const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)&&day(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&!/[+-]14:(?!00)/.test(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
function googleCalendarSourceMatches(observation,query){
 try{
  const url=new URL(observation.sourceUrl),trip=query.tripType??'one-way',suffix=trip==='round-trip'?` on ${query.start} through ${observation.returnDate}`:` on ${query.start} one way`;
  return url.origin==='https://www.google.com'&&url.pathname==='/travel/flights'&&url.searchParams.get('q')===`Flights from ${observation.from} to ${observation.to}${suffix}`&&url.searchParams.get('hl')==='en-CA'&&url.searchParams.get('gl')==='CA'&&url.searchParams.get('curr')==='CAD';
 }catch{return false;}
}

/** Check the calendar result at the worker boundary before it becomes durable/user-visible. */
export function calendarWorkerResultError(result){
 if(!result||typeof result!=='object'||Array.isArray(result))return 'result must be an object';
 const query=result.query,coverage=result.coverage;
 if(!query||typeof query!=='object'||!Array.isArray(query.routePairs)||!query.routePairs.length||!Array.isArray(result.dates)||!coverage||typeof coverage!=='object')return 'query, exact route pairs, dates, and coverage are required';
 if(query.routePairs.some(pair=>!pair||!/^[A-Z]{3}$/.test(pair.origin??'')||!/^[A-Z]{3}$/.test(pair.destination??'')||pair.origin===pair.destination)||new Set(query.routePairs.map(pair=>`${pair.origin}:${pair.destination}`)).size!==query.routePairs.length)return 'selected airport pairs are invalid or duplicated';
 if(typeof result.status!=='string'||!instant(result.observedAt))return 'status and offset-aware result observation time are required';
 let expectedDates;
 try{expectedDates=calendarDatePairs(query);}catch{return 'query date combinations are invalid';}
 if(result.dates.length!==expectedDates.length||coverage.datesPlanned!==expectedDates.length||coverage.pairQueriesPlanned!==expectedDates.length*query.routePairs.length)return 'date grid or planned route/date coverage does not match the query';
 for(const field of ['datesChecked','pairQueriesChecked','pairQueriesFailed','pairQueriesUnsupported','pairQueriesNotScanned','fareRequestsStarted','requestBudget'])if(!count(coverage[field]))return `coverage counter ${field} is missing or invalid`;
 if(coverage.requestBudget!==query.searchLimit||typeof coverage.fullyScanned!=='boolean'||coverage.fareRequestsStarted>coverage.requestBudget||coverage.datesChecked>coverage.datesPlanned)return 'request budget or completion coverage is invalid';
 if(coverage.pairQueriesChecked+coverage.pairQueriesFailed+coverage.pairQueriesUnsupported+coverage.pairQueriesNotScanned!==coverage.pairQueriesPlanned)return 'route/date completion counters do not reconcile';
 for(let index=0;index<expectedDates.length;index++){
  const expected=expectedDates[index],cell=result.dates[index];
  if(!cell||cell.date!==expected.date||(cell.returnDate??null)!==(expected.returnDate??null)||cell.currency!=='CAD'||typeof cell.status!=='string')return 'a date cell does not match the exact query grid';
  if(cell.price!==null&&(!Number.isFinite(cell.price)||cell.price<=0))return 'a calendar price must be positive CAD or null';
  if(cell.offers!==undefined&&!Array.isArray(cell.offers))return 'date-cell observations must be an array';
  if(cell.priceObservations!==undefined&&!Array.isArray(cell.priceObservations))return 'date-cell price-only observations must be an array';
  if(cell.price!==null&&!cell.offer||cell.offer&&cell.price!==cell.offer.price)return 'a displayed calendar price does not match its observed offer';
  if(cell.price!==null&&(cell.observedAt!==cell.offer.observedAt||cell.route?.origin!==cell.offer.from||cell.route?.destination!==cell.offer.to))return 'a displayed calendar price has inconsistent observation or route metadata';
  if(cell.status==='observed'&&cell.price===null)return 'an observed calendar cell is missing its price';
  const offers=[...(Array.isArray(cell.offers)?cell.offers:[]),...(cell.offer?[cell.offer]:[])];
  for(const offer of offers){
   if(!query.routePairs.some(pair=>pair.origin===offer?.from&&pair.destination===offer?.to))return 'an offer is outside the selected airport pairs';
   const exactQuery={origin:offer.from,destination:offer.to,date:cell.date,tripType:query.tripType,...(cell.returnDate?{returnDate:cell.returnDate}:{}),cabin:query.cabin};
   if(flightOfferError(offer,exactQuery))return 'an offer failed exact route, traveler-price provenance, freshness, or segment validation';
   if(Date.parse(offer.observedAt)>Date.parse(result.observedAt)+120000)return 'an offer observation occurs after the calendar result time';
  }
  for(const observation of cell.priceObservations??[]){
   if(observation?.provider!=='Google Flights'||observation.currency!=='CAD'||!Number.isSafeInteger(observation.price)||observation.price<=0||observation.date!==cell.date||observation.calendarStart!==query.start||observation.calendarEnd!==query.end||(observation.returnDate??null)!==(cell.returnDate??null)||observation.tripType!==query.tripType||!query.routePairs.some(pair=>pair.origin===observation.from&&pair.destination===observation.to))return 'a price-only observation does not match its exact provider, currency, date, trip or route';
   const expectedScope=query.tripType==='round-trip'?`round-trip one adult economy; return ${cell.returnDate}; itinerary details not returned`:'one-way one adult economy; itinerary details not returned';
   if(observation.priceScope!==expectedScope||observation.itineraryVerified!==false||typeof observation.sourceUrl!=='string'||!googleCalendarSourceMatches(observation,query)||typeof observation.bookingStatus!=='string'||!observation.bookingStatus.includes('no ')||!observation.bookingStatus.includes('itinerary'))return 'a Google calendar observation is missing its price-only limits';
   if(!instant(observation.observedAt)||Date.parse(observation.observedAt)>Date.parse(result.observedAt)+120000)return 'a price-only observation has an invalid or future timestamp';
   const source=result.coverage.providerCapabilities?.find(row=>row.id==='google');
   if(query.source!=='google'||!['one-way','round-trip'].includes(query.tripType)||query.adults!==1||(query.children??0)!==0||query.cabin!=='economy'||!source?.eligible)return 'a Google price calendar observation is outside its supported query scope';
  }
 }
 return null;
}
