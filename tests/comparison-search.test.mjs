import test from 'node:test';
import assert from 'node:assert/strict';
import {executeComparison} from '../lib/comparison-search.mjs';
import {validateComparisonQuery,comparisonStorageKey} from '../lib/comparison-query.mjs';
import {comparisonWorkerResultError} from '../lib/comparison-worker-result.mjs';
const leg=(from,to,n,depart,arrive)=>({marketing_carrier_code:'AC',flight_number:n,departure_airport:from,arrival_airport:to,departure_time_utc:depart,arrival_time_utc:arrive,departure_time_local:depart.slice(0,19),arrival_time_local:arrive.slice(0,19)});
const legs=[leg('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z'),leg('YUL','BCN','200','2099-04-15T13:00:00Z','2099-04-15T21:00:00Z')];
const input={mode:'segments',origin:'YHZ',destination:'BCN',date:'2099-04-15',itineraryKey:'target',adults:1,children:0,childrenAges:[],cabin:'economy',searchLimit:4};
const response=q=>({observedAt:new Date().toISOString(),sources:[{provider:'Ignav',status:'ok'}],offers:[{itineraryKey:q.origin==='YHZ'&&q.destination==='BCN'?'target':'segment',ignavId:'fare_1234',price:q.origin==='YHZ'&&q.destination==='BCN'?600:q.origin==='YHZ'?100:250,currency:'CAD',cabin:'economy',observedAt:new Date().toISOString(),segments:q.origin==='YHZ'&&q.destination==='BCN'?legs:[q.origin==='YHZ'?legs[0]:legs[1]]}]});

