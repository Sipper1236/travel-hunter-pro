import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSeparateTickets} from '../lib/separate-tickets.mjs';
const leg=(a,b,flight,depart,arrive)=>({marketing_carrier_code:'AC',flight_number:flight,departure_airport:a,arrival_airport:b,departure_time_utc:depart,arrival_time_utc:arrive,departure_time_local:depart.slice(0,19),arrival_time_local:arrive.slice(0,19)});
const a=leg('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z'),b=leg('YUL','BCN','200','2099-04-15T13:00:00Z','2099-04-15T21:00:00Z');
const query={origin:'YHZ',destination:'BCN',date:'2099-04-15',itineraryKey:'target',adults:1,children:0,childrenAges:[],cabin:'economy'};
const offer=(segments,price,id,key)=>({segments,price,ignavId:id,itineraryKey:key,currency:'CAD',cabin:'economy',observedAt:new Date().toISOString()});
test('a segment source refusal preserves its unavailable status and search budget instead of throwing',async()=>{
 let calls=0;const result=await compareSeparateTickets(query,{searcher:async()=>++calls===1?{offers:[offer([a,b],600,'through','target')]}:{offers:[],sources:[{status:'rate_limited'}]}});
 assert.equal(result.status,'source_unavailable');assert.equal(result.coverage.searchLimit,100);assert.deepEqual(result.plans,[]);assert.equal(calls,2);assert.equal(result.ticketBlockCoverage[0].status,'unpriced');assert.equal(result.ticketBlockCoverage[0].responses[0].sources[0].status,'rate_limited');assert.equal(result.ticketBlockCoverage[1].status,'not_searched');assert.equal(result.ticketBlockCoverage[1].fareRequests,0);
});
test('source stop after partial traveler-group quotes marks the ticket block partial',async()=>{
 let calls=0;const result=await compareSeparateTickets({...query,adults:2,splitPassengers:true},{searcher:async q=>{calls++;if(calls===1)return {offers:[offer([a,b],600,'through','target')]};if(calls===2)return {offers:[offer([a],100,'one','single')],sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}]};return {offers:[],sources:[{provider:'Ignav',status:'rate_limited',received:0,accepted:0}]};}});
 assert.equal(result.status,'source_unavailable');assert.equal(result.ticketBlockCoverage[0].status,'partial');assert.equal(result.ticketBlockCoverage[0].qualifyingQuotes,1);assert.deepEqual(result.ticketBlockCoverage[0].responses.map(response=>response.sources[0].status),['ok','rate_limited']);assert.equal(result.ticketBlockCoverage[1].status,'not_searched');
});
test('rechecks baseline and exact flights before comparing independent fares',async()=>{const calls=[];const result=await compareSeparateTickets(query,{searcher:async q=>{calls.push(q);return {offers:q.origin==='YHZ'&&q.destination==='BCN'?[offer([a,b],600,'through','target')]:q.origin==='YHZ'?[offer([a],100,'one','a')]:[offer([b],250,'two','b')]};}});assert.equal(calls.length,3);assert.equal(result.plans[0].price,350);assert.equal(result.plans[0].differenceBeforeExtras,250);assert.equal(result.plans[0].tickets[0].cabin,'economy');assert.deepEqual(result.plans[0].tickets.map(ticket=>ticket.segments.map(segment=>segment.flight_number)),[['100'],['200']]);assert.match(result.limitation,/excludes/);});
test('timezone-less UTC fields cannot authorize a separate-ticket baseline or chronology',async()=>{
 let calls=0;const timezoneLess=leg('YHZ','YUL','100','2099-04-15T08:00:00','2099-04-15T09:00:00');
 const result=await compareSeparateTickets(query,{searcher:async()=>{calls++;return {offers:[offer([timezoneLess,b],600,'through','target')]};}});
 assert.equal(result.status,'baseline_unavailable');assert.equal(calls,1);assert.deepEqual(result.plans,[]);
});
test('unknown RFC 3339 local offsets cannot authorize a separate-ticket baseline',async()=>{
 let calls=0;const unknownOffset=leg('YHZ','YUL','100','2099-04-15T08:00:00-00:00','2099-04-15T09:00:00Z');
 const result=await compareSeparateTickets(query,{searcher:async()=>{calls++;return {offers:[offer([unknownOffset,b],600,'through','target')]};}});
 assert.equal(result.status,'baseline_unavailable');assert.equal(calls,1);assert.deepEqual(result.plans,[]);
});
test('a separate-ticket baseline requires marketing carrier and flight number on every segment',async()=>{
 for(const missing of ['marketing_carrier_code','flight_number']){
  let calls=0;const unidentified={...a};delete unidentified[missing];
  const result=await compareSeparateTickets(query,{searcher:async()=>{calls++;return {offers:[offer([unidentified,b],600,'through','target')]};}});
  assert.equal(result.status,'baseline_unavailable',missing);assert.equal(calls,1,missing);assert.deepEqual(result.plans,[],missing);
 }
});
test('discovers bounded fresh same-query route alternatives from the baseline refresh without extra searches',async()=>{
 const c=leg('YHZ','YYZ','300','2099-04-15T08:30:00Z','2099-04-15T10:00:00Z'),d=leg('YYZ','BCN','400','2099-04-15T13:00:00Z','2099-04-15T21:00:00Z'),calls=[];
 const selected=offer([a,b],600,'through','target'),alternative={...offer([c,d],550,'alternate','alternate-key'),cabin:'economy',via:['YYZ']};
 const wrongRoute={...offer([a],200,'wrong-route','wrong-route-key'),cabin:'economy'},stale={...offer([c,d],300,'expired','expired-key'),cabin:'economy',observedAt:new Date(Date.now()-16*60_000).toISOString()},wrongCurrency={...offer([c,d],100,'foreign','foreign-key'),cabin:'economy',currency:'USD'};
 const result=await compareSeparateTickets(query,{searcher:async q=>{calls.push(q);if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[selected,alternative,wrongRoute,stale,wrongCurrency]};return {offers:q.origin==='YHZ'?[offer([a],100,'one','a')]:[offer([b],250,'two','b')]};}});
 assert.equal(calls.length,3);assert.equal(result.coverage.routeAlternativesDiscovered,1);assert.equal(result.routeAlternatives.length,1);assert.equal(result.routeAlternatives[0].itineraryKey,'alternate-key');assert.equal(result.routeAlternatives[0].price,550);assert.equal(result.routeAlternatives[0].outbound.via[0],'YYZ');
});
test('round-trip route discovery excludes alternatives with a different return date',async()=>{
 const backA=leg('BCN','YYZ','500','2099-04-22T08:00:00Z','2099-04-22T10:00:00Z'),backB=leg('YYZ','YHZ','600','2099-04-22T14:00:00Z','2099-04-22T17:00:00Z');
 const wrongBackA=leg('BCN','YYZ','700','2099-04-23T08:00:00Z','2099-04-23T10:00:00Z'),wrongBackB=leg('YYZ','YHZ','800','2099-04-23T14:00:00Z','2099-04-23T17:00:00Z');
 const baseline={...offer([a,b],600,'through','target'),inbound:{segments:[backA,backB]}},wrongDate={...offer([a,b],500,'wrong-date','wrong-return-date'),inbound:{segments:[wrongBackA,wrongBackB]}};
 const roundTrip={...query,tripType:'round-trip',returnDate:'2099-04-22'};
 const result=await compareSeparateTickets(roundTrip,{searcher:async q=>{
  if(q.tripType==='round-trip')return {offers:[baseline,wrongDate]};
  const segment=[a,b,backA,backB].find(item=>item.departure_airport===q.origin&&item.arrival_airport===q.destination&&item.departure_time_local.slice(0,10)===q.date);
  return {offers:segment?[offer([segment],100,`ticket-${segment.flight_number}`,`ticket-${segment.flight_number}`)]:[]};
 }});
 assert.equal(result.status,'observed');assert.deepEqual(result.routeAlternatives,[]);assert.equal(result.routeAlternativeCoverage.matchingAlternatives,0);
});
test('reports omitted matching routes at the display cap and incomplete exact-pair provider coverage',async()=>{
 const alternatives=Array.from({length:10},(_,i)=>{
  const first={...a,flight_number:`A${i+1}`},second={...b,flight_number:`B${i+1}`};
  return {...offer([first,second],500+i,`alternative-${i+1}`,`alternative-key-${i+1}`),cabin:'economy'};
 });
 const result=await compareSeparateTickets(query,{searcher:async q=>q.origin==='YHZ'&&q.destination==='BCN'?{complete:false,offers:[offer([a,b],600,'through','target'),...alternatives]}:{offers:[offer([q.origin==='YHZ'?a:b],100,'ticket','block')]}});
 assert.equal(result.routeAlternatives.length,8);
 assert.equal(result.coverage.routeAlternativesDiscovered,10,'coverage counts all matching alternatives, not only the eight displayed routes');
 assert.deepEqual(result.routeAlternativeCoverage,{scope:'same_exact_airport_pair_refresh',candidateItinerariesReturned:11,matchingAlternatives:10,alternativesShown:8,displayLimit:8,omittedMatchingAlternatives:2,providerCompletionKnown:true,providerReportedComplete:false,alternateAirportPairsPlanned:0,alternateAirportPairsAttempted:0,alternateAirportPairsAttemptedList:[],alternateAirportPairsSearched:0,alternateAirportPairsSearchedList:[],alternateAirportPairsStoppedList:[],alternateAirportPairsNotSearched:[],airportPairSearchLimit:8,exhaustive:false});
});
test('same marketing flight number is rejected when the operating carrier differs',async()=>{
 const baseline=[{...a,operating_carrier_name:'Air Canada'},{...b,operating_carrier_name:'Example Air'}];
 const result=await compareSeparateTickets(query,{searcher:async q=>q.origin==='YHZ'&&q.destination==='BCN'?
  {offers:[offer(baseline,600,'through','target')]}:
  q.origin==='YHZ'?{offers:[offer([{...a,operating_carrier_name:'Different Operator'}],100,'wrong-operator','one')]}:
  {offers:[offer([{...b,operating_carrier_name:'Example Air'}],250,'two','two')]}});
 assert.equal(result.status,'segment_unavailable');
 assert.deepEqual(result.plans,[]);
});
test('rejects exact-flight ticket blocks returned in a different cabin',async()=>{
 const result=await compareSeparateTickets(query,{searcher:async q=>{
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer([a,b],600,'through','target')]};
  const segment=offer([q.origin==='YHZ'?a:b],100,'wrong-cabin','ticket');
  return {offers:[{...segment,cabin:'business'}]};
 }});
 assert.equal(result.status,'segment_unavailable');
 assert.deepEqual(result.plans,[]);
});
test('rejects short connections and mismatched flights without fabricating savings',async()=>{let calls=0;const short={...b,departure_time_utc:'2099-04-15T10:00:00Z'};const r=await compareSeparateTickets(query,{searcher:async()=>{calls++;return {offers:[offer([a,short],600,'through','target')]};}});assert.equal(r.status,'connection_ineligible');assert.equal(calls,1);assert.deepEqual(r.plans,[]);});
test('rejects child partitions before spending on searches',async()=>{let calls=0;await assert.rejects(compareSeparateTickets({...query,children:1,childrenAges:[10]},{searcher:async()=>{calls++;}}),/children/);assert.equal(calls,0);});
test('identified child remains with actual guardian in every independently priced segment partition',async()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'other',birthDate:'2071-01-01'},{id:'child',birthDate:'2090-01-01',guardianId:'parent'}],seen=[];
 const result=await compareSeparateTickets({origin:query.origin,destination:query.destination,date:query.date,itineraryKey:query.itineraryKey,cabin:query.cabin,tripType:'one-way',travelers,splitPassengers:true},{searcher:async q=>{
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[{...offer([a,b],500,'baseline','target')}]};
  const ids=q.travelers.map(person=>person.id);seen.push(ids);
  const chain=q.origin==='YHZ'?[a]:[b],price=ids.includes('child')?(ids.length===3?200:120):ids.length===2?100:ids[0]==='other'?30:80;
  return {offers:[offer(chain,price,`fare_${ids.join('_')}`,'segment')]};
 }});
 assert.equal(result.status,'observed');assert.equal(result.plans[0].price,300);
 assert.ok(seen.every(ids=>!ids.includes('child')||ids.includes('parent')));
 assert.ok(result.plans[0].tickets.every(ticket=>ticket.travelerIds));
 assert.deepEqual(result.plans[0].tickets.filter(ticket=>ticket.travelerIds.includes('child')).map(ticket=>ticket.travelerIds),[['parent','child'],['parent','child']]);
 assert.match(result.limitation,/eligibility.*unverified/i);
});
test('contiguous ticket blocks may use different guardian-safe traveler partitions on each segment',async()=>{
 const travelers=[
  {id:'parent',birthDate:'2070-01-01'},
  {id:'adult2',birthDate:'2071-01-01'},
  {id:'adult3',birthDate:'2072-01-01'},
  {id:'child',birthDate:'2090-01-01',guardianId:'parent'},
 ];
 const desired=[
  {from:'YHZ',to:'YUL',groups:[['parent','child'],['adult2','adult3']]},
  {from:'YUL',to:'BCN',groups:[['parent','child','adult2'],['adult3']]},
 ];
 const result=await compareSeparateTickets({origin:'YHZ',destination:'BCN',date:query.date,itineraryKey:'target',cabin:'economy',travelers,splitPassengers:true,contiguousGroups:true},{searcher:async q=>{
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer([a,b],1500,'baseline','target')]};
  const route=desired.find(item=>item.from===q.origin&&item.to===q.destination);
  if(!route)return {offers:[]};
  const ids=q.travelers.map(person=>person.id).sort();
  const groupIndex=route.groups.findIndex(group=>[...group].sort().join(',')===ids.join(','));
  if(groupIndex<0)return {offers:[]};
  const flight=route.from==='YHZ'?a:b,price=route.from==='YHZ'?(groupIndex===0?100:20):(groupIndex===0?30:10);
  return {offers:[offer([flight],price,`fare_${route.from}_${ids.join('_')}`,`ticket_${route.from}_${ids.join('_')}`)]};
 }});
 assert.equal(result.status,'observed');
 const splitPlan=result.plans.find(plan=>plan.tickets.length===4&&plan.price===160);
 assert.ok(splitPlan,'expected lowest plan to use two contiguous blocks with different party partitions');
 assert.deepEqual(splitPlan.tickets.map(ticket=>[ticket.segment,ticket.travelerIds]),[
  [1,['parent','child']],[1,['adult2','adult3']],[2,['parent','adult2','child']],[2,['adult3']],
 ]);
 assert.ok(splitPlan.tickets.filter(ticket=>ticket.travelerIds.includes('child')).every(ticket=>ticket.travelerIds.includes('parent')));
});
test('identified ticket blocks crossing a fare-age birthday are not priced using only the first segment date',async()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'child',birthDate:'2087-04-16',guardianId:'parent'}],calls=[];
 const childDayOne=leg('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z');
 const childDayOneConnection=leg('YUL','YYZ','150','2099-04-15T13:00:00Z','2099-04-15T14:00:00Z');
 const childDayTwo=leg('YYZ','BCN','200','2099-04-16T13:00:00Z','2099-04-16T21:00:00Z');
 const itinerary=[childDayOne,childDayOneConnection,childDayTwo];
 const result=await compareSeparateTickets({origin:'YHZ',destination:'BCN',date:query.date,itineraryKey:'target',tripType:'one-way',cabin:'economy',travelers,contiguousGroups:true},{searcher:async q=>{
  calls.push(q);
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer(itinerary,600,'baseline','target')]};
  const start=itinerary.findIndex(segment=>segment.departure_airport===q.origin),end=itinerary.findIndex(segment=>segment.arrival_airport===q.destination),chain=itinerary.slice(start,end+1);
  const price=q.date==='2099-04-16'?180:120;
  return {offers:[offer(chain,price,`ticket-${q.date}`,`block-${q.date}`)]};
 }});
 assert.equal(result.status,'observed');
 assert.equal(calls.filter(q=>q.origin==='YUL'&&q.destination==='BCN').length,0,'a ticket block crossing the birthday must not be quoted for only the first age');
 assert.deepEqual(result.plans[0].tickets.map(ticket=>ticket.travelerIds),[['parent','child'],['parent','child']]);
 assert.deepEqual(result.plans[0].tickets.map(ticket=>ticket.price),[120,180]);
 assert.equal(result.coverage.ageCategoryTransitionGroupsSkipped,1,JSON.stringify(result));
});
test('a lap infant who turns two during a ticket block is not quoted as a lap infant',async()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'infant',birthDate:'2097-04-16',guardianId:'parent',infantSeating:'lap'}],calls=[];
 const overnight=leg('YHZ','YUL','100','2099-04-15T23:00:00Z','2099-04-16T02:00:00Z'),last=leg('YUL','BCN','200','2099-04-16T05:00:00Z','2099-04-16T10:00:00Z');
 const result=await compareSeparateTickets({origin:'YHZ',destination:'BCN',date:'2099-04-15',itineraryKey:'infant-baseline',tripType:'one-way',cabin:'economy',travelers},{searcher:async q=>{
  calls.push(q);
  if(q.tripType==='one-way'&&q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer([overnight,last],300,'baseline','infant-baseline')]};
  return {offers:[offer([overnight],80,'unsafe-lap-quote','unsafe-lap-quote')]};
 }});
 assert.equal(result.status,'segment_unavailable');
 assert.deepEqual(result.plans,[]);
 assert.equal(result.coverage.ageCategoryTransitionGroupsSkipped,1,JSON.stringify(result));
 assert.equal(calls.length,1,'the infant ticket quote must be skipped before supplier dispatch');
 assert.match(result.limitation,/cross.*fare category/i);
});
test('age-boundary exclusions remain in coverage when route discovery is refused',async()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'child',birthDate:'2087-04-16',guardianId:'parent'}];
 const first=leg('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z');
 const connection=leg('YUL','YYZ','150','2099-04-15T13:00:00Z','2099-04-15T14:00:00Z');
 const last=leg('YYZ','BCN','200','2099-04-16T13:00:00Z','2099-04-16T21:00:00Z');let calls=0;
 const result=await compareSeparateTickets({origin:'YHZ',destination:'BCN',date:query.date,itineraryKey:'target',tripType:'one-way',cabin:'economy',travelers,contiguousGroups:true,routeSearchLimit:1,routePairs:[{origin:'YHZ',destination:'YYZ'}]},{searcher:async q=>{
  calls++;
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer([first,connection,last],600,'baseline','target')]};
  return {offers:[],sources:[{provider:'Ignav',status:'rate_limited'}]};
 }});
 assert.equal(result.status,'source_unavailable');assert.equal(calls,2);
 assert.equal(result.coverage.ageCategoryTransitionGroupsSkipped,1,JSON.stringify(result));
});
test('baseline expiry preserves request and age-boundary coverage',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'child',birthDate:'2087-04-16',guardianId:'parent'}];
 const first=leg('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z');
 const connection=leg('YUL','YYZ','150','2099-04-15T13:00:00Z','2099-04-15T14:00:00Z');
 const last=leg('YYZ','BCN','200','2099-04-16T13:00:00Z','2099-04-16T21:00:00Z');let calls=0;
 const result=await compareSeparateTickets({origin:'YHZ',destination:'BCN',date:query.date,itineraryKey:'target',tripType:'one-way',cabin:'economy',travelers,contiguousGroups:true},{searcher:async q=>{
  calls++;
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer([first,connection,last],600,'baseline','target')]};
  if(calls===2)Date.now.mock.mockImplementation(()=>now+16*60_000);
  return {offers:[]};
 }});
 assert.equal(result.status,'baseline_expired');assert.deepEqual(result.plans,[]);assert.ok(calls>1);
 assert.equal(result.coverage.searches,calls);assert.equal(result.coverage.searchLimit,100);
 assert.equal(result.coverage.ageCategoryTransitionGroupsSkipped,1,JSON.stringify(result));
});
test('identified round trip preserves traveler assignments in both directions',async()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'child',birthDate:'2090-01-01',guardianId:'parent'}],calls=[];
 const result=await compareSeparateTickets({origin:'YHZ',destination:'BCN',date:query.date,returnDate:'2099-04-25',tripType:'round-trip',cabin:'economy',itineraryKey:'target',travelers},{searcher:async q=>{
  calls.push(q);if(q.tripType==='round-trip')return {offers:[{...offer([a,b],500,'baseline','target'),inbound:{segments:[backA,backB]}}]};
  const chain=[["YHZ","BCN",[a,b]],["YHZ","YUL",[a]],["YUL","BCN",[b]],["BCN","YHZ",[backA,backB]],["BCN","YUL",[backA]],["YUL","YHZ",[backB]]].find(([from,to])=>from===q.origin&&to===q.destination)?.[2] ?? [];
  return {offers:[offer(chain,100,'segment','leg')]};
 }});
 assert.equal(calls.length,7);assert.equal(result.status,'observed');assert.equal(result.plans.length,4);
 assert.ok(result.plans.every(plan=>plan.tickets.every(ticket=>ticket.travelerIds?.join(',')==='parent,child')));
 assert.ok(result.plans.some(plan=>plan.tickets.some(ticket=>ticket.direction==='inbound')));
 assert.ok(calls.slice(1).every(q=>q.tripType==='one-way'&&!q.returnDate&&q.travelers.length===2));
});
test('independently compares adult booking partitions on each segment',async()=>{
 const calls=[];const r=await compareSeparateTickets({...query,adults:2,splitPassengers:true},{searcher:async q=>{calls.push([q.origin,q.destination,q.adults]);if(q.destination==='BCN'&&q.origin==='YHZ')return {offers:[offer([a,b],1000,'through','target')]};const isFirst=q.origin==='YHZ';return {offers:[offer([isFirst?a:b],isFirst?(q.adults===1?100:300):(q.adults===1?300:400),`id${q.adults}${q.origin}`,'segment')]};}});
 assert.equal(calls.length,5);assert.equal(r.plans[0].price,600);assert.deepEqual(r.plans[0].tickets.map(t=>[t.segment,t.adults]),[[1,1],[1,1],[2,2]]);assert.match(r.limitation,/overlapping inventory/);
});
test('prices three exact segments and checks every connection before searching tickets',async()=>{
 const c=leg('BCN','MAD','300','2099-04-16T01:00:00Z','2099-04-16T02:00:00Z');
 let calls=0;const run=chain=>compareSeparateTickets({...query,destination:'MAD'},{searcher:async q=>{calls++;if(q.origin==='YHZ'&&q.destination==='MAD')return {offers:[offer(chain,900,'through','target')]};return {offers:[offer([chain.find(s=>s.departure_airport===q.origin)],100,'ticket','leg')]};}});
 const r=await run([a,b,c]);assert.equal(calls,4);assert.equal(r.plans[0].price,300);assert.deepEqual(r.plans[0].connectionsMinutes,[240,240]);assert.equal(r.plans[0].tickets.length,3);
 calls=0;const bad=await run([a,b,{...c,departure_time_utc:'2099-04-15T22:00:00Z'}]);assert.equal(calls,1);assert.equal(bad.status,'connection_ineligible');
});
test('compares contiguous groupings and retains a short connection inside a through ticket',async()=>{
 const short={...b,departure_time_utc:'2099-04-15T10:00:00Z'};
 const c=leg('BCN','MAD','300','2099-04-16T01:00:00Z','2099-04-16T02:00:00Z');const chain=[a,short,c];let calls=0;
 const r=await compareSeparateTickets({...query,destination:'MAD',contiguousGroups:true},{searcher:async q=>{calls++;if(q.origin==='YHZ'&&q.destination==='MAD')return {offers:[offer(chain,900,'through','target')]};const start=chain.findIndex(s=>s.departure_airport===q.origin),end=chain.findIndex(s=>s.arrival_airport===q.destination);return {offers:[offer(chain.slice(start,end+1),200,'group','group')]};}});
 assert.equal(calls,3);assert.equal(r.plans.length,1);assert.equal(r.plans[0].price,400);assert.equal(r.plans[0].tickets[0].segments.length,2);assert.deepEqual(r.plans[0].connectionsMinutes,[240]);
});
test('four-segment grouping covers seven partitions with nine deduplicated blocks',async()=>{
 const c=leg('BCN','MAD','300','2099-04-16T01:00:00Z','2099-04-16T02:00:00Z'),d=leg('MAD','LIS','400','2099-04-16T06:00:00Z','2099-04-16T07:00:00Z');const chain=[a,b,c,d];const calls=[];
 const r=await compareSeparateTickets({...query,destination:'LIS',contiguousGroups:true},{searcher:async q=>{calls.push(q);if(q.origin==='YHZ'&&q.destination==='LIS')return {offers:[offer(chain,1000,'through','target')]};const start=chain.findIndex(s=>s.departure_airport===q.origin),end=chain.findIndex(s=>s.arrival_airport===q.destination);return {offers:[offer(chain.slice(start,end+1),100,'block','block')]};}});
 assert.equal(calls.length,10);assert.equal(r.plans.length,7);assert.deepEqual(r.coverage,{searches:10,eligibleTicketPartitions:7,uniqueTicketBlocks:9,pricedTicketBlocks:9,completePlans:7,routeAlternativesDiscovered:0});assert.equal(new Set(calls.map(q=>`${q.origin}-${q.destination}`)).size,10);assert.equal(r.plans[0].price,200);
});
test('missing block prices remove only affected groupings and report partial coverage',async()=>{
 const c=leg('BCN','MAD','300','2099-04-16T01:00:00Z','2099-04-16T02:00:00Z');const chain=[a,b,c];
 const r=await compareSeparateTickets({...query,destination:'MAD',contiguousGroups:true},{searcher:async q=>{if(q.origin==='YHZ'&&q.destination==='MAD')return {offers:[offer(chain,900,'through','target')]};if(q.origin==='YUL'&&q.destination==='MAD')return {offers:[],sources:[{provider:'Ignav',status:'ok',received:0,accepted:0}]};const start=chain.findIndex(s=>s.departure_airport===q.origin),end=chain.findIndex(s=>s.arrival_airport===q.destination);return {offers:[offer(chain.slice(start,end+1),100,'block','block')],sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}]};}});
 assert.equal(r.coverage.eligibleTicketPartitions,3);assert.equal(r.coverage.pricedTicketBlocks,4);assert.equal(r.coverage.uniqueTicketBlocks,5);assert.equal(r.coverage.completePlans,2);assert.equal(r.plans.length,2);
 const missing=r.ticketBlockCoverage.find(block=>block.status==='unpriced');assert.ok(missing);assert.equal(missing.qualifyingQuotes,0);assert.equal(missing.exactFlights[0].carrier,'AC');assert.equal(missing.responses[0].sources[0].provider,'Ignav');assert.equal(missing.responses[0].sources[0].received,0);
});

