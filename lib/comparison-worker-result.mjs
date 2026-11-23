import {isDeepStrictEqual} from 'node:util';
import {validateComparisonQuery} from './comparison-query.mjs';
import {flightOfferError} from './flight-offer.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {MAX_SPLIT_SEARCHES} from './split-optimizer.mjs';
import {MAX_ROUTE_ALTERNATIVES_SHOWN} from './separate-tickets.mjs';
import {airportLocalMatchesInstant} from './airport-timezones.mjs';

const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const cents=value=>{const amount=Math.round(value*100);return Number.isFinite(value)&&Number.isSafeInteger(amount)&&amount>0&&Math.abs(value*100-amount)<1e-6?amount:null;};
const airport=value=>typeof value==='string'&&/^[A-Z]{3}$/.test(value);

function checkTicketPrice(ticket){
 if(!object(ticket)||cents(ticket.price)===null||ticket.currency!=='CAD'||!instant(ticket.observedAt)||ticket.expiresAt!==undefined&&(!instant(ticket.expiresAt)||Date.parse(ticket.expiresAt)<=Date.parse(ticket.observedAt))||quoteFreshness(ticket).status!=='fresh')return false;
 return true;
}

function validTicketAssignment(ticket,query){
 if(query.travelers){
  const people=new Map(query.travelers.map(person=>[person.id,person]));
  if(people.size!==query.travelers.length||!Array.isArray(ticket.travelerIds)||ticket.travelerIds.length<1||ticket.travelerIds.some(id=>!people.has(id))||new Set(ticket.travelerIds).size!==ticket.travelerIds.length)return false;
  const group=new Set(ticket.travelerIds);
  for(const id of group){const person=people.get(id);if(person.guardianId&&!group.has(person.guardianId))return false;}
  return ticket.adults===undefined&&ticket.children===undefined;
 }
 return Number.isSafeInteger(ticket.adults)&&ticket.adults>=1&&(ticket.children??0)===0&&ticket.travelerIds===undefined;
}

function checkTravelerPartition(tickets,query){
 if(tickets.some(ticket=>!validTicketAssignment(ticket,query)))return false;
 if(query.travelers){
  const assigned=tickets.flatMap(ticket=>ticket.travelerIds);
  return assigned.length===query.travelers.length&&new Set(assigned).size===assigned.length&&query.travelers.every(person=>assigned.includes(person.id));
 }
 return tickets.reduce((sum,ticket)=>sum+ticket.adults,0)===query.adults;
}

function itinerarySignatures(query){
 try{
  const value=JSON.parse(query.itineraryKey);
  const directions=query.tripType==='round-trip'?
   Array.isArray(value)&&value.length===2&&value.every(key=>typeof key==='string')?value.map(key=>JSON.parse(key)):[]:
   value?[value]:[];
  if(directions.length!==(query.tripType==='round-trip'?2:1)||directions.some(segments=>!Array.isArray(segments)||!segments.length||segments.some(segment=>!Array.isArray(segment)||segment.length!==9)))return null;
  return directions;
 }catch{return null;}
}

function sameSignature(segment,signature){
 return segment.marketing_carrier_code===signature[0]&&segment.flight_number===signature[1]&&segment.departure_airport===signature[2]&&segment.departure_time_local===signature[3]&&segment.departure_time_utc===signature[4]&&segment.arrival_airport===signature[5]&&segment.arrival_time_local===signature[6]&&segment.arrival_time_utc===signature[7]&&(segment.operating_carrier_code??null)===signature[8];
}

function partySegmentKey(segments){
 return JSON.stringify(segments.map(segment=>[segment.marketing_carrier_code,segment.flight_number,segment.departure_airport,segment.departure_time_local,segment.departure_time_utc,segment.arrival_airport,segment.arrival_time_local,segment.arrival_time_utc,segment.operating_carrier_code??null]));
}

