import {isDeepStrictEqual} from 'node:util';
import {calendarDatePairs,validateCalendarQuery} from './calendar-query.mjs';
import {flightOfferError} from './flight-offer.mjs';
import {matrixCalendarObservation} from './matrix-calendar-observation.mjs';
import {quoteFreshness} from './quote-freshness.mjs';

const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)&&day(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&!/[+-]14:(?!00)/.test(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
function submittedQueryError(query,input,locationCoverage){
 const requestBudget=input.searchLimit??250;
 if(!Number.isSafeInteger(requestBudget)||requestBudget<1||requestBudget>250)return 'submitted calendar query is invalid';
 let submitted;try{submitted=validateCalendarQuery({...input,searchLimit:250},{deferBudget:true});submitted.searchLimit=requestBudget;}catch{return 'submitted calendar query is invalid';}
 const fields=['source','origin','destination','start','end','tripType','nights','nightsMin','nightsMax','returnStart','returnEnd','cabin','adults','children','childrenAges','travelers','filters','matrixOptions','searchLimit','airportLimit'];
 for(const field of fields)if(!isDeepStrictEqual(query[field]??null,submitted[field]??null))return `result does not preserve submitted calendar query field ${field}`;
 for(const side of ['origin','destination']){
  const typeField=`${side}Type`,airportField=`${side}Airports`,expected=submitted[airportField],actual=query[airportField];
  const typePreserved=query[typeField]===submitted[typeField]||submitted[typeField]==='auto'&&query[typeField]==='region'&&locationCoverage?.[side]?.type==='region';
  if(!typePreserved||!Array.isArray(actual)||!actual.length)return `result does not preserve submitted calendar ${side} location`;
  if(expected.length){let cursor=0;for(const code of actual){const index=expected.indexOf(code,cursor);if(index<0)return `result adds an unsubmitted ${side} airport`;cursor=index+1;}}
  else{
   const coverage=locationCoverage?.[side],covered=Array.isArray(coverage?.airports)?coverage.airports.map(row=>row?.code):[];
   if(!coverage||!['place','region'].includes(coverage.type)||typeof coverage.method!=='string'||!coverage.method.trim()||!isDeepStrictEqual(covered,actual))return `resolved ${side} airports have no matching location evidence`;
  }
  const coverage=locationCoverage?.[side];
  if(coverage&&Array.isArray(coverage.airports)&&!isDeepStrictEqual(coverage.airports.map(row=>row?.code),actual))return `${side} location coverage differs from the selected airports`;
  if(expected.length>actual.length&&(!coverage||!Number.isSafeInteger(coverage.uncheckedAirportCount)||coverage.uncheckedAirportCount<expected.length-actual.length||coverage.moreAvailable!==true))return `omitted submitted ${side} airports are not disclosed`;
 }
 const pairs=query.originAirports.flatMap(origin=>query.destinationAirports.filter(destination=>destination!==origin).map(destination=>({origin,destination})));
 if(!isDeepStrictEqual(query.routePairs,pairs))return 'result airport pairs do not match its selected airport candidates';
 return null;
}
function googleCalendarSourceMatches(observation,query){
 try{
  const url=new URL(observation.sourceUrl),trip=query.tripType??'one-way',sourceDate=observation.sourceQueryDate??query.start;
  if(!day(sourceDate)||sourceDate!==query.start)return false;
  const suffix=trip==='round-trip'?` on ${sourceDate} through ${observation.returnDate}`:` on ${sourceDate} one way`;
  return url.origin==='https://www.google.com'&&url.pathname==='/travel/flights'&&url.searchParams.get('q')===`Flights from ${observation.from} to ${observation.to}${suffix}`&&url.searchParams.get('hl')==='en-CA'&&url.searchParams.get('gl')==='CA'&&url.searchParams.get('curr')==='CAD';
 }catch{return false;}
}

/** Check the calendar result at the worker boundary before it becomes durable/user-visible. */
export function calendarWorkerResultError(result,input){
 if(!result||typeof result!=='object'||Array.isArray(result))return 'result must be an object';
 const query=result.query,coverage=result.coverage;
 if(!input||typeof input!=='object'||Array.isArray(input))return 'submitted calendar query is required';
 if(!query||typeof query!=='object'||!Array.isArray(query.routePairs)||!query.routePairs.length||!Array.isArray(result.dates)||!coverage||typeof coverage!=='object')return 'query, exact route pairs, dates, and coverage are required';
 const queryProblem=submittedQueryError(query,input,result.locationCoverage);if(queryProblem)return queryProblem;
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
   if(observation?.provider==='ITA Matrix'){
    if(!matrixCalendarObservation(observation,query,{date:cell.date,returnDate:cell.returnDate??null,start:query.start,end:query.end}))return 'a Matrix price-only observation does not match its exact route, dates, party, cabin, currency or unfiltered query';
    const source=query.source==='ita-matrix'||query.source==='all'&&(cell.providerCoverage??[]).some(row=>row.provider==='ITA Matrix'&&row.origin===observation.from&&row.destination===observation.to&&row.status==='ok');
    const capability=result.coverage.providerCapabilities?.find(row=>row.id==='ita-matrix');
    if(!source||!capability?.eligible)return 'a Matrix price-only observation has no matching successful source coverage';
    continue;
   }
   if(observation?.provider==='Ignav'){
    const nights=query.tripType==='round-trip'?Math.round((Date.parse(`${cell.returnDate}T00:00:00Z`)-Date.parse(`${cell.date}T00:00:00Z`))/86400000):null;
    const expectedQuery={origin:observation.from,destination:observation.to,start:query.start,end:query.end,nights,cabin:query.cabin??'economy',adults:query.adults,children:0,childrenAges:[],maxStops:null,market:'CA',currency:'CAD'};
    const actual=observation.sourceQuery;
    const sourceSelected=query.source==='ignav'||query.source==='all'&&(cell.providerCoverage??[]).some(row=>row.provider==='Ignav'&&row.operation==='cheapest-dates'&&row.origin===observation.from&&row.destination===observation.to&&row.status==='ok');
    const capability=result.coverage.providerCapabilities?.find(row=>row.id==='ignav');
    const sourceRow=(cell.providerCoverage??[]).some(row=>row.provider==='Ignav'&&row.operation==='cheapest-dates'&&row.origin===observation.from&&row.destination===observation.to&&row.status==='ok');
    const exact=observation.provider==='Ignav'&&observation.source==='Ignav cheapest-dates API'&&observation.currency==='CAD'&&Number.isFinite(observation.price)&&observation.price>0&&observation.date===cell.date&&(observation.returnDate??null)===(cell.returnDate??null)&&observation.tripType===query.tripType&&observation.calendarStart===query.start&&observation.calendarEnd===query.end&&query.routePairs.some(pair=>pair.origin===observation.from&&pair.destination===observation.to)&&actual&&Object.keys(expectedQuery).every(field=>JSON.stringify(actual[field])===JSON.stringify(expectedQuery[field]));
    if(!exact)return 'an Ignav calendar observation does not match its exact route, dates, party, cabin or CAD query';
    if(!sourceSelected||!sourceRow||!capability?.eligible||query.travelers||(query.children??0)!==0||!instant(observation.observedAt)||Date.parse(observation.observedAt)>Date.parse(result.observedAt)+120000||quoteFreshness({observedAt:observation.observedAt}).status!=='fresh'||observation.itineraryVerified!==false||typeof observation.bookingStatus!=='string'||!observation.bookingStatus.includes('no itinerary'))return 'an Ignav calendar observation has invalid source coverage, freshness or price-only limits';
    continue;
   }
   if(observation?.provider!=='Google Flights'||observation.currency!=='CAD'||!Number.isSafeInteger(observation.price)||observation.price<=0||observation.date!==cell.date||observation.calendarStart!==query.start||observation.calendarEnd!==query.end||(observation.returnDate??null)!==(cell.returnDate??null)||observation.tripType!==query.tripType||!query.routePairs.some(pair=>pair.origin===observation.from&&pair.destination===observation.to))return 'a price-only observation does not match its exact provider, currency, date, trip or route';
   const expectedScope=query.tripType==='round-trip'?`round-trip one adult economy; return ${cell.returnDate}; itinerary details not returned`:'one-way one adult economy; itinerary details not returned';
   if(observation.priceScope!==expectedScope||observation.itineraryVerified!==false||typeof observation.sourceUrl!=='string'||!googleCalendarSourceMatches(observation,query)||typeof observation.bookingStatus!=='string'||!observation.bookingStatus.includes('no ')||!observation.bookingStatus.includes('itinerary'))return 'a Google calendar observation is missing its price-only limits';
   if(!instant(observation.observedAt)||Date.parse(observation.observedAt)>Date.parse(result.observedAt)+120000)return 'a price-only observation has an invalid or future timestamp';
   const source=result.coverage.providerCapabilities?.find(row=>row.id==='google');
   const googleSelected=query.source==='google'||query.source==='all'&&(cell.providerCoverage??[]).some(row=>row.provider==='Google Flights'&&row.operation==='GetCalendarPicker'&&row.origin===observation.from&&row.destination===observation.to&&row.status==='ok');
   if(!googleSelected||!['one-way','round-trip'].includes(query.tripType)||query.adults!==1||(query.children??0)!==0||query.cabin!=='economy'||!source?.eligible)return 'a Google price calendar observation is outside its supported query scope';
  }
 }
 return null;
}