const backA=leg('BCN','YUL','300','2099-04-25T08:00:00Z','2099-04-25T16:00:00Z'),backB=leg('YUL','YHZ','400','2099-04-25T20:00:00Z','2099-04-25T21:00:00Z');
const round={...query,tripType:'round-trip',returnDate:'2099-04-25'};
test('round-trip comparison prices whole directions and exact segments without treating the stay as a transfer',async()=>{
 const calls=[],altOut=leg('YHZ','YYZ','301','2099-04-15T07:00:00Z','2099-04-15T09:00:00Z'),altInbound=leg('BCN','YYZ','302','2099-04-25T07:00:00Z','2099-04-25T15:00:00Z'),altHome=leg('YYZ','YHZ','303','2099-04-25T18:00:00Z','2099-04-25T20:00:00Z'),chains=[[a,b],[backA,backB]];
 const alternative={...offer([altOut,leg('YYZ','BCN','304','2099-04-15T12:00:00Z','2099-04-15T20:00:00Z')],1100,'alternative','alternative-round'),cabin:'economy',inbound:{segments:[altInbound,altHome]}};
 const r=await compareSeparateTickets(round,{searcher:async q=>{calls.push(q);if(q.tripType==='round-trip')return {offers:[{...offer(chains[0],1000,'baseline','target'),inbound:{segments:chains[1]}},alternative]};const segments=chains.flat().filter(s=>Date.parse(s.departure_time_utc)>=Date.parse(q.date)&&s.departure_airport===q.origin);const first=segments[0],chain=chains.find(c=>c.includes(first)),start=chain.indexOf(first),end=chain.findIndex(s=>s.arrival_airport===q.destination);return {offers:[offer(chain.slice(start,end+1),q.origin==='YHZ'&&q.destination==='BCN'||q.origin==='BCN'&&q.destination==='YHZ'?350:100,'ticket','oneway')]};}});
 assert.equal(calls.length,7);assert.equal(r.plans.length,4);assert.equal(r.plans[0].price,400);assert.deepEqual(r.plans[0].connectionsMinutes,[240,240]);assert.equal(r.plans[0].tickets.filter(t=>t.direction==='inbound').length,2);assert.equal(calls.filter(q=>q.tripType==='round-trip').length,1);assert.ok(calls.slice(1).every(q=>q.tripType==='one-way'&&!q.returnDate));assert.equal(r.routeAlternatives.length,1);assert.equal(r.routeAlternatives[0].inbound.via[0],'YYZ');
});
test('nonstop round trips can compare two one-way tickets and retain no-lower-price cases',async()=>{
 const outbound=leg('YHZ','BCN','101','2099-04-15T08:00:00Z','2099-04-15T16:00:00Z'),inbound=leg('BCN','YHZ','102','2099-04-25T08:00:00Z','2099-04-25T16:00:00Z');
 const r=await compareSeparateTickets(round,{searcher:async q=>({offers:q.tripType==='round-trip'?[{...offer([outbound],500,'baseline','target'),inbound:{segments:[inbound]}}]:[offer([q.origin==='YHZ'?outbound:inbound],300,'oneway','ticket')]})});
 assert.equal(r.plans.length,1);assert.equal(r.plans[0].price,600);assert.equal(r.plans[0].comparison,'no_lower_price');assert.equal(r.plans[0].differenceBeforeExtras,-100);assert.deepEqual(r.plans[0].connectionsMinutes,[]);
});
test('request budget stops independent calls and stale baselines cannot authorize comparison',async()=>{
 let calls=0;const searcher=async()=>{calls++;return {offers:[{...offer([a,b],1000,'baseline','target'),inbound:{segments:[backA,backB]}}]};};
 const r=await compareSeparateTickets({...round,searchLimit:2},{searcher});assert.equal(calls,1);assert.equal(r.status,'budget_exceeded');assert.equal(r.coverage.estimatedSearches,7);assert.ok(r.ticketBlockCoverage.every(block=>block.status==='not_searched'));
 const stale=await compareSeparateTickets(query,{searcher:async()=>({offers:[{...offer([a,b],500,'old','target'),observedAt:new Date(Date.now()-16*60000).toISOString()}]})});assert.equal(stale.status,'baseline_unavailable');
});
test('return flight mismatches and a forbidden layover window cannot yield complete plans',async()=>{
 const r=await compareSeparateTickets(round,{searcher:async q=>({offers:q.tripType==='round-trip'?[{...offer([a,b],1000,'base','target'),inbound:{segments:[backA,backB]}}]:q.origin==='YHZ'?[offer([a,b],300,'out','ticket')]:[]})});assert.equal(r.plans.length,0);
 let calls=0;const filtered=await compareSeparateTickets({...round,filters:{maxLayover:200}},{searcher:async()=>{calls++;return {offers:[{...offer([a,b],1000,'base','target'),inbound:{segments:[backA,backB]}}]};}});assert.equal(filtered.status,'filter_ineligible');assert.equal(calls,1);
});
test('provider expiry limits each comparison and tickets expiring during search are withheld',async t=>{
 const now=Date.now(),expiry=new Date(now+1000).toISOString();let calls=0;
 const searcher=async q=>{calls++;if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer([a,b],500,'baseline','target')]};return {offers:[{...offer([q.origin==='YHZ'?a:b],100,'ticket','leg'),...(q.origin==='YHZ'?{expiresAt:expiry}:{})}]};};
 const r=await compareSeparateTickets(query,{searcher});assert.equal(r.plans[0].expiresAt,expiry);assert.equal(r.plans[0].tickets[0].expiresAt,expiry);
 calls=0;t.mock.method(Date,'now',()=>now);
 const expired=await compareSeparateTickets(query,{searcher:async q=>{if(calls===2)Date.now.mock.mockImplementation(()=>now+2000);return searcher(q);}});
 assert.equal(expired.plans.length,0);assert.equal(expired.status,'segment_unavailable');
});
test('fractional-cent prices and nonmatching return schedules never contribute to a total',async()=>{
 const r=await compareSeparateTickets(round,{searcher:async q=>({offers:q.tripType==='round-trip'?[{...offer([a,b],1000,'base','target'),inbound:{segments:[backA,backB]}}]:q.origin==='YHZ'?[offer([a,b],100.001,'out','ticket')]:[offer([{...backA,flight_number:'999'},backB],200,'back','ticket')]})});
 assert.deepEqual(r.plans,[]);
});

