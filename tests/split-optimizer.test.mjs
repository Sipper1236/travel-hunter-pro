import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SPLIT_SEARCHES, optimizePassengerSplits } from '../lib/split-optimizer.mjs';
import {SourceRequestError} from '../lib/source-errors.mjs';

const leg=(from,to,n,day)=>({marketing_carrier_code:'AC',flight_number:n,departure_airport:from,arrival_airport:to,departure_time_utc:`2099-04-${day}T08:00:00Z`,arrival_time_utc:`2099-04-${day}T16:00:00Z`,departure_time_local:`2099-04-${day}T08:00:00`,arrival_time_local:`2099-04-${day}T16:00:00`});
const sameFlight = { itineraryKey: 'exact-outbound', currency: 'CAD', observedAt:new Date().toISOString(), segments: [leg('YHZ','BCN','123','15')], provider: 'Ignav' };
const back=leg('BCN','YHZ','456','25');
const response=offers=>({sources:[{provider:'Ignav',status:'ok'}],offers});
test('compares same-flight adult-only passenger partitions', async () => {
  const seen=[];
  const result=await optimizePassengerSplits({adults:2,children:0}, {searcher:async q=>{seen.push(q.adults);return {sources:[{provider:'Ignav',status:'ok'}],offers:[{...sameFlight,price:q.adults===1?90:400,ignavId:`fare_${q.adults}`} ]};}});
  assert.deepEqual(seen,[1,2]);assert.equal(result.plans[0].price,180);assert.equal(result.plans[0].tickets.length,2);
});
test('rejects child split searches until guardian and age rules are supported',async()=>{
 let calls=0;await assert.rejects(optimizePassengerSplits({adults:2,children:1},{searcher:async()=>{calls++;}}),/guardian/);assert.equal(calls,0);
});
test('identified parties retain guardians on exact-flight booking partitions',async()=>{
 const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'other',birthDate:'2071-01-01'},{id:'child',birthDate:'2090-01-01',guardianId:'parent'}];
 const input={origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',cabin:'economy',travelers};const seen=[];
 const result=await optimizePassengerSplits(input,{searcher:async q=>{const ids=q.travelers.map(p=>p.id);seen.push(ids);return response([{...sameFlight,price:ids.length===3?500:ids.includes('child')?130:50,ignavId:`fare_${ids.join('_')}`}]);}});
 assert.ok(seen.every(ids=>!ids.includes('child')||ids.includes('parent')));
 assert.equal(result.plans[0].price,180);
 assert.deepEqual(result.plans[0].tickets.map(t=>t.travelerIds).sort((a,b)=>a.length-b.length),[['other'],['parent','child']]);
 assert.match(result.limitation,/eligibility.*not verified/);
 let calls=0;const limited=await optimizePassengerSplits(input,{maxSearches:1,searcher:async()=>{calls++;}});assert.equal(calls,0);assert.equal(limited.exhaustive,false);
});
test('hard request budget stops before provider calls',async()=>{
 let calls=0;const result=await optimizePassengerSplits({adults:5,children:0},{maxSearches:2,searcher:async()=>{calls++;}});assert.equal(calls,0);assert.equal(result.exhaustive,false);assert.match(result.limitation,/above the per-run cap/);assert.ok(MAX_SPLIT_SEARCHES<=30);
});

