import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {searchFareCalendar} from '../lib/calendar-search.mjs';
import {calendarWorkerResultError} from '../lib/calendar-worker-result.mjs';
import {validateCalendarQuery,calendarStorageKey,addDays,calendarSources,calendarProviders} from '../lib/calendar-query.mjs';
import {SourceRequestError} from '../lib/source-errors.mjs';
import {buildMatrixUrl} from '../lib/ita-matrix.mjs';
import {createJobStore} from '../lib/job-store.mjs';
const input={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nights:5,adults:2,children:2,childrenAges:[10,15],cabin:'business',filters:{maxStops:0,maxPrice:1200,airlinesInclude:['AC'],airlinesExclude:['BA'],sort:'price_high'}};
const leg=(from,to,day,n='100',carrier='AC',depart='08:00:00',arrive='16:00:00')=>({marketing_carrier_code:carrier,flight_number:n,departure_airport:from,arrival_airport:to,departure_time_utc:`${day}T${depart}Z`,arrival_time_utc:`${day}T${arrive}Z`,departure_time_local:`${day}T${depart}`,arrival_time_local:`${day}T${arrive}`});
const offer=(q,price=500,extra={})=>({provider:'Ignav',source:'Ignav live fare API',price,currency:'CAD',observedAt:new Date(Date.now()).toISOString(),travelers:'Actual query party',bookingStatus:'Observed; seller not rechecked',fees:'Inclusions unverified',cabin:q.cabin,from:q.origin,to:q.destination,departureDate:q.date,arrivalDate:q.date,departureTime:'08:00',arrivalTime:'16:00',durationMinutes:480,airlines:['AC'],via:[],segments:[leg(q.origin,q.destination,q.date)],ignavId:'fare_12345678',itineraryKey:'exact-flights',...(q.tripType==='round-trip'?{inbound:{from:q.destination,to:q.origin,departureDate:q.returnDate,arrivalDate:q.returnDate,departureTime:'08:00',arrivalTime:'16:00',durationMinutes:480,via:[],segments:[leg(q.destination,q.origin,q.returnDate,'200')]}}:{}),...extra});
const response=offers=>({sources:[{provider:'Ignav',status:'ok',received:offers.length}],offers});
test('Ignav calendar observations reuse the durable exact-query cache across worker connections',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'travel-ignav-calendar-cache-')),path=join(directory,'jobs.sqlite');
 let firstStore=createJobStore({path}),secondStore,calls=0;
 const query={origin:'YHZ',destination:'BCN',originAirports:['YHZ'],destinationAirports:['BCN'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'ignav',searchLimit:1};
 const providerOptions={searchIgnav:async q=>{calls++;return response([offer(q,501)]);}};
 try{
  const first=await searchFareCalendar(query,{providerCache:firstStore,providerOptions});
  const firstObservedAt=first.dates[0].offer?.observedAt;
  assert.ok(firstObservedAt);
  firstStore.close();firstStore=null;
  secondStore=createJobStore({path});
  const second=await searchFareCalendar(query,{providerCache:secondStore,providerOptions});
  assert.equal(calls,1,'the second worker connection must use the exact fresh provider response');
  assert.equal(second.dates[0].offer?.observedAt,firstObservedAt,'cache reuse preserves the original fare observation time');
  assert.equal(second.dates[0].providerCoverage.find(row=>row.provider==='Ignav')?.cacheStatus,'hit');
 }finally{firstStore?.close();secondStore?.close();await rm(directory,{recursive:true,force:true});}
});
test('Google one-way calendar uses one bounded price grid and keeps observations separate from itinerary fares',async()=>{
 const seen=[];const observedAt=new Date().toISOString();
 const sourceUrl='https://www.google.com/travel/flights?'+new URLSearchParams({q:'Flights from YHZ to LHR on 2099-04-15 one way',hl:'en-CA',gl:'CA',curr:'CAD'});
 const observations=['2099-04-15','2099-04-16'].map((date,index)=>({provider:'Google Flights',source:'Google Flights price calendar RPC',from:'YHZ',to:'LHR',date,calendarStart:'2099-04-15',calendarEnd:'2099-04-16',tripType:'one-way',price:700+index,currency:'CAD',observedAt,sourceUrl,priceScope:'one-way one adult economy; itinerary details not returned',itineraryVerified:false,bookingStatus:'Price-only calendar observation; no itinerary, seller availability, baggage or final charges verified.'}));
 const result=await searchFareCalendar({origin:'YHZ',destination:'LHR',start:'2099-04-15',end:'2099-04-16',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google',searchLimit:2},{providerOptions:{searchGoogleCalendar:async query=>{seen.push(query);return {provider:'Google Flights',status:'ok',observedAt,priceObservations:observations,noPriceDates:[],coverage:{datesReturned:2,endpointResponses:1},limitations:['Price-only observations; no itinerary returned.']};}}});
 assert.equal(seen.length,1);assert.equal(seen[0].start,'2099-04-15');assert.equal(seen[0].end,'2099-04-16');
 assert.deepEqual(result.dates.map(cell=>cell.priceObservations.map(row=>row.price)),[[700],[701]]);
 assert.ok(result.dates.every(cell=>cell.price===null&&!cell.offer&&cell.status==='price_only_observed'));
 assert.equal(result.coverage.datesWithQuotes,0);assert.equal(result.coverage.datesWithPriceObservations,2);
 assert.equal(calendarWorkerResultError(result),null);
});

test('Google fixed-return calendar reuses one price grid per selected airport pair',async()=>{
 const seen=[];const observedAt=new Date().toISOString();
 const grid=async query=>{seen.push(query);return {provider:'Google Flights',observedAt,priceObservations:Array.from({length:2},(_,index)=>({provider:'Google Flights',source:'Google Flights price calendar RPC',from:query.origin,to:query.destination,date:addDays(query.start,index),calendarStart:query.start,calendarEnd:query.end,tripType:'round-trip',returnDate:'2099-04-20',price:701+(query.origin==='YUL'?100:0)+index,currency:'CAD',observedAt,sourceUrl:'https://www.google.com/travel/flights?'+new URLSearchParams({q:`Flights from ${query.origin} to ${query.destination} on ${query.start} through 2099-04-20`,hl:'en-CA',gl:'CA',curr:'CAD'}),priceScope:'round-trip one adult economy; return 2099-04-20; itinerary details not returned',itineraryVerified:false,bookingStatus:'Price-only calendar observation; no round-trip itinerary, seller availability, baggage or final charges verified.'})),noPriceDates:[],coverage:{datesReturned:2,endpointResponses:1},limitations:['Price-only observations; no itinerary returned.']};};
 const base={origin:'Canada',originType:'region',destination:'LHR',originAirports:['YHZ','YUL'],destinationAirports:['LHR'],start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',returnStart:'2099-04-20',returnEnd:'2099-04-20',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google',searchLimit:4};
 const result=await searchFareCalendar(base,{providerOptions:{searchGoogleCalendar:grid}});
 assert.equal(seen.length,2);assert.deepEqual(seen.map(query=>query.origin).sort(),['YHZ','YUL']);assert.ok(seen.every(query=>query.returnDate==='2099-04-20'));
 assert.deepEqual(result.dates.map(cell=>cell.priceObservations.map(row=>row.price)),[[701,801],[702,802]]);
 assert.equal(result.coverage.fareRequestsStarted,4,'search budgeting counts exact route/date slots');
 assert.equal(result.coverage.providerResponsesReceived,4,'response coverage counts each route/date observation');
 assert.deepEqual(result.dates.map(cell=>cell.providerCoverage.map(row=>row.wireResponses)),[[1,1],[0,0]],'wire response coverage counts one shared date grid per airport pair');
 assert.equal(result.dates[0].returnDate,'2099-04-20');assert.equal(result.dates[1].price,null);
 assert.equal(calendarWorkerResultError(result),null);
});

test('Google flexible-return calendars reuse one exact-return grid across eligible departures',async()=>{
 const seen=[],observedAt=new Date().toISOString();
 const flexible={origin:'YHZ',destination:'LHR',originAirports:['YHZ'],destinationAirports:['LHR'],start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google',searchLimit:4,returnStart:'2099-04-20',returnEnd:'2099-04-21'};
 const searchGoogleCalendar=async query=>{
  seen.push(query);
  const sourceUrl='https://www.google.com/travel/flights?'+new URLSearchParams({q:`Flights from ${query.origin} to ${query.destination} on ${query.start} through ${query.returnDate}`,hl:'en-CA',gl:'CA',curr:'CAD'});
  return {observedAt,priceObservations:Array.from({length:(Date.parse(query.end)-Date.parse(query.start))/86400000+1},(_,index)=>{const date=addDays(query.start,index);return {provider:'Google Flights',source:'Google Flights price calendar RPC',from:query.origin,to:query.destination,date,calendarStart:query.start,calendarEnd:query.end,tripType:'round-trip',returnDate:query.returnDate,price:700+seen.length+index,currency:'CAD',observedAt,sourceUrl,priceScope:`round-trip one adult economy; return ${query.returnDate}; itinerary details not returned`,itineraryVerified:false,bookingStatus:'Price-only calendar observation; no round-trip itinerary, seller availability, baggage or final charges verified.'};}),noPriceDates:[],coverage:{datesReturned:2,endpointResponses:1}};
 };
 const result=await searchFareCalendar(flexible,{providerOptions:{searchGoogleCalendar}});
 assert.equal(seen.length,2);assert.deepEqual(seen.map(query=>[query.start,query.end,query.returnDate]),[['2099-04-15','2099-04-16','2099-04-20'],['2099-04-15','2099-04-16','2099-04-21']]);
 assert.deepEqual(result.dates.map(cell=>[cell.date,cell.returnDate,cell.priceObservations.map(row=>row.sourceQueryDate)]),[['2099-04-15','2099-04-20',['2099-04-15']],['2099-04-15','2099-04-21',['2099-04-15']],['2099-04-16','2099-04-20',['2099-04-15']],['2099-04-16','2099-04-21',['2099-04-15']]]);
 assert.equal(result.coverage.fareRequestsStarted,4);assert.equal(result.coverage.providerResponsesReceived,4);
 assert.deepEqual(result.dates.map(cell=>cell.providerCoverage.map(row=>row.wireResponses)),[[1],[1],[0],[0]],'two wire grids cover four logical departure/return combinations');
 assert.equal(calendarWorkerResultError(result),null,'durable validation checks the exact per-pair Google source URL and return date');
 const tampered=structuredClone(result);tampered.dates[0].priceObservations[0].sourceQueryDate='2099-04-16';tampered.dates[0].priceObservations[0].sourceUrl='https://www.google.com/travel/flights?'+new URLSearchParams({q:'Flights from YHZ to LHR on 2099-04-16 through 2099-04-20',hl:'en-CA',gl:'CA',curr:'CAD'});
 assert.match(calendarWorkerResultError(tampered),/Google calendar observation is missing its price-only limits/,'the worker rejects source-query dates outside the requested calendar');
 await assert.rejects(searchFareCalendar({...flexible,searchLimit:3},{providerOptions:{searchGoogleCalendar}}),/needs at least 4 provider\/date searches/);
 assert.equal(seen.length,2,'a too-small budget is refused before provider work');
});

test('Google price grid is skipped when active filters need itinerary evidence',async()=>{
 let grids=0,searches=0;const ordinary=async q=>{searches++;return {offers:[],sources:[{provider:'Google Flights',status:'ok'}]};};
 const base={origin:'YHZ',destination:'LHR',originAirports:['YHZ'],destinationAirports:['LHR'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google',searchLimit:2};
 await searchFareCalendar({...base,filters:{airlinesInclude:['AC']}},{providerOptions:{searchGoogle:ordinary,searchGoogleCalendar:async()=>{grids++;return {priceObservations:[],noPriceDates:[],coverage:{}};}}});
 assert.equal(grids,0);assert.equal(searches,1);
});

test('all-source fixed-return calendars include the Google price grid alongside other configured sources',async()=>{
 let googleCalls=0,ignavCalls=0,matrixCalls=0;const observedAt=new Date().toISOString();
 const sourceUrl='https://www.google.com/travel/flights?'+new URLSearchParams({q:'Flights from YHZ to LHR on 2099-04-15 through 2099-04-20',hl:'en-CA',gl:'CA',curr:'CAD'});
 const result=await searchFareCalendar({origin:'YHZ',destination:'LHR',originAirports:['YHZ'],destinationAirports:['LHR'],start:'2099-04-15',end:'2099-04-15',tripType:'round-trip',returnStart:'2099-04-20',returnEnd:'2099-04-20',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'all',searchLimit:3},{providerOptions:{
  searchGoogleCalendar:async query=>{googleCalls++;return {observedAt,priceObservations:[{provider:'Google Flights',source:'Google Flights price calendar RPC',from:query.origin,to:query.destination,date:query.start,calendarStart:query.start,calendarEnd:query.end,tripType:'round-trip',returnDate:'2099-04-20',price:701,currency:'CAD',observedAt,sourceUrl,priceScope:'round-trip one adult economy; return 2099-04-20; itinerary details not returned',itineraryVerified:false,bookingStatus:'Price-only calendar observation; no round-trip itinerary, seller availability, baggage or final charges verified.'}],noPriceDates:[],coverage:{datesReturned:1,endpointResponses:1},limitations:['No itinerary details returned.']};},
  searchIgnav:async()=>{ignavCalls++;return {offers:[],sources:[{provider:'Ignav',status:'ok',received:0,accepted:0}]};},
  searchMatrix:async()=>{matrixCalls++;return {offers:[],priceObservations:[],sources:[{provider:'ITA Matrix',status:'ok',received:0,accepted:0,priceObservations:0}]};},
 }});
 assert.deepEqual([googleCalls,ignavCalls,matrixCalls],[1,1,1]);
 assert.equal(result.dates[0].priceObservations.length,1);assert.equal(result.dates[0].priceObservations[0].provider,'Google Flights');
 assert.equal(result.dates[0].providerCoverage.find(row=>row.provider==='Google Flights').operation,'GetCalendarPicker');
 assert.equal(result.coverage.fareRequestsStarted,3);assert.equal(result.coverage.providerResponsesReceived,3);
 assert.equal(calendarWorkerResultError(result),null);
});

test('all-source calendars retain exact unfiltered Matrix group prices as price-only observations',async()=>{
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'all',searchLimit:2};
 const observedAt=new Date().toISOString();let matrixUrl;
 const providerOptions={
  searchGoogle:async()=>({offers:[],sources:[{provider:'Google Flights',status:'ok',received:0,accepted:0}]}),
  searchMatrix:async matrixQuery=>{matrixUrl=buildMatrixUrl(matrixQuery);return {offers:[],priceObservations:[{id:'matrix-price-1',provider:'ITA Matrix',origin:query.origin,destination:query.destination,departureDate:query.start,price:507,currency:'CAD',priceScope:'Matrix-reported group total',travelers:'1 adult',cabin:'economy',observedAt,sourceUrl:matrixUrl,linkLabel:'Open Matrix search',itineraryVerified:false,details:'Matrix total; flight details could not be validated.'}],sources:[{provider:'ITA Matrix',status:'ok',received:1,accepted:0,priceObservations:1}]};},
 };
 const result=await searchFareCalendar(query,{providerOptions});
 assert.equal(result.dates[0].status,'price_only_observed');assert.equal(result.dates[0].price,null);
 assert.equal(result.dates[0].priceObservations.length,1);
 assert.deepEqual((( {from,to,date,tripType,calendarStart,calendarEnd})=>({from,to,date,tripType,calendarStart,calendarEnd}))(result.dates[0].priceObservations[0]),{from:'YHZ',to:'BCN',date:query.start,tripType:'one-way',calendarStart:query.start,calendarEnd:query.end});
 assert.equal(calendarWorkerResultError(result),null);
 const tampered=structuredClone(result);tampered.dates[0].priceObservations[0].sourceUrl=buildMatrixUrl({origin:'YYZ',destination:'BCN',departureDate:query.start,cabin:'COACH',currency:'CAD',passengers:{adults:1}});
 assert.match(calendarWorkerResultError(tampered),/Matrix price-only observation/,'the worker rejects a Matrix search link for another route');
 const filtered=await searchFareCalendar({...query,filters:{airlinesInclude:['AC']}},{providerOptions});
 assert.equal(filtered.dates[0].priceObservations.length,0,'Matrix total-only rows cannot establish airline-filter compliance');
 const mismatched=await searchFareCalendar(query,{providerOptions:{...providerOptions,searchMatrix:async()=>({offers:[],priceObservations:[{id:'matrix-price-1',provider:'ITA Matrix',origin:'YYZ',destination:'BCN',departureDate:query.start,price:507,currency:'CAD',priceScope:'Matrix-reported group total',travelers:'1 adult',cabin:'economy',observedAt,sourceUrl:matrixUrl,itineraryVerified:false}],sources:[{provider:'ITA Matrix',status:'ok',received:1,accepted:0,priceObservations:1}]})}});
 assert.equal(mismatched.dates[0].priceObservations.length,0,'wrong-route Matrix totals are discarded');
});
test('regional native Google selection receives the exact calendar filters before supplier work',async()=>{
 const seen=[],filters={maxStops:2,airlinesExclude:['WS'],countriesExclude:['US'],minLayover:60,maxLayover:240};
 const result=await searchFareCalendar({...input,cabin:'economy',source:'google',children:1,childrenAges:[15],filters},{providerOptions:{searchGoogleRoundTrip:async q=>{seen.push(q);return {offers:[],sources:[{provider:'Google Flights',status:'ok'}]};}}});
 assert.equal(seen.length,2);assert.ok(seen.every(q=>q.filters.countriesExclude.join(',')==='US'&&q.filters.airlinesExclude.join(',')==='WS'&&q.filters.maxStops===2&&q.filters.minLayover===60&&q.filters.maxLayover===240));
 assert.equal(result.coverage.fareRequestsStarted,2);assert.equal(result.stopped,null);
});

test('fare calendars reject Matrix detail expansion to keep date and airport-pair fanout bounded',()=>{
 assert.throws(()=>validateCalendarQuery({origin:'YHZ',destination:'LAX',originAirports:['YHZ'],destinationAirports:['LAX'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'ita-matrix',searchLimit:1,matrixOptions:{maxExtraLegsRelativeToMinimum:2,allowAirportChanges:false,expandDetailedItineraries:true}}),/Detailed Matrix itinerary expansion is only available for a fixed-date single-airport search/);
});

test('fare calendar publishes the first route fare while later airport pairs are still searching',async()=>{
 const query={origin:'YHZ',destination:'Europe',destinationType:'region',destinationAirports:['BCN','FRA'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'ignav',searchLimit:2};
 let calls=0,releaseSecond,completed=false,resolvePreview,resolveSecondStarted;
 const waitingForSecond=new Promise(resolve=>{releaseSecond=resolve;});
 const secondStarted=new Promise(resolve=>{resolveSecondStarted=resolve;});
 const firstPreview=new Promise(resolve=>{resolvePreview=resolve;});
 const pending=searchFareCalendar(query,{searcher:async q=>{calls++;if(calls===1)return response([offer(q,500)]);resolveSecondStarted();await waitingForSecond;return response([offer(q,400)]);},onProgress:progress=>{const cell=progress.calendarPreview?.dates?.[0];if(cell?.offer?.provider==='Ignav')resolvePreview(cell);}}).then(result=>{completed=true;return result;});
 await secondStarted;
 const early=await firstPreview;
 assert.equal(early.price,500);assert.equal(early.status,'partial_route_coverage');assert.equal(completed,false);
 assert.equal(calls,2);
 releaseSecond();
 const result=await pending;
 assert.equal(result.dates[0].price,400);assert.equal(result.dates[0].status,'observed');assert.equal(result.coverage.fullyScanned,true);
 assert.equal(result.coverage.providerResponsesReceived,result.coverage.providerResponsesPlanned,'each source response is counted once after route completion');
});

test('fare calendar streams every accepted offer from a completed provider query',async()=>{
 const query={origin:'YHZ',destination:'Europe',destinationType:'region',destinationAirports:['BCN','FRA'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'ignav',searchLimit:2};
 let releaseSecond,resolvePreview;
 const waitingForSecond=new Promise(resolve=>{releaseSecond=resolve;});
 const firstPreview=new Promise(resolve=>{resolvePreview=resolve;});
 const pending=searchFareCalendar(query,{searcher:async(q,index)=>{
   if(q.destination==='BCN')return response([offer(q,500),offer(q,520,{ignavId:'fare_87654321',itineraryKey:'second-exact-flight-set'})]);
   await waitingForSecond;return response([offer(q,400)]);
 },onProgress:progress=>{const cell=progress.calendarPreview?.dates?.[0];if(cell?.price===500)resolvePreview(cell);}});
 const early=await firstPreview;
 assert.equal(early.price,500);
 assert.deepEqual(early.offers.map(row=>row.price),[500,520]);
 assert.equal(early.status,'partial_route_coverage');
 releaseSecond();
 await pending;
});

test('calendar streams a Matrix partial itinerary before its final provider response',async()=>{
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'all',searchLimit:2};
 let releaseMatrix,resolvePreview;const waitingForMatrix=new Promise(resolve=>{releaseMatrix=resolve;});
 const firstPreview=new Promise(resolve=>{resolvePreview=resolve;});
 const partial={offers:[offer({...query,date:query.start},400,{provider:'ITA Matrix',source:'ITA Matrix live search'})],priceObservations:[],sources:[{provider:'ITA Matrix',status:'ok',received:1,accepted:1}],observedAt:new Date().toISOString(),complete:false,limitations:[]};
 const pending=searchFareCalendar(query,{providerOptions:{searchGoogle:async()=>({offers:[],sources:[{provider:'Google Flights',status:'ok',received:0,accepted:0}]}),searchMatrix:async(_matrixQuery,options)=>{await options.onUpdate(partial);await waitingForMatrix;return partial;}},onProgress:progress=>{const cell=progress.calendarPreview?.dates?.[0];if(cell?.offer?.provider==='ITA Matrix')resolvePreview(progress.calendarPreview);}});
 const early=await Promise.race([firstPreview,new Promise(resolve=>setTimeout(()=>resolve(null),500))]);
 releaseMatrix();
 const result=await pending;
 assert.ok(early,'Matrix should publish its matched partial itinerary before the adapter finishes');
 assert.equal(early.dates[0].offer.provider,'ITA Matrix');assert.equal(early.dates[0].price,400);
 assert.equal(early.dates[0].status,'partial_route_coverage');assert.equal(early.coverage.pairQueriesChecked,0);
 assert.equal(result.dates[0].price,400);assert.equal(result.dates[0].status,'observed');
});

test('all-source calendar publishes each valid source fare before a later source finishes',async()=>{
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'all',searchLimit:20};
 let releaseExpedia,completed=false,resolvePreview;
 const waitingForExpedia=new Promise(resolve=>{releaseExpedia=resolve;});
 const firstPreview=new Promise(resolve=>{resolvePreview=resolve;});
 const empty=provider=>async()=>({offers:[],sources:[{provider,status:'ok'}]});
 const pending=searchFareCalendar(query,{providerOptions:{
  searchIgnav:empty('Ignav'),
  searchGoogle:async q=>({offers:[offer(q,400,{provider:'Google Flights',source:'Google Flights live search'})],sources:[{provider:'Google Flights',status:'ok'}]}),
  searchExpedia:async()=>{await waitingForExpedia;return {offers:[],sources:[{provider:'Expedia',status:'ok'}]};},searchSkyscanner:empty('Skyscanner'),searchAirCanada:empty('Air Canada NDC'),searchMatrix:empty('ITA Matrix'),searchOmkarExpedia:empty('Expedia via Omkar')
 },onProgress:progress=>{const preview=progress.calendarPreview,cell=preview?.dates?.[0];if(cell?.offer?.provider==='Google Flights')resolvePreview(preview);}}).then(result=>{completed=true;return result;});
 const early=await firstPreview;
 assert.equal(early.dates[0].price,400);assert.equal(early.dates[0].status,'partial_route_coverage');assert.equal(completed,false);
 assert.equal(early.coverage.providerResponsesReceived,2);
 assert.ok(early.coverage.providerResponsesPlanned>early.coverage.providerResponsesReceived);
 assert.equal(early.coverage.pairQueriesChecked,0,'the route/date batch is not complete while Expedia is still pending');
 assert.equal(early.dates[0].providerCoverage.filter(row=>row.responseReceived).length,2);
 assert.equal('travelers' in early.dates[0].providerCoverage[0],false,'provider progress does not duplicate private query traveler data');
 releaseExpedia();
 const result=await pending;
 assert.equal(result.dates[0].price,400);assert.equal(result.dates[0].status,'observed');assert.equal(result.coverage.fullyScanned,true);
});

test('all-source calendar publishes a fast provider while an earlier provider is still pending',async()=>{
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'all',searchLimit:20};
 let releaseIgnav,resolvePreview;const waitingForIgnav=new Promise(resolve=>{releaseIgnav=resolve;});
 const firstPreview=new Promise(resolve=>{resolvePreview=resolve;});
 const empty=provider=>async()=>({offers:[],sources:[{provider,status:'ok'}]});
 const pending=searchFareCalendar(query,{providerOptions:{
  searchIgnav:async q=>{await waitingForIgnav;return response([offer(q,500)]);},
  searchGoogle:async q=>({offers:[offer(q,400,{provider:'Google Flights',source:'Google Flights live search'})],sources:[{provider:'Google Flights',status:'ok'}]}),
  searchExpedia:empty('Expedia'),searchSkyscanner:empty('Skyscanner'),searchAirCanada:empty('Air Canada NDC'),searchMatrix:empty('ITA Matrix'),searchOmkarExpedia:empty('Expedia via Omkar'),
 },onProgress:progress=>{const cell=progress.calendarPreview?.dates?.[0];if(cell?.offer?.provider==='Google Flights')resolvePreview(progress.calendarPreview);}});
 const early=await Promise.race([firstPreview,new Promise(resolve=>setTimeout(()=>resolve(null),50))]);
 releaseIgnav();
 const result=await pending;
 assert.ok(early,'the faster Google result should stream without waiting for the first configured provider');
 assert.equal(early.dates[0].offer.provider,'Google Flights');assert.equal(early.dates[0].price,400);
 assert.equal(early.dates[0].status,'partial_route_coverage');assert.equal(early.coverage.pairQueriesChecked,0);
 assert.ok(early.coverage.providerResponsesReceived<early.coverage.providerResponsesPlanned);
 assert.equal(result.dates[0].price,400);assert.equal(result.dates[0].status,'observed');assert.equal(result.coverage.fullyScanned,true);
});

test('all-source calendar keeps earlier offers and exposes a later provider failure',async()=>{
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'all',searchLimit:20};
 const empty=provider=>async()=>({offers:[],sources:[{provider,status:'ok'}]});
 const result=await searchFareCalendar(query,{providerOptions:{
  searchIgnav:async q=>response([offer(q,500)]),searchGoogle:empty('Google Flights'),
  searchExpedia:async()=>{throw new SourceRequestError('Provider temporarily unavailable.',{status:'temporarily_unavailable',httpStatus:503});},
  searchSkyscanner:empty('Skyscanner'),searchAirCanada:empty('Air Canada NDC'),searchMatrix:empty('ITA Matrix'),searchOmkarExpedia:empty('Expedia via Omkar')
 }});
 assert.equal(result.status,'complete','the exact route completed through providers that returned usable responses');
 assert.equal(result.dates[0].status,'observed');
 assert.equal(result.dates[0].price,500);
 assert.deepEqual(result.dates[0].offers.map(row=>row.price),[500],'the completed Ignav offer remains visible after a later provider failure');
 assert.equal(result.coverage.fullyScanned,false,'the source failure keeps overall provider coverage incomplete');
 assert.ok(result.coverage.sourceCoverage.some(row=>row.provider==='Expedia partner API'&&row.unavailable===1));
});

test('fare calendar applies maximum journey duration to the complete segment chronology',async()=>{
 const trip={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',filters:{maxDurationMinutes:300},source:'ignav',searchLimit:1};
 const segments=[leg('YHZ','YUL',trip.start,'100','AC','08:00:00','10:00:00'),leg('YUL','BCN',trip.start,'200','AC','16:00:00','18:00:00')];
 const result=await searchFareCalendar(trip,{searcher:async q=>response([{...offer(q,500),arrivalTime:'18:00',durationMinutes:600,via:['YUL'],segments}])});
 assert.equal(result.dates[0].status,'no_matching_observation');assert.equal(result.dates[0].price,null);
 assert.equal(result.dates[0].filterRejected.duration,1);
});

test('calendar rejects a Google route price when exact segment details are missing',async()=>{
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google',searchLimit:1};
 const result=await searchFareCalendar(query,{searcher:async q=>({offers:[offer(q,500,{provider:'Google Flights',source:'Google Flights live search',segments:undefined})],sources:[{provider:'Google Flights',status:'ok'}]})});
 assert.equal(result.dates[0].status,'rejected_observations');assert.equal(result.dates[0].price,null);
 assert.equal(result.dates[0].rejected.segments,1);assert.equal(result.coverage.fullyScanned,true);
});

test('an unsupported exact date does not stop later calendar dates or count as no inventory',async()=>{
 const seen=[];
 const result=await searchFareCalendar({...input,source:'ignav'},{searcher:async q=>{
  seen.push([q.origin,q.destination,q.date,q.returnDate]);
  return q.date===input.start?{offers:[],sources:[{provider:'Ignav',status:'unsupported_trip',httpStatus:424,providerCode:'unsupported_search'}]}:response([offer(q)]);
 }});
 assert.equal(seen.length,2);assert.deepEqual(seen[0],['YHZ','BCN',input.start,addDays(input.start,5)]);
 assert.equal(result.dates[0].status,'unsupported_trip');assert.equal(result.dates[0].price,null);
 assert.equal(result.dates[1].status,'observed');assert.equal(result.stopped,null);
 assert.equal(result.status,'partial_unsupported');assert.equal(result.coverage.pairQueriesUnsupported,1);
 assert.equal(result.coverage.datesUnsupported,1);assert.equal(result.coverage.pairQueriesFailed,0);assert.equal(result.coverage.pairQueriesNotScanned,0);assert.equal(result.coverage.fullyScanned,false);
});

test('unsupported airport pairs withhold a date minimum while later regional dates continue',async()=>{
 const result=await searchFareCalendar({...input,source:'ignav',destinationAirports:['BCN','LHR']},{searcher:async q=>q.date===input.start&&q.destination==='LHR'?{offers:[],sources:[{provider:'Ignav',status:'unsupported_trip',httpStatus:424,providerCode:'unsupported_search'}]}:response([offer(q)])});
 assert.equal(result.dates[0].status,'partial_route_coverage');assert.equal(result.dates[0].price,null);
 assert.equal(result.dates[1].status,'observed');assert.equal(result.coverage.fareRequestsStarted,4);
 assert.equal(result.coverage.pairQueriesUnsupported,1);assert.equal(result.coverage.pairQueriesChecked,3);assert.equal(result.coverage.pairQueriesNotScanned,0);
});

test('a thrown exact-query refusal also continues independently and retains sanitized coverage',async()=>{
 const result=await searchFareCalendar({...input,source:'ignav'},{searcher:async q=>{if(q.date===input.start)throw new SourceRequestError('Exact date unsupported.',{status:'unsupported_trip',httpStatus:424,providerCode:'unsupported_search'});return response([offer(q)]);}});
 assert.equal(result.dates[0].status,'unsupported_trip');assert.equal(result.dates[1].status,'observed');
 assert.equal(result.coverage.routeUnsupported[0].sources[0].providerCode,'unsupported_search');
});

test('exact calendar validates party, date range, cabin, nights and budget before work',async()=>{
 const safe=validateCalendarQuery({...input,untrustedQuote:{price:1}});assert.equal(safe.untrustedQuote,undefined);assert.deepEqual(safe.childrenAges,[10,15]);
   for(const change of [{origin:'Europe',originType:'place'},{destination:'YHZ'},{adults:undefined},{children:undefined},{childrenAges:[10]},{start:'2099-02-30'},{end:'2099-05-16'},{end:'2099-04-14'},{tripType:'other'},{tripType:'one-way'},{nights:null},{nights:366},{cabin:'other'},{searchLimit:1}]){
  let calls=0;await assert.rejects(searchFareCalendar({...input,...change},{searcher:()=>{calls++;}}));assert.equal(calls,0);
 }
 assert.equal(addDays('2028-02-28',2),'2028-03-01');assert.equal(addDays('2099-12-30',5),'2100-01-04');
  assert.equal(calendarStorageKey(input),calendarStorageKey({...safe,start:'2099-04-20',end:'2099-04-21',searchLimit:100}));
 assert.notEqual(calendarStorageKey(input),calendarStorageKey({...input,airportLimit:9}));
  assert.notEqual(calendarStorageKey(input),calendarStorageKey({...input,childrenAges:[10,16]}));
 assert.equal(validateCalendarQuery({...input,source:'all'}).source,'all');
 assert.throws(()=>validateCalendarQuery({...input,source:'all',searchLimit:1}),/2 exact provider\/date searches/);
 const unresolved=validateCalendarQuery({...input,origin:'Europe',originType:'region',originAirports:[]});assert.deepEqual(unresolved.originAirports,[]);assert.deepEqual(unresolved.routePairs,[]);
});
test('Skyscanner calendars preserve exact one-way adult queries and reject unsupported chronology or age ranges',()=>{
 const query=validateCalendarQuery({...input,source:'skyscanner',origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-16',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy'});
 assert.equal(query.source,'skyscanner');assert.deepEqual(query.routePairs,[{origin:'YHZ',destination:'BCN'}]);
 for(const change of [
  {tripType:'round-trip',nights:5,children:1,childrenAges:[10]},
  {children:1,childrenAges:[10]},
  {travelers:[{id:'adult',birthDate:'2070-01-01'}]},
  {adults:8,children:1,childrenAges:[10]},
  {end:'2099-04-17',children:1,childrenAges:[10]},
 ])assert.throws(()=>validateCalendarQuery({...query,...change}),/Skyscanner|travelers|actual age|eight/i);
});
test('date calendar validates the trip and party limits of every selectable flight provider',()=>{
 const queryFor=(source,overrides={})=>({origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},searchLimit:1,source,...overrides});
 const compatible={ignav:{},google:{},expedia:{tripType:'round-trip',nights:5},skyscanner:{},'air-canada':{},'ita-matrix':{adults:2,tripType:'round-trip',nights:5},'omkar-expedia':{}};
 assert.deepEqual(calendarProviders.map(([id])=>id),Object.keys(compatible));
 for(const [source,overrides] of Object.entries(compatible))assert.equal(validateCalendarQuery(queryFor(source,overrides)).source,source);
 for(const [source,overrides,reason] of [
  ['google',{adults:2},/one adult only/],['google',{cabin:'business'},/one-way economy/],
  ['expedia',{tripType:'round-trip',nights:5,children:1,childrenAges:[10]},/cannot recalculate child ages/],['air-canada',{tripType:'round-trip',nights:5},/one-way/],
  ['omkar-expedia',{adults:2},/one adult only/],
 ])assert.throws(()=>validateCalendarQuery(queryFor(source,overrides)),reason);
});
test('calendar dispatches exact-date requests through every selected provider adapter',async()=>{
 const calls=[],sourceFor={
  searchGoogle:async q=>{calls.push(['google',q]);return {offers:[],sources:[{provider:'Google Flights',status:'ok'}]};},
  searchIgnav:async q=>{calls.push(['ignav',q]);return {offers:[],sources:[{provider:'Ignav',status:'ok'}]};},
  searchExpedia:async q=>{calls.push(['expedia',q]);return {offers:[],sources:[{provider:'Expedia',status:'ok'}]};},
  searchSkyscanner:async q=>{calls.push(['skyscanner',q]);return {offers:[],sources:[{provider:'Skyscanner',status:'ok'}]};},
  searchAirCanada:async q=>{calls.push(['air-canada',q]);return {offers:[],sources:[{provider:'Air Canada NDC',status:'ok'}]};},
  searchMatrix:async q=>{calls.push(['ita-matrix',q]);return {offers:[],sources:[{provider:'ITA Matrix',status:'ok'}]};},
  searchOmkarExpedia:async q=>{calls.push(['omkar-expedia',q]);return {offers:[],sources:[{provider:'Expedia via Omkar',status:'ok'}]};},
 };
 for(const [source] of calendarProviders){
  const tripType=['ita-matrix','expedia'].includes(source)?'round-trip':'one-way';
  const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType,nights:tripType==='round-trip'?5:null,adults:['ita-matrix','expedia'].includes(source)?2:1,children:0,childrenAges:[],cabin:'economy',filters:{},source,searchLimit:1};
  const result=await searchFareCalendar(query,{providerOptions:sourceFor});
  assert.equal(result.dates[0].status,'no_matching_observation',`${source}: ${JSON.stringify(result.stopped)}`);
 }
  assert.deepEqual(calls.map(([source])=>source).sort(),calendarProviders.map(([source])=>source).sort());
 assert.ok(calls.every(([,query])=>(query.date??query.departureDate)==='2099-04-15'&&query.origin==='YHZ'&&query.destination==='BCN'));
});
test('all-provider calendar calls each flight provider and discloses partial provider coverage',async()=>{
 const calls=[],providerOptions={};
 for(const [source,label] of calendarProviders){
  const provider=source==='expedia'?'Expedia':label;
  const fn=async query=>{calls.push([source,query]);return {offers:source==='ignav'?[offer(query,500)]:[],sources:[{provider,status:source==='skyscanner'?'unconfigured':'ok'}]};};
  providerOptions[{google:'searchGoogle',ignav:'searchIgnav',expedia:'searchExpedia',skyscanner:'searchSkyscanner','air-canada':'searchAirCanada','ita-matrix':'searchMatrix','omkar-expedia':'searchOmkarExpedia'}[source]]=fn;
 }
 const result=await searchFareCalendar({origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,cabin:'economy',adults:1,children:0,childrenAges:[],filters:{},source:'all',searchLimit:7},{providerOptions});
  assert.deepEqual(calls.map(([source])=>source).sort(),calendarProviders.map(([source])=>source).sort());
  assert.equal(result.coverage.fareRequestsStarted,7);assert.equal(result.coverage.fullyScanned,false);assert.equal(result.dates[0].status,'observed');assert.equal(result.dates[0].offer.provider,'Ignav');assert.equal(result.dates[0].price,500);
 assert.deepEqual(result.coverage.sourceCoverage.map(source=>[source.queries,source.successful,source.unavailable]),calendarProviders.map(([source])=>source==='skyscanner'?[1,0,1]:[1,1,0]));
});
test('regional all-provider calendars fit the selected budget and report omitted airports',async()=>{
 const providerOptions={};
 for(const [id,label] of calendarProviders){const provider=id==='expedia'?'Expedia':label,key={google:'searchGoogle',ignav:'searchIgnav',expedia:'searchExpedia',skyscanner:'searchSkyscanner','air-canada':'searchAirCanada','ita-matrix':'searchMatrix','omkar-expedia':'searchOmkarExpedia'}[id];providerOptions[key]=async()=>({offers:[],sources:[{provider,status:'ok'}]});}
 const codes=['YHZ','YUL','YOW','YYC','YVR','YQB','YYG','YYT','YEG','YQM'];
 const result=await searchFareCalendar({origin:'Europe',originType:'region',destination:'LHR',destinationType:'place',destinationAirports:['LHR'],start:'2099-04-15',end:'2099-04-17',tripType:'one-way',nights:null,cabin:'economy',adults:1,children:0,childrenAges:[],filters:{},source:'all',searchLimit:62},{resolveRegion:async()=>({method:'Fixture',airports:codes.map(code=>({code,name:code})),uncheckedAirports:[],moreAvailable:false}),providerOptions});
 assert.deepEqual(result.query.originAirports,['YHZ','YUL']);assert.equal(result.coverage.fareRequestsStarted,42);assert.equal(result.locationCoverage.origin.uncheckedAirports.length,8);assert.equal(result.locationCoverage.origin.moreAvailable,true);assert.equal(result.coverage.fullyScanned,true);
});
test('regional calendar accepts only bounded airport sets and budgets every exact pair/date',()=>{
 const query=validateCalendarQuery({origin:'Atlantic Canada',destination:'Southern California',originAirports:['YHZ','YUL'],destinationAirports:['LAX','SNA'],start:'2099-04-15',end:'2099-04-16',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',searchLimit:8});
 assert.equal(query.origin,'Atlantic Canada');assert.equal(query.destination,'Southern California');
 assert.deepEqual(query.routePairs,[{origin:'YHZ',destination:'LAX'},{origin:'YHZ',destination:'SNA'},{origin:'YUL',destination:'LAX'},{origin:'YUL',destination:'SNA'}]);
 assert.equal(calendarStorageKey(query),calendarStorageKey({...query,start:'2099-04-16',end:'2099-04-16'}));
 assert.notEqual(calendarStorageKey(query),calendarStorageKey({...query,originAirports:['YHZ'],routePairs:[{origin:'YHZ',destination:'LAX'},{origin:'YHZ',destination:'SNA'}]}));
 for(const change of [{searchLimit:7},{originAirports:['YHZ','YHZ']},{originAirports:['YHZ','bad']},{originAirports:Array(21).fill('YHZ')},{airportLimit:21},{airportLimit:1},{destinationAirports:['LAX','LAX']},{originAirports:['YHZ'],destinationAirports:['YHZ']},{originAirports:['YHZ'],destinationAirports:['LAX','SNA'],airportLimit:1}])assert.throws(()=>validateCalendarQuery({origin:'Atlantic Canada',destination:'Southern California',originAirports:['YHZ','YUL'],destinationAirports:['LAX','SNA'],start:'2099-04-15',end:'2099-04-16',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',searchLimit:8,...change}));
});
test('calendar accepts up to twenty airport candidates and trims pairs to the exact request budget with coverage',async()=>{
 const codes=Array.from({length:20},(_,i)=>`A${String.fromCharCode(65+i)}A`);
 const destinationCodes=Array.from({length:20},(_,i)=>`B${String.fromCharCode(65+i)}B`);
 const query=validateCalendarQuery({origin:'Origin region',originType:'region',originAirports:codes,destination:'Destination region',destinationType:'region',destinationAirports:destinationCodes,airportLimit:20,start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',source:'ignav',searchLimit:250},{deferBudget:true});
 assert.equal(query.airportLimit,20);assert.equal(query.routePairs.length,400);
 const searched=[];
 const result=await searchFareCalendar(query,{searcher:async q=>{searched.push(`${q.origin}:${q.destination}`);return response([]);}});
 assert.equal(searched.length,240);assert.equal(result.coverage.fareRequestsStarted,240);assert.equal(result.coverage.requestBudget,250);
 assert.equal(result.coverage.fullyScanned,true);assert.equal(result.coverage.pairQueriesNotScanned,0);
 assert.equal(result.coverage.airportPairsUncheckedByBudget.length,160);assert.ok(result.coverage.airportPairsUncheckedByBudget.every(pair=>pair.reason==='reduced_to_fit_request_budget'));
 assert.ok(result.locationCoverage.origin.uncheckedAirportCount+result.locationCoverage.destination.uncheckedAirportCount>0);
 assert.ok(result.locationCoverage.origin.uncheckedAirports.length+result.locationCoverage.destination.uncheckedAirports.length>0);
});
test('regional calendar checks every exact airport pair per departure date and reports the winning route',async()=>{
 const query={origin:'Atlantic Canada',destination:'Southern California',originAirports:['YHZ','YUL'],destinationAirports:['LAX','SNA'],start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nights:5,adults:2,children:2,childrenAges:[10,15],cabin:'business',filters:{maxStops:1,airlinesInclude:['AC']},searchLimit:8};
 const calls=[];const prices={YHZ:{LAX:700,SNA:650},YUL:{LAX:500,SNA:600}};
 const result=await searchFareCalendar(query,{searcher:async q=>{calls.push(q);const carrier=q.origin==='YUL'&&q.destination==='LAX'?'BA':'AC';return response([offer(q,prices[q.origin][q.destination],{segments:[leg(q.origin,q.destination,q.date,'300',carrier)]})]);}});
 assert.equal(calls.length,8);assert.deepEqual(new Set(calls.map(q=>`${q.origin}-${q.destination}-${q.date}`)).size,8);
 assert.ok(calls.every(q=>q.cabin==='business'&&q.tripType==='round-trip'&&q.returnDate===addDays(q.date,5)&&q.adults===2&&q.children===2));
 assert.deepEqual(calls[0].childrenAges,[10,15]);
 assert.deepEqual(result.query.filters.airlinesInclude,['AC']);
 assert.deepEqual(result.dates.map(day=>[day.price,day.offer.from,day.offer.to]),[[600,'YUL','SNA'],[600,'YUL','SNA']]);
 assert.ok(result.dates.every(day=>day.filterRejected.airline===1));
 assert.equal(result.coverage.pairQueriesPlanned,8);assert.equal(result.coverage.pairQueriesChecked,8);assert.equal(result.coverage.fullyScanned,true);
});
test('calendar resolves an auto-detected region itself before applying the exact pair/date budget',async()=>{
 const calls=[],regions=[];
 const result=await searchFareCalendar({origin:'Europe',originType:'auto',destination:'YYZ',destinationType:'place',destinationAirports:['YYZ'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,cabin:'economy',adults:1,children:0,childrenAges:[],filters:{},source:'ignav',searchLimit:2},{detectDestination:async name=>({type:'region',canonicalName:name}),resolveRegion:async name=>{regions.push(name);return {method:'Fixture region coverage',airports:[{code:'FRA',name:'Frankfurt'},{code:'FCO',name:'Rome'},{code:'BCN',name:'Barcelona'},{code:'MUC',name:'Munich'}],uncheckedAirports:[],moreAvailable:true,geographicExcludedAirportCount:1,geographicExcludedAirports:[{code:'UFA'}],popularityExclusionLimit:3,popularityRankedCandidates:7,popularityExclusionShortfall:0,excludedAirports:[{code:'LHR',passengers:80000000},{code:'CDG',passengers:70000000},{code:'AMS',passengers:60000000}],region:{policyNote:'Airport-level region boundary.'}};},searcher:async query=>{calls.push(query);return response([offer(query)]);}});
 assert.deepEqual(regions,['Europe']);assert.deepEqual(calls.map(query=>query.origin),['FRA','FCO']);assert.equal(result.coverage.pairQueriesPlanned,2);assert.deepEqual(result.locationCoverage.origin.airports.map(airport=>airport.code),['FRA','FCO']);assert.equal(result.locationCoverage.origin.moreAvailable,true);assert.equal(result.locationCoverage.origin.geographicExcludedAirportCount,1);assert.deepEqual(result.locationCoverage.origin.geographicExcludedAirports.map(airport=>airport.code),['UFA']);assert.equal(result.locationCoverage.origin.popularityExclusionLimit,3);assert.equal(result.locationCoverage.origin.popularityRankedCandidates,7);assert.equal(result.locationCoverage.origin.popularityExclusionShortfall,0);assert.deepEqual(result.locationCoverage.origin.popularityExcludedAirports.map(airport=>airport.code),['LHR','CDG','AMS']);
});
test('a source stop midway through regional coverage withholds a partial cheapest-route price',async()=>{
 let calls=0;const query={origin:'Atlantic Canada',destination:'Southern California',originAirports:['YHZ'],destinationAirports:['LAX','SNA','SAN'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',searchLimit:3};
 const result=await searchFareCalendar(query,{searcher:async q=>++calls===1?response([offer(q,50)]):{sources:[{provider:'Ignav',status:'rate_limited',reason:'Too many requests'}],offers:[]}});
 assert.equal(calls,2);assert.equal(result.dates[0].status,'partial_route_coverage');assert.equal(result.dates[0].price,null);assert.equal(result.dates[0].pairQueriesChecked,1);assert.equal(result.coverage.fullyScanned,false);
 assert.deepEqual(result.coverage.airportPairsNotSearched,[{date:'2099-04-15',returnDate:null,origin:'YHZ',destination:'SAN',reason:'stopped_before_query'}]);
});
test('calendar prices exact shifted return dates and lowest matching quotes with cabin, actual ages and filters intact',async()=>{
 const calls=[];const r=await searchFareCalendar(input,{searcher:async q=>{calls.push(q);const ba=offer(q,100,{segments:[leg(q.origin,q.destination,q.date,'300','BA')]});return response([offer(q,700),offer(q,500),offer(q,10,{currency:'USD'}),offer(q,10,{cabin:'economy'}),offer(q,10,{departureDate:addDays(q.date,1)}),ba]);}});
 assert.equal(calls.length,2);assert.deepEqual(calls.map(q=>[q.date,q.returnDate]),[['2099-04-15','2099-04-20'],['2099-04-16','2099-04-21']]);assert.ok(calls.every(q=>q.cabin==='business'&&q.adults===2&&q.children===2));assert.deepEqual(calls[0].childrenAges,[10,15]);
 assert.deepEqual(r.dates.map(d=>d.price),[500,500]);assert.ok(r.dates.every(d=>d.offer.ignavId==='fare_12345678'&&d.rejected.price===1&&d.rejected.cabin===1&&d.filterRejected.airline===1));assert.equal(r.query.filters.sort,'price_high');assert.equal(r.coverage.fullyScanned,true);assert.equal(r.coverage.fareRequestsStarted,2);assert.match(r.limitation,/not an exhaustive/);
});
test('Skyscanner calendar searches one-way CAD itineraries through the shared bounded session',async()=>{
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-16',tripType:'one-way',nights:null,cabin:'economy',adults:1,children:0,childrenAges:[],filters:{maxStops:0,maxPrice:1000,airlinesInclude:['AC']},source:'skyscanner',searchLimit:2};
 const calls=[];
 const searcher=async q=>{
  calls.push(q);
  const departureAt=`${q.date}T08:00:00`,arrivalAt=`${q.date}T16:00:00`;
  const offer={provider:'Skyscanner',source:'Skyscanner Flights Live Prices API',price:q.date.endsWith('15')?500:400,currency:'CAD',observedAt:new Date().toISOString(),travelers:'1 adult',bookingStatus:'Provider handoff; seller price not refreshed',fees:'Provider-reported fare; inclusions unverified',cabin:'economy',from:q.origin,to:q.destination,departureDate:q.date,departureTime:'08:00',arrivalDate:q.date,arrivalTime:'16:00',durationMinutes:480,airlines:['Air Canada'],via:[],segments:[{from:q.origin,to:q.destination,departureAt,arrivalAt,flightNumber:'AC123',carrierCode:'AC',carrier:'Air Canada'}],sourceUrl:'https://www.skyscanner.ca/',skyscannerSessionToken:`session-${q.date}`,skyscannerItineraryId:`itinerary-${q.date}`};
  return {sources:[{provider:'Skyscanner',status:'ok',received:1,accepted:1}],offers:[offer]};
 };
 const result=await searchFareCalendar(query,{searcher});
 assert.deepEqual(calls.map(q=>q.date),['2099-04-15','2099-04-16']);
 assert.ok(calls.every(q=>q.tripType==='one-way'&&q.origin==='YHZ'&&q.destination==='BCN'&&q.cabin==='economy'&&q.adults===1&&q.children===0));
 assert.deepEqual(result.dates.map(cell=>[cell.status,cell.price]),[['observed',500],['observed',400]]);
 assert.equal(result.query.source,'skyscanner');assert.equal(result.coverage.fareRequestsStarted,2);
});
test('Skyscanner calendar reports missing credentials without making a provider call',async()=>{
 const previous=process.env.SKYSCANNER_API_KEY;delete process.env.SKYSCANNER_API_KEY;
 try{
  await assert.rejects(searchFareCalendar({origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,cabin:'economy',adults:1,children:0,childrenAges:[],filters:{},source:'skyscanner',searchLimit:1}),/No selected provider supports/);
 }finally{if(previous===undefined)delete process.env.SKYSCANNER_API_KEY;else process.env.SKYSCANNER_API_KEY=previous;}
});
test('one-way calendar sends no return and no-match dates do not invent prices',async()=>{
 const calls=[];const r=await searchFareCalendar({...input,tripType:'one-way',nights:null},{searcher:async q=>{calls.push(q);return response([]);}});
 assert.ok(calls.every(q=>!('returnDate' in q)));assert.ok(r.dates.every(d=>d.status==='no_matching_observation'&&d.price===null));assert.equal(r.coverage.datesChecked,2);assert.equal(r.coverage.datesWithQuotes,0);
});

test('calendar preserves identified travelers and skips category-changing trips without spending requests',async()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'baby',birthDate:'2097-04-16',guardianId:'parent',infantSeating:'lap'}];
 const query={origin:'YHZ',destination:'BCN',start:'2099-04-14',end:'2099-04-17',tripType:'round-trip',nights:1,cabin:'business',travelers,searchLimit:4};
 const calls=[];let checkpoint;
 const result=await searchFareCalendar(query,{onCheckpoint:value=>{checkpoint=structuredClone(value);},searcher:async q=>{calls.push(q);return response([offer(q)]);}});
 assert.deepEqual(calls.map(q=>q.date),['2099-04-14']);
 assert.ok(calls.every(q=>JSON.stringify(q.travelers)===JSON.stringify(travelers)&&q.adults===undefined));
 assert.equal(result.dates[1].status,'unsupported_party');assert.match(result.dates[1].reason,/changes Ignav fare category/);
 assert.match(result.dates[2].reason,/Remove infant seating/);assert.match(result.dates[3].reason,/Remove infant seating/);
 assert.equal(result.coverage.datesUnsupported,3);assert.equal(result.coverage.datesChecked,1);assert.equal(result.coverage.fareRequestsStarted,1);assert.equal(result.coverage.fullyScanned,false);
 const resumed=await searchFareCalendar(query,{checkpoint,searcher:()=>{throw Error('fresh responses must be reused');}});
 assert.equal(resumed.coverage.responsesReused,1);assert.equal(resumed.dates[1].status,'unsupported_party');
});
test('provider refusal retains earlier observations and explicitly leaves remaining dates unscanned',async()=>{
 let calls=0;const retryAt=Date.now()+60_000;
 const r=await searchFareCalendar({...input,end:'2099-04-17'},{searcher:async q=>{if(++calls===2)throw new SourceRequestError('Source cooling down.',{status:'rate_limited',httpStatus:429,retryAt});return response([offer(q)]);}});
 assert.equal(calls,2);assert.equal(r.status,'source_unavailable');assert.equal(r.dates[0].price,500);assert.ok(r.dates.slice(1).every(d=>d.status==='not_scanned'&&d.price===null));assert.equal(r.coverage.fullyScanned,false);assert.equal(r.stopped.source.retryAt,new Date(retryAt).toISOString());
});
test('resume reuses fresh dates and an interrupted read cannot reset the calendar budget',async()=>{
 const query={...input,end:'2099-04-17',searchLimit:3},controller=new AbortController();let checkpoint,calls=0;
 await assert.rejects(searchFareCalendar(query,{signal:controller.signal,onCheckpoint:v=>{checkpoint=structuredClone(v);},searcher:async q=>{if(++calls===2){controller.abort(Error('Paused'));throw controller.signal.reason;}return response([offer(q)]);}}),/Paused/);
 const r=await searchFareCalendar(query,{checkpoint,searcher:async q=>{calls++;return response([offer(q)]);}});
 assert.equal(calls,3);assert.equal(r.status,'budget_exhausted');assert.equal(r.coverage.responsesReused,1);assert.equal(r.coverage.interruptedRequests,1);assert.equal(r.coverage.fareRequestsStarted,3);assert.deepEqual(r.dates.map(d=>d.status),['observed','observed','not_scanned']);
});
test('an expired early cheapest quote is replaced by its still-current observed alternative',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);let calls=0;
 const r=await searchFareCalendar(input,{searcher:async q=>{if(++calls===2){Date.now.mock.mockImplementation(()=>now+2000);return response([offer(q,500)]);}return response([offer(q,100,{expiresAt:new Date(now+1000).toISOString()}),offer(q,200)]);}});
 assert.equal(r.dates[0].price,200);assert.equal(r.dates[0].offer.price,200);
});
test('inbound actual connections drive country filtering even if a supplied via summary is empty',async()=>{
 const r=await searchFareCalendar({...input,filters:{countriesExclude:['US']}},{filterOptions:{lookup:async codes=>{assert.deepEqual(codes,['JFK']);return new Map([['JFK','US']]);}},searcher:async q=>{
  const good=offer(q,500),bad=offer(q,100,{inbound:{...good.inbound,arrivalTime:'21:00',durationMinutes:780,via:[],segments:[leg('BCN','JFK',q.returnDate,'201'),leg('JFK','YHZ',q.returnDate,'202','AC','20:00:00','21:00:00')]}});return response([bad,good]);
 }});assert.ok(r.dates.every(d=>d.price===500&&d.filterRejected.country===1));
});
test('invalid current itineraries never become calendar cells merely because their envelopes match',async()=>{
 const r=await searchFareCalendar(input,{searcher:async q=>response([offer(q,100,{segments:[leg('MAD','BCN',q.date)]}),offer(q,100.001),offer(q,0.000000001),offer(q,100,{observedAt:new Date(Date.now()-16*60000).toISOString()}),offer(q,100,{ignavId:'bad'}),null])});
  assert.ok(r.dates.every(d=>d.status==='rejected_observations'&&d.price===null&&d.rejected.segments===1&&d.rejected.price_precision===2&&d.rejected.quote_freshness===1&&d.rejected.source_reference===1&&d.rejected.offer===1),JSON.stringify(r.dates.map(d=>({status:d.status,rejected:d.rejected,reason:d.reason,coverage:d.providerCoverage}))));assert.equal(r.coverage.datesRejected,2);
});
test('a full 31-day month prices every exact departure and crosses the return-month boundary',async()=>{
 const seen=[];const r=await searchFareCalendar({...input,start:'2099-07-01',end:'2099-07-31'},{searcher:async q=>{seen.push(q);return response([offer(q)]);}});
 assert.equal(seen.length,31);assert.equal(new Set(seen.map(q=>q.date)).size,31);assert.equal(seen.at(-1).returnDate,'2099-08-05');assert.equal(r.dates.length,31);assert.equal(r.coverage.datesChecked,31);assert.equal(r.coverage.fullyScanned,true);
});

test('independent departure and return ranges search every valid date pair within budget',async()=>{
 const query={...input,start:'2099-04-15',end:'2099-04-16',nights:null,returnStart:'2099-04-16',returnEnd:'2099-04-17',searchLimit:4};
 const calls=[];
 const result=await searchFareCalendar(query,{searcher:async q=>{calls.push(q);return response([offer(q,q.returnDate.endsWith('16')?300:400)]);}});
 assert.deepEqual(calls.map(q=>[q.date,q.returnDate]),[['2099-04-15','2099-04-16'],['2099-04-15','2099-04-17'],['2099-04-16','2099-04-16'],['2099-04-16','2099-04-17']]);
 assert.deepEqual(result.dates.map(row=>[row.date,row.returnDate,row.price]),calls.map(q=>[q.date,q.returnDate,q.date===q.returnDate?null:q.returnDate.endsWith('16')?300:400]));
 assert.equal(result.coverage.pairQueriesPlanned,4);assert.equal(result.coverage.fullyScanned,true);
 assert.ok(calls.every(q=>q.cabin==='business'&&q.childrenAges.join(',')==='10,15'));
 assert.throws(()=>validateCalendarQuery({...query,searchLimit:3}),/requires 4/);
 assert.throws(()=>validateCalendarQuery({...query,returnStart:'2099-03-01',returnEnd:'2099-03-02'}),/return date/);
 assert.throws(()=>validateCalendarQuery({...query,returnEnd:'2099-05-18'}),/return range/);
});

test('regional return ranges preserve all date pairs while trimming airports to the budget',async()=>{
 const calls=[];
 const result=await searchFareCalendar({...input,origin:'Canada',originType:'region',destination:'Europe',destinationType:'region',originAirports:[],destinationAirports:[],returnStart:'2099-04-20',returnEnd:'2099-04-21',nights:null,searchLimit:16},{resolveRegion:async name=>({airports:(name==='Canada'?['YHZ','YUL','YOW']:['LHR','CDG','BCN']).map(code=>({code})),uncheckedAirports:[],method:'Controlled dynamic region resolution'}),searcher:async q=>{calls.push(q);return response([offer(q)]);}});
 assert.equal(calls.length,16);assert.equal(new Set(calls.map(q=>JSON.stringify([q.origin,q.destination,q.date,q.returnDate]))).size,16);
 assert.equal(result.dates.length,4);assert.ok(result.dates.every(row=>row.price===500));assert.equal(result.coverage.fullyScanned,true);
 assert.deepEqual(result.query.originAirports,['YHZ','YUL']);assert.deepEqual(result.query.destinationAirports,['LHR','CDG']);
 assert.equal(result.locationCoverage.origin.uncheckedAirportCount,1);assert.equal(result.locationCoverage.destination.uncheckedAirportCount,1);
 assert.deepEqual(result.locationCoverage.origin.uncheckedAirports.map(a=>a.code),['YOW']);assert.deepEqual(result.locationCoverage.destination.uncheckedAirports.map(a=>a.code),['BCN']);
 assert.ok(calls.every(q=>q.childrenAges.join(',')==='10,15'&&q.cabin==='business'));
});

test('completed regional calendar identifies every known airport omitted by candidate and request budgets while progress stays bounded',async()=>{
 const candidates=Array.from({length:35},(_,index)=>`A${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`),progress=[];
 const result=await searchFareCalendar({origin:'YHZ',originType:'place',originAirports:['YHZ'],destination:'Europe',destinationType:'region',destinationAirports:[],airportLimit:4,start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'ignav',searchLimit:1},{
  resolveRegion:async()=>({airports:candidates.map(code=>({code})),uncheckedAirports:[],moreAvailable:false,method:'Bounded test directory'}),
  searcher:async query=>response([offer(query)]),
  onProgress:update=>{if(update.calendarPreview?.locationCoverage)progress.push(update.calendarPreview.locationCoverage.destination);}
 });
 const omitted=result.locationCoverage.destination.uncheckedAirports.map(airport=>airport.code);
 assert.deepEqual(omitted,candidates.slice(1));
 assert.equal(result.locationCoverage.destination.uncheckedAirportCount,34);
 assert.deepEqual(result.coverage.airportPairsUncheckedByBudget.map(pair=>pair.destination),candidates.slice(1,4),'the request-budget report also identifies every removed candidate pair');
 assert.ok(progress.length>0);
 assert.ok(progress.every(coverage=>coverage.uncheckedAirports.length<=20));
 assert.equal(progress.at(-1).uncheckedAirportsSampled,true);
 assert.equal(progress.at(-1).uncheckedAirportCount,34);
});

test('region searches price every stay length in a bounded night range',async()=>{
 const calls=[];const result=await searchFareCalendar({...input,origin:'Canada',originType:'region',destination:'Europe',destinationType:'region',originAirports:[],destinationAirports:[],nights:null,nightsMin:5,nightsMax:7,searchLimit:6},{resolveRegion:async name=>({airports:[{code:name==='Canada'?'YHZ':'LHR'}],method:'Controlled scope'}),searcher:async q=>{calls.push(q);return response([offer(q)]);}});
 assert.equal(calls.length,6);assert.deepEqual(calls.map(q=>(Date.parse(q.returnDate)-Date.parse(q.date))/86400000),[5,6,7,5,6,7]);assert.equal(result.coverage.fullyScanned,true);
 assert.equal(result.query.nightsMin,5);assert.equal(result.query.nightsMax,7);
 for(const change of [{nightsMin:8,nightsMax:7},{nightsMin:-1,nightsMax:7},{nightsMin:5,nightsMax:366}])assert.throws(()=>validateCalendarQuery({...input,...change}),/minimum and maximum/);
});

test('calendar accepts and executes a 250-search budget but refuses 251',async()=>{
 const query={...input,origin:'Canada',originType:'region',destination:'BCN',originAirports:['YHZ','YUL','YOW','YYZ','YVR'],start:'2099-04-15',end:'2099-04-24',nights:null,nightsMin:5,nightsMax:9,searchLimit:250};
 let calls=0;const result=await searchFareCalendar(query,{searcher:async q=>{calls++;return response([offer(q)]);}});
 assert.equal(calls,250);assert.equal(result.coverage.fareRequestsStarted,250);assert.equal(result.coverage.fullyScanned,true);
 assert.equal(validateCalendarQuery({...input}).searchLimit,250);
 assert.throws(()=>validateCalendarQuery({...input,searchLimit:251}),/1 to 250/);
});

test('exhausted Ignav upstream failures do not stop later regional date pairs',async()=>{
 let calls=0;const result=await searchFareCalendar({...input,originAirports:['YHZ','YUL'],searchLimit:4},{searcher:async q=>{
  calls++;if(calls===1)return {offers:[],sources:[{provider:'Ignav',status:'temporarily_unavailable',httpStatus:424,providerCode:'unable_to_complete_request',reason:'Upstream exhausted'}]};
  return response([offer(q)]);
 }});
 assert.equal(calls,4);assert.equal(result.dates[0].status,'partial_route_coverage');assert.equal(result.dates[0].price,null);assert.equal(result.dates[1].price,500);
 assert.equal(result.coverage.fullyScanned,false);assert.equal(result.coverage.routeFailures.length,1);assert.equal(result.status,'partial_source_failure');
});

test('all-compatible family calendars dispatch and budget only eligible sources',async()=>{
 let calls=0;const forbidden=()=>{throw Error('Excluded provider must not be called');};
 const result=await searchFareCalendar({...input,source:'all',searchLimit:2},{providerOptions:{searchIgnav:async q=>{calls++;return response([offer(q)]);},searchGoogle:forbidden,searchExpedia:forbidden,searchSkyscanner:forbidden,searchAirCanada:forbidden,searchMatrix:forbidden,searchOmkarExpedia:forbidden}});
 assert.equal(calls,2);assert.equal(result.coverage.fareRequestsStarted,2);assert.equal(result.coverage.fullyScanned,true);
 assert.ok(result.coverage.sourceCoverage.filter(row=>row.provider!=='Ignav').every(row=>row.excluded&&row.planned===0&&row.queries===0));
});

test('all-provider calendars stop a refused source while continuing healthy sources',async()=>{
 let ignavCalls=0,matrixCalls=0;
 const result=await searchFareCalendar({...input,source:'all',children:0,childrenAges:[],adults:2,searchLimit:4},{providerOptions:{searchIgnav:async()=>{ignavCalls++;return {offers:[],sources:[{provider:'Ignav',status:'rate_limited',reason:'Retry later',retryAt:'2099-01-01T00:00:00Z'}]};},searchMatrix:async()=>{matrixCalls++;return {offers:[],sources:[{provider:'ITA Matrix',status:'ok'}]};}}});
 assert.equal(ignavCalls,1);assert.equal(matrixCalls,2);assert.equal(result.coverage.fullyScanned,false);
 assert.equal(result.dates[1].providerCoverage.find(row=>row.provider==='Ignav').suppressed,true);
});

test('all-provider regional calendars suppress a source after a provider-wide 5xx and continue healthy sources',async()=>{
 let expediaCalls=0,ignavCalls=0,matrixCalls=0;
 const result=await searchFareCalendar({...input,source:'all',adults:2,children:0,childrenAges:[],tripType:'one-way',start:input.start,end:input.start,nights:null,cabin:'economy',filters:{},destinationAirports:['BCN','LHR'],searchLimit:6},{providerOptions:{
  searchIgnav:async q=>{ignavCalls++;return response([offer(q,500,{ignavId:`fare_${q.destination}1234`,itineraryKey:`exact-${q.destination}-itinerary`})]);},
  searchExpedia:async()=>{expediaCalls++;throw new SourceRequestError('Expedia request failed (HTTP 503).',{status:'temporarily_unavailable',httpStatus:503,retryAt:Date.now()+30_000});},
  searchMatrix:async()=>{matrixCalls++;return {offers:[],priceObservations:[],sources:[{provider:'ITA Matrix',status:'ok',received:0,accepted:0}]};},
 }});
 assert.equal(expediaCalls,1,'the failed Expedia source is not queried again for the next route');
 assert.equal(ignavCalls,2);assert.equal(matrixCalls,2,'healthy sources continue through all exact routes');
 assert.equal(result.dates[0].offers.length,2,'both healthy Ignav offers are retained');
 const expedia=result.dates[0].providerCoverage.filter(row=>row.provider==='Expedia');
 assert.equal(expedia.length,2);assert.equal(expedia[0].httpStatus,503);assert.equal(expedia[1].suppressed,true);
 assert.equal(result.coverage.fullyScanned,false,'suppressed Expedia coverage remains explicitly incomplete');
});

test('recovered calendar retains a provider refusal from its acknowledged checkpoint',async()=>{
 let ignav=0,matrix=0,saved;
 const query={...input,source:'all',children:0,childrenAges:[],adults:2,searchLimit:4};
 const providerOptions={searchIgnav:async()=>{ignav++;return {offers:[],sources:[{provider:'Ignav',status:'auth',httpStatus:401,reason:'Access refused'}]};},searchMatrix:async()=>{matrix++;return {offers:[],sources:[{provider:'ITA Matrix',status:'ok'}]};}};
 await assert.rejects(searchFareCalendar(query,{providerOptions,onCheckpoint:async state=>{saved=structuredClone(state);if(state.responses.length)throw Error('checkpoint interruption');}}),/checkpoint interruption/);
 const result=await searchFareCalendar(query,{providerOptions,checkpoint:saved});
 assert.equal(ignav,1);assert.equal(matrix,2);assert.equal(result.coverage.providerDispatchesSuppressed,1);assert.equal(result.coverage.responsesReused,2);
});

test('native Skyscanner adapter prices regional adult round-trip night ranges with UTC evidence',async()=>{
 const {searchSkyscanner}=await import('../lib/skyscanner.mjs');let calls=0;
 const result=await searchFareCalendar({origin:'Canada',originType:'region',destination:'Europe',destinationType:'region',source:'skyscanner',start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nightsMin:5,nightsMax:6,adults:2,children:0,cabin:'economy',searchLimit:4,filters:{maxStops:0,airlinesInclude:['AC'],maxLayover:180}}, {
 resolveRegion:async name=>({airports:[{code:name==='Canada'?'YHZ':'BCN'}],method:'Test region'}),
 providerOptions:{searchSkyscanner:async(q,options)=>{
  assert.equal(options.requireTimeEvidence,true);calls++;
  const time=(day,hour)=>({year:Number(day.slice(0,4)),month:Number(day.slice(5,7)),day:Number(day.slice(8,10)),hour,minute:0});
  return searchSkyscanner(q,{...options,apiKey:'offline',loadTimezones:async()=>({byCode:new Map([['YHZ',{timeZone:'America/Halifax'}],['BCN',{timeZone:'Europe/Madrid'}]]),sourceUrl:'https://example.com/test-zones',retrievedAt:new Date().toISOString()}),fetcher:async()=>Response.json({sessionToken:'test-session',status:'RESULT_STATUS_COMPLETE',content:{results:{
   itineraries:{one:{legIds:['out','back'],pricingOptions:[{price:{amount:'900',unit:'PRICE_UNIT_WHOLE'},items:[{deepLink:'https://www.skyscanner.net/'}]}]}},
   legs:{out:{segmentIds:['s1'],durationInMinutes:480},back:{segmentIds:['s2'],durationInMinutes:480}},
   segments:{s1:{originPlaceId:'a',destinationPlaceId:'b',departureDateTime:time(q.date,8),arrivalDateTime:time(q.date,21),marketingCarrierId:'AC',marketingFlightNumber:'100'},s2:{originPlaceId:'b',destinationPlaceId:'a',departureDateTime:time(q.returnDate,12),arrivalDateTime:time(q.returnDate,15),marketingCarrierId:'AC',marketingFlightNumber:'101'}},places:{a:{iata:'YHZ'},b:{iata:'BCN'}},carriers:{AC:{iata:'AC',name:'Air Canada'}}
  }}})});
 }} });
 assert.equal(result.transportCoverage.providers.Skyscanner.attempts,4);
 assert.equal(calls,4);assert.equal(result.coverage.fullyScanned,true);assert.ok(result.dates.every(cell=>cell.price===900&&cell.offer.inbound.departureDate===cell.returnDate&&cell.offer.timeEvidence.status==='directory_validated'));
});

test('identified regional Skyscanner calendars skip birthday-crossing pairs and keep later dates',async()=>{
 const travelers=[{id:'adult',birthDate:'2060-01-01'},{id:'child',birthDate:'2089-04-16',guardianId:'adult'}],calls=[];
 const result=await searchFareCalendar({origin:'Canada',originType:'region',destination:'Europe',destinationType:'region',source:'skyscanner',start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nightsMin:1,nightsMax:2,travelers,searchLimit:4},{resolveRegion:async name=>({airports:[{code:name==='Canada'?'YHZ':'BCN'}],method:'test'}),searcher:async q=>{calls.push(q);return {offers:[],sources:[{provider:'Skyscanner',status:'ok'}]};}});
 assert.equal(calls.length,2);assert.ok(calls.every(q=>q.date==='2099-04-16'&&q.travelers[1].birthDate==='2089-04-16'));
 assert.deepEqual(result.dates.map(row=>row.status),['unsupported_party','unsupported_party','no_matching_observation','no_matching_observation']);assert.equal(result.coverage.fullyScanned,false);
});

test('a Matrix airport/date timeout leaves partial coverage and continues later regional searches',async()=>{
 let calls=0;
 const result=await searchFareCalendar({...input,source:'ita-matrix',cabin:'economy',originAirports:['YHZ','YUL'],searchLimit:4},{searcher:async q=>{
  calls++;if(calls===1)return {offers:[],sources:[{provider:'ITA Matrix',status:'temporarily_unavailable',providerCode:'native_query_timeout',reason:'Exact pair timed out'}]};
  return {offers:[offer(q,500,{provider:'ITA Matrix',source:'Matrix browser observation'})],sources:[{provider:'ITA Matrix',status:'ok'}]};
 }});
 assert.equal(calls,4);assert.equal(result.coverage.fareRequestsStarted,4);assert.equal(result.coverage.routeFailures.length,1);assert.equal(result.coverage.pairQueriesChecked,3);
 assert.equal(result.coverage.fullyScanned,false);assert.equal(result.dates[0].price,null);assert.equal(result.dates[1].price,500);assert.equal(result.status,'partial_source_failure');
});
