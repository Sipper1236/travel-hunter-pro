import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonWorkerResultError} from '../lib/comparison-worker-result.mjs';
import {validateComparisonQuery} from '../lib/comparison-query.mjs';

const input={mode:'party',origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:2,children:0,filters:{}};
const observedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+10*60_000).toISOString();
const ticket=(adults,price,overrides={})=>({adults,price,currency:'CAD',ignavId:`fare-${adults}-${price}`,provider:'Ignav',observedAt,expiresAt,...overrides});
const plan=(overrides={})=>({itineraryKey:'exact-itinerary',price:350,currency:'CAD',tripType:'one-way',observedAt,expiresAt,segments:[{}],inbound:null,selfTransfer:false,tickets:[ticket(1,200),ticket(1,150)],...overrides});
const result=(overrides={})=>({query:validateComparisonQuery(input),coverage:{fareRequestsStarted:3,requestBudget:30,responsesReused:0,interruptedRequests:0,partyCompositions:3,candidateItineraries:1,matchedPlans:1},plans:[plan()],exhaustive:true,...overrides});

test('comparison worker retains a complete, fresh adult partition with an exact CAD total',()=>{
 assert.equal(comparisonWorkerResultError(result(),input),null);
});

test('comparison worker rejects mismatched totals, stale quotes, and changed query constraints',()=>{
 assert.ok(comparisonWorkerResultError(result({plans:[plan({price:351})]}),input));
 assert.ok(comparisonWorkerResultError(result({plans:[plan({tickets:[ticket(1,200),ticket(1,150,{observedAt:'2020-01-01T00:00:00.000Z'})]})]}),input));
 assert.ok(comparisonWorkerResultError(result({query:{...validateComparisonQuery(input),destination:'LHR'}}),input));
});

test('identified comparison plans cannot separate a minor from the submitted guardian',()=>{
 const identified={mode:'party',origin:'YHZ',destination:'BCN',date:'2027-04-15',tripType:'one-way',cabin:'economy',travelers:[
  {id:'parent',birthDate:'1970-01-01'},
  {id:'other',birthDate:'1971-01-01'},
  {id:'child',birthDate:'2015-01-01',guardianId:'parent'},
 ]};
 const query=validateComparisonQuery(identified),fresh=()=>({observedAt,expiresAt});
 const validPlan={itineraryKey:'family-itinerary',price:300,currency:'CAD',observedAt,expiresAt,segments:[{}],tickets:[{...fresh(),price:200,currency:'CAD',travelerIds:['parent','child']},{...fresh(),price:100,currency:'CAD',travelerIds:['other']}]};
 const envelope={query,coverage:{fareRequestsStarted:7,requestBudget:30,responsesReused:0,interruptedRequests:0},plans:[validPlan],exhaustive:true};
 assert.equal(comparisonWorkerResultError(envelope,identified),null);
 const unsafe=structuredClone(envelope);unsafe.plans[0].tickets=[{...fresh(),price:200,currency:'CAD',travelerIds:['parent']},{...fresh(),price:100,currency:'CAD',travelerIds:['other','child']}];
 assert.ok(comparisonWorkerResultError(unsafe,identified));
});

test('exhausted comparison budgets cannot claim fare requests beyond the validated cap',()=>{
 const limited=result({plans:[],coverage:{fareRequestsStarted:31,requestBudget:30,responsesReused:0,interruptedRequests:0}});
 assert.ok(comparisonWorkerResultError(limited,input));
});