test('passenger splits cannot combine differing or one-sided operating carrier evidence',async()=>{
 for(const identified of [false,true])for(const roundTrip of [false,true])for(const smallerOperator of ['LH',undefined]){
  const party=identified?{travelers:['a','b','c'].map(id=>({id,birthDate:'2070-01-01'}))}:{adults:3,children:0};
  const r=await optimizePassengerSplits({...party,date:'2099-04-15',returnDate:'2099-04-25',tripType:roundTrip?'round-trip':'one-way'},{searcher:async q=>{
   const count=q.travelers?.length??q.adults,operator=count===2?smallerOperator:'AC';
   const offer={...sameFlight,segments:sameFlight.segments.map(s=>({...s,operating_carrier_code:roundTrip?'AC':operator})),...(roundTrip?{inbound:{segments:[{...back,operating_carrier_code:operator}]}}:{}),price:count===1?100:count===2?1:500,ignavId:`operator_${count}`};
   return response([offer]);
  }});
  assert.equal(r.plans[0].price,300);
  assert.ok(r.plans[0].tickets.every(ticket=>ticket.ignavId==='operator_1'));
 }
});
test('round-trip party splits retain both directions and provider quote expiry',async()=>{
 const expiry=new Date(Date.now()+60_000).toISOString(),seen=[];
 const r=await optimizePassengerSplits({adults:2,children:0,tripType:'round-trip',returnDate:'2099-04-25'},{searcher:async q=>{seen.push(q);return response([{...sameFlight,inbound:{segments:[back]},price:q.adults===1?90:400,ignavId:`round_${q.adults}`,expiresAt:expiry}]);}});
 assert.equal(r.plans[0].price,180);assert.equal(r.plans[0].inbound.segments[0].flight_number,'456');assert.equal(r.plans[0].expiresAt,expiry);assert.equal(r.plans[0].tickets[0].expiresAt,expiry);assert.ok(seen.every(q=>q.tripType==='round-trip'&&q.returnDate==='2099-04-25'));
});
test('different return flights cannot mix even when supplied itinerary labels collide',async()=>{
 const r=await optimizePassengerSplits({adults:3,children:0,tripType:'round-trip'},{searcher:async q=>response(q.adults===3?[]:[{...sameFlight,inbound:{segments:[{...back,flight_number:q.adults===1?'456':'789'}]},price:10,ignavId:`party_${q.adults}`}])});
 assert.equal(r.plans.length,1);assert.equal(r.plans[0].price,30);assert.ok(r.plans[0].tickets.every(t=>t.ignavId==='party_1'));
});
test('expired smaller-party quotes cannot contribute after later searches finish',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const r=await optimizePassengerSplits({adults:2,children:0},{searcher:async q=>{if(q.adults===2)Date.now.mock.mockImplementation(()=>now+2000);return response([{...sameFlight,price:q.adults===1?90:400,ignavId:`party_${q.adults}`,...(q.adults===1?{expiresAt:new Date(now+1000).toISOString()}:{})}]);}});
 assert.equal(r.plans[0].price,400);assert.equal(r.plans[0].tickets.length,1);
});
test('full-group budget applies to combined bookings rather than each booking alone',async()=>{
 const r=await optimizePassengerSplits({adults:2,children:0,filters:{maxPrice:100}},{searcher:async q=>response(q.adults===1?[{...sameFlight,price:90,ignavId:'single'}]:[])});assert.deepEqual(r.plans,[]);
});
test('return flight airline filters also apply to split-party plans',async()=>{
 const r=await optimizePassengerSplits({adults:2,children:0,tripType:'round-trip',filters:{airlinesExclude:['BA']}},{searcher:async()=>response([{...sameFlight,inbound:{segments:[{...back,marketing_carrier_code:'BA'}]},price:100,ignavId:'fare'}])});assert.deepEqual(r.plans,[]);
});
test('invalid money and stale observations cannot produce split totals',async()=>{
 const r=await optimizePassengerSplits({adults:2,children:0},{searcher:async q=>response([{...sameFlight,price:q.adults===1?90.001:400,ignavId:'fare',...(q.adults===2?{observedAt:new Date(Date.now()-16*60_000).toISOString()}:{})}])});assert.deepEqual(r.plans,[]);
});
test('adult partitions sum exact CAD cents',async()=>{
 const r=await optimizePassengerSplits({adults:3,children:0},{searcher:async q=>response(q.adults===3?[]:[{...sameFlight,price:q.adults/10,ignavId:`fare_${q.adults}`}])});assert.equal(r.plans[0].price,0.3);
});
test('provider cooldown stops remaining compositions and keeps retry evidence',async()=>{
 let calls=0;const retryAt=Date.now()+60_000;
 const r=await optimizePassengerSplits({adults:2,children:0},{searcher:async()=>{calls++;throw new SourceRequestError('Source cooldown.',{status:'rate_limited',httpStatus:429,retryAt});}});
 assert.equal(calls,1);assert.deepEqual(r.plans,[]);assert.equal(r.exhaustive,false);assert.equal(r.searches[0].retryAt,new Date(retryAt).toISOString());assert.match(r.limitation,/Retry after/);
});