function validPartyLeg(segments,from,to,date,notBefore=null){
 if(!Array.isArray(segments)||!segments.length||segments.length>16)return false;
 let previousArrival=notBefore;
 for(let index=0;index<segments.length;index++){
  const segment=segments[index],departure=segment?.departure_time_utc,arrival=segment?.arrival_time_utc;
  if(!object(segment)||!airport(segment.departure_airport)||!airport(segment.arrival_airport)||index&&segments[index-1]?.arrival_airport!==segment.departure_airport||typeof segment.flight_number!=='string'||!segment.flight_number.trim()||typeof segment.marketing_carrier_code!=='string'||!segment.marketing_carrier_code.trim()||!instant(departure)||!instant(arrival)||Date.parse(arrival)<=Date.parse(departure)||previousArrival!==null&&Date.parse(departure)<previousArrival||!airportLocalMatchesInstant(segment.departure_time_local,departure,segment.departure_timezone)||!airportLocalMatchesInstant(segment.arrival_time_local,arrival,segment.arrival_timezone))return false;
  previousArrival=Date.parse(arrival);
 }
 const first=segments[0],last=segments.at(-1);
 return first.departure_airport===from&&last.arrival_airport===to&&first.departure_time_local.slice(0,10)===date;
}

function validPartyPlanItinerary(plan,query){
 if(plan.tripType!==query.tripType||!validPartyLeg(plan.segments,query.origin,query.destination,query.date))return false;
 const outboundKey=partySegmentKey(plan.segments);
 if(query.tripType==='round-trip'){
  const inbound=plan.inbound,segments=inbound?.segments;
  if(!object(inbound)||!validPartyLeg(segments,query.destination,query.origin,query.returnDate,Date.parse(plan.segments.at(-1).arrival_time_utc)))return false;
  const first=segments[0],last=segments.at(-1),via=segments.slice(0,-1).map(segment=>segment.arrival_airport);
  if(inbound.from!==query.destination||inbound.to!==query.origin||inbound.departureDate!==query.returnDate||inbound.departureTime!==first.departure_time_local.slice(11,16)||inbound.arrivalDate!==last.arrival_time_local.slice(0,10)||inbound.arrivalTime!==last.arrival_time_local.slice(11,16)||!Number.isFinite(inbound.durationMinutes)||inbound.durationMinutes<=0||!isDeepStrictEqual(inbound.via,via))return false;
  return plan.itineraryKey===JSON.stringify([outboundKey,partySegmentKey(segments)]);
 }
 return plan.inbound===undefined||plan.inbound===null?plan.itineraryKey===outboundKey:false;
}

function validRouteSummary(route,query,allowedPairs){
 if(!object(route)||typeof route.itineraryKey!=='string'||!route.itineraryKey||cents(route.price)===null||route.currency!=='CAD'||!instant(route.observedAt)||!instant(route.expiresAt)||Date.parse(route.expiresAt)<=Date.parse(route.observedAt)||quoteFreshness(route).status!=='fresh'||!object(route.outbound))return false;
 const checkLeg=(leg,from,to,date)=>{
  if(!object(leg)||leg.from!==from||leg.to!==to||!airport(leg.from)||!airport(leg.to)||leg.departureDate!==date||!Array.isArray(leg.segments)||!leg.segments.length||leg.segments.length>16)return false;
  let previousArrival=null;
  for(let index=0;index<leg.segments.length;index++){
   const segment=leg.segments[index],departure=segment?.departure_time_utc,arrival=segment?.arrival_time_utc,fromCode=segment?.departure_airport,toCode=segment?.arrival_airport;
   if(!airport(fromCode)||!airport(toCode)||index&&leg.segments[index-1]?.arrival_airport!==fromCode||typeof segment?.flight_number!=='string'||!segment.flight_number.trim()||typeof segment?.marketing_carrier_code!=='string'||!segment.marketing_carrier_code.trim()||!instant(departure)||!instant(arrival)||Date.parse(arrival)<=Date.parse(departure)||previousArrival!==null&&Date.parse(departure)<previousArrival||typeof segment.departure_time_local!=='string'||typeof segment.arrival_time_local!=='string')return false;
   previousArrival=Date.parse(arrival);
  }
  const first=leg.segments[0],last=leg.segments.at(-1);
  return first.departure_airport===from&&last.arrival_airport===to&&first.departure_time_local.slice(0,10)===date&&first.departure_time_local.slice(11,16)===leg.departureTime&&last.arrival_time_local.slice(0,10)===leg.arrivalDate&&last.arrival_time_local.slice(11,16)===leg.arrivalTime;
 };
 const outbound=route.outbound;
 if(!allowedPairs.has(`${outbound.from}:${outbound.to}`)||!checkLeg(outbound,outbound.from,outbound.to,query.date))return false;
 if(query.tripType==='round-trip')return checkLeg(route.inbound,outbound.to,outbound.from,query.returnDate);
 return route.inbound===undefined;
}