test('comparison input is bounded, validated and stripped before enqueue or execution',()=>{
 const safe=validateComparisonQuery({...input,forgedEvidence:{price:1}});assert.equal(safe.forgedEvidence,undefined);assert.equal(safe.minConnectionMinutes,180);
 for(const change of [{origin:'Europe'},{destination:'YHZ'},{date:'2099-02-30'},{adults:0},{adults:undefined},{children:1,childrenAges:[10]},{tripType:'round-trip'},{splitPassengers:'true'},{searchLimit:201},{routeSearchLimit:-1},{routeSearchLimit:21},{cabin:'invalid'},{mode:'other'}])assert.throws(()=>validateComparisonQuery({...input,...change}));
 assert.equal(comparisonStorageKey(input),comparisonStorageKey({...input,searchLimit:100,splitPassengers:true}));
 assert.equal(comparisonStorageKey({...input,returnDate:''}),comparisonStorageKey(validateComparisonQuery(input)));
 assert.notEqual(comparisonStorageKey(input),comparisonStorageKey({...input,date:'2099-04-16'}));
 assert.notEqual(comparisonStorageKey(input),comparisonStorageKey({...input,filters:{maxPrice:500}}));
});
test('bounded exact alternate airport pairs survive comparison validation and identify saved jobs',()=>{
 const routePairs=[{origin:'YHZ',destination:'LAX'},{origin:'YUL',destination:'LAX'},{origin:'YHZ',destination:'SNA'},{origin:'YUL',destination:'SNA'}];
 const safe=validateComparisonQuery({...input,routePairs});
 assert.deepEqual(safe.routePairs,routePairs);
 assert.notEqual(comparisonStorageKey(input),comparisonStorageKey({...input,routePairs}));
 assert.throws(()=>validateComparisonQuery({...input,mode:'party',routePairs}),/segment comparisons/);
 for(const change of [{routePairs:'YHZ-LAX'},{routePairs:Array(101).fill({origin:'YHZ',destination:'LAX'})},{routePairs:[{origin:'YHZ',destination:'YHZ'}]},{routePairs:[{origin:'YHZ',destination:'LAX'},{origin:'YHZ',destination:'LAX'}]},{routePairs:[{origin:'Europe',destination:'LAX'}]}])assert.throws(()=>validateComparisonQuery({...input,...change}));
});
test('regional 20-by-20 airport candidates fit comparison validation while actual searches stay separately bounded',()=>{
 const codes=(prefix)=>Array.from({length:20},(_,i)=>`${prefix}${String.fromCharCode(65+i)}A`);
 const origins=codes('A'),destinations=codes('B');
 const routePairs=origins.flatMap(origin=>destinations.map(destination=>({origin,destination})));
 const safe=validateComparisonQuery({...input,routePairs,routeSearchLimit:20});
 assert.equal(safe.routePairs.length,400);assert.equal(safe.routeSearchLimit,20);
 assert.throws(()=>validateComparisonQuery({...input,routePairs:[...routePairs,{origin:'YHZ',destination:'LAX'}]}),/400/);
});
test('large regional candidate coverage reports every pair left outside the fare request budget',async()=>{
 const codes=prefix=>Array.from({length:20},(_,i)=>`${prefix}${String.fromCharCode(65+i)}A`);
 const routePairs=[{origin:'YHZ',destination:'BCN'},...codes('A').flatMap(origin=>codes('B').map(destination=>({origin,destination})))].slice(0,400);
 const calls=[];
 const result=await executeComparison({...input,searchLimit:5,routePairs,routeSearchLimit:20},{searcher:async query=>{calls.push(query);return response(query);}});
 assert.equal(calls.length,5);assert.equal(result.routeAlternativeCoverage.alternateAirportPairsPlanned,399);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsSearched,2);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsNotSearched.length,397);
 assert.equal(result.routeAlternativeCoverage.exhaustive,false);
});
test('provider refusal distinguishes an attempted alternate pair from a completed search',async()=>{
 const pairs=[{origin:'YHZ',destination:'BCN'},{origin:'YUL',destination:'LAX'},{origin:'YHZ',destination:'SNA'}],calls=[];
 const result=await executeComparison({...input,searchLimit:4,routeSearchLimit:2,routePairs:pairs},{searcher:async query=>{
  calls.push(query);
  if(query.origin==='YHZ'&&query.destination==='BCN')return response(query);
  return {offers:[],sources:[{provider:'Ignav',status:'rate_limited'}]};
 }});
 assert.equal(result.status,'source_unavailable');assert.equal(calls.length,2);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsPlanned,2);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsAttempted,1);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsAttemptedList,[{origin:'YUL',destination:'LAX'}]);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsSearched,0);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsSearchedList,[]);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsStoppedList,[{origin:'YUL',destination:'LAX'}]);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsNotSearched,[{origin:'YHZ',destination:'SNA'}]);
});
test('baseline provider refusal persists as unavailable, preserves partial alternatives and sends no more fare requests',async()=>{
 const routePairs=[{origin:'YUL',destination:'LAX'}],alternate=[leg('YHZ','YYZ','301','2099-04-15T07:00:00Z','2099-04-15T09:00:00Z'),leg('YYZ','BCN','302','2099-04-15T12:00:00Z','2099-04-15T20:00:00Z')],observedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+60000).toISOString();let calls=0;
 const query={...input,routePairs,routeSearchLimit:1};
 const result=await executeComparison(query,{searcher:async q=>{calls++;return {complete:false,sources:[{provider:'Ignav',status:'rate_limited',received:2,accepted:2}],offers:[{itineraryKey:'target',ignavId:'baseline',price:600,currency:'CAD',observedAt,cabin:'economy',segments:legs},{itineraryKey:'alternate',ignavId:'alternate',price:550,currency:'CAD',observedAt,expiresAt,cabin:'economy',segments:alternate}]};}});
 assert.equal(result.status,'source_unavailable');assert.equal(calls,1);assert.deepEqual(result.plans,[]);
 assert.equal(result.coverage.fareRequestsStarted,1);assert.equal(result.coverage.requestBudget,query.searchLimit);
 assert.equal(result.routeAlternativeCoverage.providerReportedComplete,false);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsNotSearched,routePairs);
 assert.equal(result.routeAlternatives.length,1);
 assert.equal(comparisonWorkerResultError(result,query),null);
});
test('identified segment queries preserve actual ages and guardian links for downstream ticket grouping',()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'child',birthDate:'2090-01-01',guardianId:'parent'}];
 const identifiedInput={mode:'segments',origin:input.origin,destination:input.destination,date:input.date,itineraryKey:input.itineraryKey,cabin:input.cabin,travelers};
 const safe=validateComparisonQuery(identifiedInput);
 assert.deepEqual(safe.travelers,travelers);assert.equal(safe.adults,undefined);assert.equal(safe.children,undefined);
 assert.throws(()=>validateComparisonQuery({...identifiedInput,travelers:[{id:'child',birthDate:'2090-01-01'}]}),/guardian/);
});
test('comparison executor withholds totals when a separately priced block has a different operator',async()=>{
 const baselineSegments=[{...legs[0],operating_carrier_name:'Air Canada'},{...legs[1],operating_carrier_name:'Example Air'}];
 const r=await executeComparison(input,{searcher:async q=>{
  if(q.origin==='YHZ'&&q.destination==='BCN')return {observedAt:new Date().toISOString(),sources:[{provider:'Ignav',status:'ok'}],offers:[{itineraryKey:'target',ignavId:'baseline',price:600,currency:'CAD',cabin:'economy',observedAt:new Date().toISOString(),segments:baselineSegments}]};
  const source=q.origin==='YHZ'?{...legs[0],operating_carrier_name:'Different Operator'}:{...legs[1],operating_carrier_name:'Example Air'};
  return {observedAt:new Date().toISOString(),sources:[{provider:'Ignav',status:'ok'}],offers:[{itineraryKey:'segment',ignavId:`${q.origin}-${q.destination}`,price:200,currency:'CAD',cabin:'economy',observedAt:new Date().toISOString(),segments:[source]}]};
 }});
 assert.equal(r.status,'segment_unavailable');assert.deepEqual(r.plans,[]);assert.equal(r.coverage.fareRequestsStarted,3);
});
test('budgeted executor exposes a refreshed route alternative without spending extra search requests',async()=>{
 const alternate=[leg('YHZ','YYZ','301','2099-04-15T07:00:00Z','2099-04-15T09:00:00Z'),leg('YYZ','BCN','302','2099-04-15T12:00:00Z','2099-04-15T20:00:00Z')];let calls=0;
 const result=await executeComparison(input,{searcher:async q=>{calls++;if(q.origin==='YHZ'&&q.destination==='BCN')return {observedAt:new Date().toISOString(),sources:[{provider:'Ignav',status:'ok'}],offers:[{itineraryKey:'target',ignavId:'baseline',price:600,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:legs},{itineraryKey:'alt-key',ignavId:'alternate',price:550,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:alternate}]};return response(q);}});
 assert.equal(calls,3);assert.equal(result.coverage.fareRequestsStarted,3);assert.equal(result.coverage.routeAlternativesDiscovered,1);assert.equal(result.routeAlternatives[0].itineraryKey,'alt-key');assert.equal(result.routeAlternatives[0].outbound.via[0],'YYZ');
});
test('searches bounded resolved airport pairs within the fare budget and preserves the exact trip query',async()=>{
 const routePairs=[{origin:'YHZ',destination:'BCN'},{origin:'YUL',destination:'LAX'},{origin:'YHZ',destination:'SNA'},{origin:'YUL',destination:'SNA'},{origin:'YHZ',destination:'LAX'},{origin:'YYZ',destination:'LAX'},{origin:'YYZ',destination:'SNA'}];
 const checked=[],searchCalls=[];
 const result=await executeComparison({...input,searchLimit:10,routeSearchLimit:4,routePairs,filters:{maxStops:1,airlinesInclude:['AC']}},{searcher:async q=>{
  searchCalls.push(q);
  if(q.origin==='YHZ'&&q.destination==='BCN')return {complete:false,observedAt:new Date().toISOString(),sources:[{provider:'Ignav',status:'ok'}],offers:[{itineraryKey:'target',ignavId:'baseline',price:600,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:legs}]};
  if(routePairs.some(pair=>pair.origin===q.origin&&pair.destination===q.destination)&&!(q.origin==='YHZ'&&q.destination==='BCN')){
   checked.push(`${q.origin}-${q.destination}`);
   assert.equal(q.date,input.date);assert.equal(q.tripType,'one-way');assert.equal(q.cabin,'economy');assert.equal(q.adults,1);assert.deepEqual(q.filters,{maxStops:1,maxPrice:null,maxDurationMinutes:null,departureWindow:null,sort:'price',minLayover:null,maxLayover:null,airlinesInclude:['AC'],airlinesExclude:[],countriesExclude:[]});
   const segment=leg(q.origin,q.destination,`ALT${checked.length}`,'2099-04-15T12:00:00Z','2099-04-15T15:00:00Z');
   return {complete:false,offers:[{itineraryKey:`${q.origin}-${q.destination}`,ignavId:`alt-${checked.length}`,price:500+checked.length,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:[segment]}]};
  }
  return response(q);
 }});
 assert.deepEqual(checked,['YUL-LAX','YHZ-SNA','YUL-SNA','YHZ-LAX']);
 assert.equal(searchCalls.length,7);
 assert.deepEqual(result.routeAlternatives.map(route=>route.outbound.from+'-'+route.outbound.to),checked);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsSearched,4);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsSearchedList,[{origin:'YUL',destination:'LAX'},{origin:'YHZ',destination:'SNA'},{origin:'YUL',destination:'SNA'},{origin:'YHZ',destination:'LAX'}]);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsNotSearched,[{origin:'YYZ',destination:'LAX'},{origin:'YYZ',destination:'SNA'}]);
 assert.equal(result.routeAlternativeCoverage.providerCompletionKnown,true);
 assert.equal(result.routeAlternativeCoverage.providerReportedComplete,false);
 assert.equal(result.coverage.fareRequestsStarted,7);
});
test('route-pair search setting expands to eight by default and remains bounded by the job budget',async()=>{
 const routePairs=[{origin:'YHZ',destination:'BCN'},...Array.from({length:10},(_,i)=>({origin:['YUL','YYZ'][i%2],destination:`${String.fromCharCode(65+Math.floor(i/26))}${String.fromCharCode(65+i%26)}A`}))];
 const checked=[],alternatePairs=[],pairKeys=new Set(routePairs.map(pair=>`${pair.origin}-${pair.destination}`));
 const result=await executeComparison({...input,searchLimit:20,routePairs},{searcher:async q=>{
  if(q.origin==='YHZ'&&q.destination==='BCN')return {sources:[{provider:'Ignav',status:'ok'}],offers:[{itineraryKey:'target',ignavId:'baseline',price:600,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:legs}]};
  checked.push(`${q.origin}-${q.destination}`);if(pairKeys.has(`${q.origin}-${q.destination}`)&&!(q.origin==='YHZ'&&q.destination==='BCN'))alternatePairs.push(`${q.origin}-${q.destination}`);
  return {sources:[{provider:'Ignav',status:'ok'}],offers:[]};
 }});
 assert.equal(alternatePairs.length,8);assert.equal(result.routeAlternativeCoverage.airportPairSearchLimit,8);assert.equal(result.routeAlternativeCoverage.alternateAirportPairsSearched,8);assert.equal(result.routeAlternativeCoverage.alternateAirportPairsNotSearched.length,2);assert.equal(result.routeAlternativeCoverage.exhaustive,false);
});
test('bounded alternate airport searches preserve round-trip dates and traveler identities',async()=>{
 const trip={...input,tripType:'round-trip',returnDate:'2099-04-20',searchLimit:30,travelers:[{id:'adult-1',birthDate:'2070-01-01'}],adults:undefined,children:undefined,childrenAges:undefined,routePairs:[{origin:'YHZ',destination:'BCN'},{origin:'YUL',destination:'LAX'}]};
 const outbound=legs,inbound=[leg('BCN','YUL','300','2099-04-20T08:00:00Z','2099-04-20T09:00:00Z'),leg('YUL','YHZ','400','2099-04-20T13:00:00Z','2099-04-20T14:00:00Z')];let alternate;
 const result=await executeComparison(trip,{searcher:async q=>{
  if(q.origin==='YHZ'&&q.destination==='BCN'&&q.tripType==='round-trip')return {complete:true,offers:[{itineraryKey:'target',ignavId:'baseline',price:900,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:outbound,inbound:{segments:inbound}}]};
  if(q.origin==='YUL'&&q.destination==='LAX'&&q.tripType==='round-trip'){
   alternate=q;const outward=[leg('YUL','LAX','501','2099-04-15T11:00:00Z','2099-04-15T14:00:00Z')],back=[leg('LAX','YUL','502','2099-04-20T12:00:00Z','2099-04-20T20:00:00Z')];
   return {complete:true,offers:[{itineraryKey:'alternate-round-trip',ignavId:'alternate',price:800,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:outward,inbound:{segments:back}}]};
  }
  const chains=[...outbound,...inbound].filter(segment=>segment.departure_airport===q.origin&&segment.arrival_airport===q.destination);
  return {offers:[{itineraryKey:`ticket-${q.origin}-${q.destination}`,ignavId:`ticket-${q.origin}-${q.destination}`,price:100,currency:'CAD',cabin:'economy',observedAt:new Date().toISOString(),segments:chains}]};
 }});
 assert.equal(alternate.tripType,'round-trip');assert.equal(alternate.date,trip.date);assert.equal(alternate.returnDate,trip.returnDate);assert.equal(alternate.cabin,'economy');assert.deepEqual(alternate.travelers,trip.travelers);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsSearched,1);
 assert.equal(result.routeAlternatives[0].itineraryKey,'alternate-round-trip');
 assert.equal(result.routeAlternatives[0].inbound.from,'LAX');assert.equal(result.routeAlternatives[0].inbound.to,'YUL');
});
test('route discovery leaves exact unsearched pairs when the comparison budget has one spare request',async()=>{
 const routePairs=[{origin:'YHZ',destination:'BCN'},{origin:'YUL',destination:'LAX'},{origin:'YHZ',destination:'SNA'}],searched=[];let requests=0;
 const result=await executeComparison({...input,searchLimit:4,routePairs},{searcher:async q=>{
  requests++;
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[{itineraryKey:'target',ignavId:'baseline',price:600,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:legs}]};
  if(routePairs.some(pair=>pair.origin===q.origin&&pair.destination===q.destination)&&q.tripType==='one-way'){
   searched.push({origin:q.origin,destination:q.destination});
   const segment=leg(q.origin,q.destination,'501','2099-04-15T12:00:00Z','2099-04-15T15:00:00Z');
   return {offers:[{itineraryKey:`${q.origin}-${q.destination}`,ignavId:'alternate',price:500,currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',segments:[segment]}]};
  }
  return response(q);
 }});
 assert.equal(requests,4);assert.deepEqual(searched,[{origin:'YUL',destination:'LAX'}]);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsPlanned,2);
 assert.equal(result.routeAlternativeCoverage.alternateAirportPairsSearched,1);
 assert.deepEqual(result.routeAlternativeCoverage.alternateAirportPairsNotSearched,[{origin:'YHZ',destination:'SNA'}]);
 assert.equal(result.coverage.fareRequestsStarted,4);
});
test('request intent is acknowledged before every fare lookup and final results are checkpointed',async()=>{
 let checkpoint,calls=0;const progress=[];
 const r=await executeComparison(input,{onCheckpoint:async value=>{checkpoint=structuredClone(value);},onProgress:p=>progress.push(p),searcher:async q=>{calls++;assert.equal(checkpoint.started,calls);assert.ok(checkpoint.pending);return response(q);}});
 assert.equal(r.plans[0].price,350);assert.equal(r.coverage.fareRequestsStarted,3);assert.equal(checkpoint.pending,null);assert.equal(checkpoint.responses.length,3);assert.equal(progress.at(-1).fareRequestsStarted,3);
 let rerunCalls=0;const reused=await executeComparison(input,{checkpoint,searcher:async()=>{rerunCalls++;}});assert.equal(rerunCalls,0);assert.equal(reused.plans[0].price,350);assert.equal(reused.coverage.responsesReused,3);
});
test('pause during a request preserves spent budget, reuses baseline and counts the repeated read',async()=>{
 let checkpoint,calls=0;const controller=new AbortController();
 await assert.rejects(executeComparison(input,{signal:controller.signal,onCheckpoint:value=>{checkpoint=structuredClone(value);},searcher:async q=>{calls++;if(calls===2){controller.abort(Error('Paused during lookup.'));throw controller.signal.reason;}return response(q);}}),/Paused/);
 assert.equal(checkpoint.started,2);assert.equal(checkpoint.responses.length,1);assert.ok(checkpoint.pending);
 const r=await executeComparison(input,{checkpoint,onCheckpoint:value=>{checkpoint=structuredClone(value);},searcher:async q=>{calls++;return response(q);}});
 assert.equal(calls,4);assert.equal(r.plans[0].price,350);assert.equal(r.coverage.fareRequestsStarted,4);assert.equal(r.coverage.responsesReused,1);assert.equal(r.coverage.interruptedRequests,1);
});
test('recovery cannot overrun a fare budget when an interrupted request used the remaining slot',async()=>{
 const query={...input,searchLimit:3},controller=new AbortController();let checkpoint,calls=0;
 await assert.rejects(executeComparison(query,{signal:controller.signal,onCheckpoint:v=>{checkpoint=structuredClone(v);},searcher:async q=>{calls++;if(calls===2){controller.abort(Error('Paused'));throw controller.signal.reason;}return response(q);}}),/Paused/);
 const r=await executeComparison(query,{checkpoint,searcher:async q=>{calls++;return response(q);}});assert.equal(calls,3);assert.equal(r.status,'budget_exhausted');assert.deepEqual(r.plans,[]);assert.equal(r.coverage.fareRequestsStarted,3);
});
test('failed checkpoint acknowledgement prevents network work and prevents false completion',async()=>{
 let calls=0;await assert.rejects(executeComparison(input,{onCheckpoint:()=>{throw Error('Checkpoint unavailable');},searcher:async()=>{calls++;}}),/Checkpoint unavailable/);assert.equal(calls,0);
 let saves=0;await assert.rejects(executeComparison({...input,mode:'party'},{onCheckpoint:()=>{if(++saves===2)throw Error('Lost acknowledgement');},searcher:async q=>{calls++;return response(q);}}),/Lost acknowledgement/);assert.equal(calls,1);
});
test('stale checkpoint quotes are refreshed and consume remaining budget',async()=>{
 let checkpoint;const first=await executeComparison(input,{onCheckpoint:v=>{checkpoint=structuredClone(v);},searcher:async q=>response(q)});assert.equal(first.plans[0].price,350);
 const stale=new Date(Date.now()-16*60_000).toISOString();for(const entry of checkpoint.responses){entry.savedAt=stale;entry.result.observedAt=stale;entry.result.offers.forEach(o=>o.observedAt=stale);}
 let calls=0;const r=await executeComparison(input,{checkpoint,searcher:async q=>{calls++;return response(q);}});assert.equal(calls,1);assert.equal(r.status,'budget_exhausted');assert.equal(r.coverage.fareRequestsStarted,4);assert.deepEqual(r.plans,[]);
});
test('a checkpoint cannot be reused for a different itinerary or comparison mode',async()=>{
 let checkpoint;await executeComparison(input,{onCheckpoint:v=>{checkpoint=structuredClone(v);},searcher:async q=>response(q)});
 let calls=0;await assert.rejects(executeComparison({...input,destination:'MAD'},{checkpoint,searcher:async()=>{calls++;}}),/checkpoint is invalid/);assert.equal(calls,0);
});