test('alternate route request cannot override the original trip constraints', async () => {
 const calls=[];
 const result=await compareSeparateTickets({
  ...query,routeSearchLimit:1,
  routePairs:[{origin:'YUL',destination:'LAX',date:'2099-05-01',returnDate:'2099-05-09',tripType:'round-trip',cabin:'first',adults:7,childrenAges:[5],filters:{maxStops:0}}],
 },{searcher:async q=>{
  calls.push(structuredClone(q));
  if(q.origin==='YHZ'&&q.destination==='BCN')return {offers:[offer([a,b],600,'through','target')]};
  if(q.origin==='YHZ')return {offers:[offer([a],100,'one','one')]};
  if(q.origin==='YUL')return {offers:[]};
  return {offers:[offer([b],250,'two','two')]};
 }});

 assert.notEqual(result.status,'baseline_unavailable');
 const alternate=calls.find(call=>call.origin==='YUL');
 assert.ok(alternate,'expected one alternate airport-pair search');
 assert.equal(alternate.destination,'LAX');
 assert.equal(alternate.date,query.date);
 assert.equal(alternate.tripType,'one-way');
 assert.equal(alternate.returnDate,undefined);
 assert.equal(alternate.cabin,'economy');
 assert.equal(alternate.adults,1);
 assert.deepEqual(alternate.childrenAges,[]);
 assert.deepEqual(alternate.filters,{maxStops:null,maxPrice:null,maxDurationMinutes:null,departureWindow:null,sort:'price',airlinesInclude:[],airlinesExclude:[],minLayover:null,maxLayover:null,countriesExclude:[]});
});