function routeCoverageError(result,query){
 if(query.mode!=='segments'||result.status==='budget_exhausted')return null;
 const coverage=result.routeAlternativeCoverage,routes=result.routeAlternatives;
 if(!object(coverage)||!Array.isArray(routes))return 'alternate route coverage is missing';
 const planned=(query.routePairs??[]).filter(pair=>pair.origin!==query.origin||pair.destination!==query.destination),plannedKeys=new Set(planned.map(pair=>`${pair.origin}:${pair.destination}`));
 if(coverage.scope!==(planned.length?'bounded_resolved_airport_pairs':'same_exact_airport_pair_refresh')||coverage.exhaustive!==false||coverage.displayLimit!==MAX_ROUTE_ALTERNATIVES_SHOWN)return 'alternate route scope or display bound is invalid';
 for(const field of ['candidateItinerariesReturned','matchingAlternatives','alternativesShown','omittedMatchingAlternatives','alternateAirportPairsPlanned','alternateAirportPairsAttempted','alternateAirportPairsSearched','airportPairSearchLimit'])if(!Number.isSafeInteger(coverage[field])||coverage[field]<0)return `alternate route counter ${field} is invalid`;
 if(typeof coverage.providerCompletionKnown!=='boolean'||typeof coverage.providerReportedComplete!=='boolean'||coverage.providerReportedComplete&&!coverage.providerCompletionKnown||coverage.alternateAirportPairsPlanned!==planned.length||coverage.airportPairSearchLimit!==(query.routeSearchLimit??8)||coverage.alternativesShown!==routes.length||coverage.alternativesShown>coverage.displayLimit||coverage.matchingAlternatives!==coverage.alternativesShown+coverage.omittedMatchingAlternatives)return 'alternate route counts do not reconcile with the validated request';
 const listKeys=field=>{
  if(!Array.isArray(coverage[field]))return null;
  const keys=coverage[field].map(pair=>object(pair)&&airport(pair.origin)&&airport(pair.destination)&&pair.origin!==pair.destination?`${pair.origin}:${pair.destination}`:null);
  return keys.some(key=>key===null)||new Set(keys).size!==keys.length?null:keys;
 };
 const attempted=listKeys('alternateAirportPairsAttemptedList'),searched=listKeys('alternateAirportPairsSearchedList'),stopped=listKeys('alternateAirportPairsStoppedList'),notSearched=listKeys('alternateAirportPairsNotSearched');
 if(!attempted||!searched||!stopped||!notSearched||coverage.alternateAirportPairsAttempted!==attempted.length||coverage.alternateAirportPairsSearched!==searched.length||attempted.length!==searched.length+stopped.length||attempted.some(key=>!plannedKeys.has(key))||searched.some(key=>!attempted.includes(key))||stopped.some(key=>!attempted.includes(key))||searched.some(key=>stopped.includes(key))||notSearched.some(key=>!plannedKeys.has(key))||notSearched.some(key=>attempted.includes(key))||attempted.length+notSearched.length!==planned.length)return 'alternate route coverage lists are inconsistent or outside the selected airport pairs';
 const allowedPairs=new Set([`${query.origin}:${query.destination}`,...plannedKeys]);
 if(routes.some(route=>!validRouteSummary(route,query,allowedPairs)))return 'an alternate itinerary has invalid route, date, currency, freshness, or segment evidence';
 return null;
}