test('separate-ticket plans cover every exact baseline segment once and reject changed flights',()=>{
 const segmentInput={mode:'segments',origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],searchLimit:4,itineraryKey:JSON.stringify([
  ['AC','100','YHZ','2099-04-15T08:00:00','2099-04-15T08:00:00Z','YUL','2099-04-15T09:00:00','2099-04-15T09:00:00Z',null],
  ['AC','200','YUL','2099-04-15T13:00:00','2099-04-15T13:00:00Z','BCN','2099-04-15T21:00:00','2099-04-15T21:00:00Z',null],
 ])};
 const flight=(from,to,number,departure,arrival)=>({marketing_carrier_code:'AC',flight_number:number,departure_airport:from,arrival_airport:to,departure_time_local:departure.slice(0,19),departure_time_utc:departure,arrival_time_local:arrival.slice(0,19),arrival_time_utc:arrival});
 const first=flight('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z'),second=flight('YUL','BCN','200','2099-04-15T13:00:00Z','2099-04-15T21:00:00Z');
 const makeTicket=(segment,segmentNumber,price)=>({direction:'outbound',segment:segmentNumber,segmentEnd:segmentNumber,adults:1,price,currency:'CAD',cabin:'economy',ignavId:`segment-${segmentNumber}`,observedAt,segments:[segment]});
 const segmentPlan={price:300,currency:'CAD',observedAt,expiresAt,segments:[],tickets:[makeTicket(first,1,100),makeTicket(second,2,200)]};
 const routeCoverage={scope:'same_exact_airport_pair_refresh',candidateItinerariesReturned:0,matchingAlternatives:0,alternativesShown:0,displayLimit:8,omittedMatchingAlternatives:0,providerCompletionKnown:false,providerReportedComplete:false,alternateAirportPairsPlanned:0,alternateAirportPairsAttempted:0,alternateAirportPairsAttemptedList:[],alternateAirportPairsSearched:0,alternateAirportPairsSearchedList:[],alternateAirportPairsStoppedList:[],alternateAirportPairsNotSearched:[],airportPairSearchLimit:8,exhaustive:false};
 const envelope={query:validateComparisonQuery(segmentInput),coverage:{fareRequestsStarted:3,requestBudget:4,responsesReused:0,interruptedRequests:0},plans:[segmentPlan],routeAlternatives:[],routeAlternativeCoverage:routeCoverage};
 assert.equal(comparisonWorkerResultError(envelope,segmentInput),null);
 const changed=structuredClone(envelope);changed.plans[0].tickets[1].segments[0].flight_number='999';
 assert.ok(comparisonWorkerResultError(changed,segmentInput));
});

test('alternate-route coverage preserves unsearched airport pairs and never claims exhaustive coverage',()=>{
 const routeInput={mode:'segments',origin:'YHZ',destination:'BCN',date:'2099-04-15',adults:1,children:0,childrenAges:[],searchLimit:4,routeSearchLimit:1,routePairs:[{origin:'YHZ',destination:'LHR'},{origin:'YHZ',destination:'CDG'}],itineraryKey:'selected-itinerary'};
 const query=validateComparisonQuery(routeInput),coverage={scope:'bounded_resolved_airport_pairs',candidateItinerariesReturned:0,matchingAlternatives:0,alternativesShown:0,displayLimit:8,omittedMatchingAlternatives:0,providerCompletionKnown:false,providerReportedComplete:false,alternateAirportPairsPlanned:2,alternateAirportPairsAttempted:0,alternateAirportPairsAttemptedList:[],alternateAirportPairsSearched:0,alternateAirportPairsSearchedList:[],alternateAirportPairsStoppedList:[],alternateAirportPairsNotSearched:routeInput.routePairs,airportPairSearchLimit:1,exhaustive:false};
 const envelope={query,coverage:{fareRequestsStarted:1,requestBudget:4,responsesReused:0,interruptedRequests:0},plans:[],routeAlternatives:[],routeAlternativeCoverage:coverage};
 assert.equal(comparisonWorkerResultError(envelope,routeInput),null);
 const understated=structuredClone(envelope);understated.routeAlternativeCoverage.alternateAirportPairsNotSearched.pop();
 assert.ok(comparisonWorkerResultError(understated,routeInput));
 const falselyComplete=structuredClone(envelope);falselyComplete.routeAlternativeCoverage.exhaustive=true;
 assert.ok(comparisonWorkerResultError(falselyComplete,routeInput));
});