function checkPlan(plan,query){
 if(!object(plan)||!Array.isArray(plan.tickets)||!plan.tickets.length||cents(plan.price)===null||plan.currency!=='CAD'||!instant(plan.observedAt)||!instant(plan.expiresAt)||Date.parse(plan.expiresAt)<=Date.parse(plan.observedAt)||quoteFreshness(plan).status!=='fresh'||plan.tickets.some(ticket=>!checkTicketPrice(ticket)))return false;
 const total=plan.tickets.reduce((sum,ticket)=>sum+cents(ticket.price),0);
 if(!Number.isSafeInteger(total)||total!==cents(plan.price))return false;
 if(query.mode==='party'){
  if(typeof plan.itineraryKey!=='string'||!plan.itineraryKey||!validPartyPlanItinerary(plan,query))return false;
  if(!checkTravelerPartition(plan.tickets,query))return false;
 }else{
  const directions=itinerarySignatures(query);if(!directions)return false;
  const expectedDirections=query.tripType==='round-trip'?['outbound','inbound']:['outbound'];
  if(query.tripType!=='round-trip'&&plan.inbound)return false;
  const grouped=new Map();
  for(const ticket of plan.tickets){
   if(!expectedDirections.includes(ticket.direction)||!Number.isSafeInteger(ticket.segment)||ticket.segment<1||!Number.isSafeInteger(ticket.segmentEnd)||ticket.segmentEnd<ticket.segment||!Array.isArray(ticket.segments)||ticket.segments.length!==ticket.segmentEnd-ticket.segment+1||!validTicketAssignment(ticket,query))return false;
   const direction=directions[ticket.direction==='outbound'?0:1];
   if(ticket.segmentEnd>direction.length||ticket.segments.some((segment,index)=>!sameSignature(segment,direction[ticket.segment-1+index])))return false;
   const first=ticket.segments[0],last=ticket.segments.at(-1);
   const flightOffer={price:ticket.price,currency:ticket.currency,provider:'Ignav',source:'Separate-ticket comparison',observedAt:ticket.observedAt,travelers:query.travelers?'identified travelers':`${ticket.adults} adult${ticket.adults===1?'':'s'}`,bookingStatus:'Comparison observation',fees:'Additional costs unverified',cabin:ticket.cabin??query.cabin,airlines:[...new Set(ticket.segments.map(segment=>segment.marketing_carrier_code??segment.carrier))].filter(Boolean),from:first?.departure_airport,to:last?.arrival_airport,departureDate:first?.departure_time_local?.slice(0,10),departureTime:first?.departure_time_local?.slice(11,16),arrivalDate:last?.arrival_time_local?.slice(0,10),arrivalTime:last?.arrival_time_local?.slice(11,16),durationMinutes:null,via:ticket.segments.slice(0,-1).map(segment=>segment.arrival_airport),segments:ticket.segments};
   if(flightOfferError(flightOffer,{origin:flightOffer.from,destination:flightOffer.to,date:flightOffer.departureDate,cabin:query.cabin,tripType:'one-way'}))return false;
   const key=`${ticket.direction}:${ticket.segment}:${ticket.segmentEnd}`,rows=grouped.get(key)??[];rows.push(ticket);grouped.set(key,rows);
  }
  for(const directionName of expectedDirections){
   const direction=directions[directionName==='outbound'?0:1],ranges=[...grouped.keys()].filter(key=>key.startsWith(`${directionName}:`)).map(key=>key.split(':').slice(1).map(Number)).sort((a,b)=>a[0]-b[0]);
   let next=1;
   for(const [start,end] of ranges){if(start!==next||end>direction.length)return false;const rows=grouped.get(`${directionName}:${start}:${end}`);if(!checkTravelerPartition(rows,query))return false;next=end+1;}
   if(next!==direction.length+1)return false;
  }
 }
 return true;
}

/** Validate persisted comparison plans, quote freshness, totals and party safety. */
export function comparisonWorkerResultError(result,input){
 if(!object(result)||!object(input))return 'result and request must be objects';
 let expected;try{expected=validateComparisonQuery(input);}catch{return 'submitted comparison request is invalid';}
 if(!isDeepStrictEqual(result.query,expected))return 'result does not preserve the validated comparison query';
 if(!Array.isArray(result.plans)||!object(result.coverage))return 'plans and request coverage are required';
 const limit=expected.mode==='segments'?expected.searchLimit:MAX_SPLIT_SEARCHES,coverage=result.coverage;
 for(const field of ['fareRequestsStarted','requestBudget','responsesReused','interruptedRequests'])if(!Number.isSafeInteger(coverage[field])||coverage[field]<0)return `coverage counter ${field} is missing or invalid`;
 if(coverage.requestBudget!==limit||coverage.fareRequestsStarted>limit||coverage.responsesReused>coverage.fareRequestsStarted||coverage.interruptedRequests>coverage.fareRequestsStarted)return 'comparison request coverage exceeds its validated budget';
 if(result.exhaustive!==undefined&&typeof result.exhaustive!=='boolean')return 'exhaustive flag is invalid';
 if(result.plans.some(plan=>!checkPlan(plan,expected)))return 'a ticket plan has an invalid total, stale quote, incomplete segment block, or unsafe traveler assignment';
 if(result.status==='budget_exhausted'&&result.plans.length)return 'an exhausted comparison cannot claim a complete plan';
 const routeError=routeCoverageError(result,expected);if(routeError)return routeError;
 return null;
}
