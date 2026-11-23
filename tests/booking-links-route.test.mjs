import test from 'node:test';
import assert from 'node:assert/strict';

test('local seller endpoint compares the Ignav response with its persisted selected offer',async()=>{
 process.env.TRAVEL_JOB_DB=':memory:';
 process.env.IGNAV_API_KEY='test-only';
 const [{getJobStore},{POST}]=await Promise.all([
  import('../lib/job-store.mjs'),
  import('../app/api/search/booking-links/route.js'),
 ]);
 const store=getJobStore(),originalFetch=globalThis.fetch;let sellerCalls=0;
 const segment={marketing_carrier_code:'AC',flight_number:'123',departure_airport:'YHZ',departure_time_local:'2099-04-15T08:00:00',departure_time_utc:'2099-04-15T11:00:00Z',arrival_airport:'YYZ',arrival_time_local:'2099-04-15T10:00:00',arrival_time_utc:'2099-04-15T14:00:00Z'};
 const offer={ignavId:'fare_12345678',segments:[segment],cabin:'economy'},ownerToken='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';
 try{
  const job=store.submit({origin:'YHZ'},'request_123',{ownerToken}),claim=store.claim();
  assert.equal(store.finish(job.id,claim.token,{result:{offers:[offer]}}),true);
  let returnedCabin='economy';
  globalThis.fetch=async()=>{sellerCalls++;return Response.json({itinerary:{outbound:{segments:[segment]},cabin_class:returnedCabin},booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/book'}]}]});};
  const denied=await POST(new Request('http://127.0.0.1/api/search/booking-links',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({ignavId:offer.ignavId,ownerToken:'f26e51cc-1c31-4303-a631-1a99f3902430'})}));assert.equal(denied.status,404);assert.equal(sellerCalls,0);
  const request=new Request('http://127.0.0.1/api/search/booking-links',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({ignavId:offer.ignavId,ownerToken})});
  const response=await POST(request),body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.itineraryMatch,'matched');
  assert.equal(body.coverageStatus,'complete');
  assert.equal(body.bookingOptions.length,1);
  returnedCabin='business';
  const changed=await POST(new Request('http://127.0.0.1/api/search/booking-links',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({ignavId:offer.ignavId,ownerToken})})),changedBody=await changed.json();
  assert.equal(changedBody.itineraryMatch,'mismatch');
  assert.equal(changedBody.status,'itinerary_mismatch');
  assert.deepEqual(changedBody.bookingOptions,[]);
  returnedCabin=undefined;
  const missing=await POST(new Request('http://127.0.0.1/api/search/booking-links',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({ignavId:offer.ignavId,ownerToken})})),missingBody=await missing.json();
  assert.equal(missingBody.itineraryMatch,'unknown');
  assert.equal(missingBody.status,'itinerary_unverified');
  assert.deepEqual(missingBody.bookingOptions,[]);
 }finally{
  globalThis.fetch=originalFetch;store.close();delete process.env.TRAVEL_JOB_DB;delete process.env.IGNAV_API_KEY;
 }
});

test('local seller endpoint suppresses links when returned flight timestamps cannot be verified',async()=>{
 process.env.TRAVEL_JOB_DB=':memory:';process.env.IGNAV_API_KEY='test-only';
 const [{createJobStore},{POST}]=await Promise.all([import('../lib/job-store.mjs'),import('../app/api/search/booking-links/route.js')]);
 const store=createJobStore({path:':memory:'}),originalStore=globalThis.__travelFlightJobStore,originalFetch=globalThis.fetch;
 globalThis.__travelFlightJobStore=store;
 const segment={marketing_carrier_code:'AC',flight_number:'123',departure_airport:'YHZ',departure_time_local:'2099-04-15T08:00:00',departure_time_utc:'2099-04-15T11:00:00Z',arrival_airport:'YYZ',arrival_time_local:'2099-04-15T10:00:00',arrival_time_utc:'2099-04-15T14:00:00Z'},offer={ignavId:'fare_abcdefgh',segments:[segment]},ownerToken='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';
 try{
  const job=store.submit({origin:'YHZ'},'unverified_request_01',{ownerToken}),claim=store.claim();assert.equal(store.finish(job.id,claim.token,{result:{offers:[offer]}}),true);
  globalThis.fetch=async()=>Response.json({itinerary:{outbound:{segments:[{...segment,departure_time_utc:'2099-04-15T11:00:00'}]}},booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/book',price:{amount:900,currency:'CAD',status:'verified'}}]}]});
  const response=await POST(new Request('http://127.0.0.1/api/search/booking-links',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({ignavId:offer.ignavId,ownerToken})})),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.itineraryMatch,'unknown');assert.equal(body.status,'itinerary_unverified');assert.deepEqual(body.bookingOptions,[]);assert.equal(body.coverageStatus,'unknown');assert.equal(body.linkedPriceEvidenceStatus,'not_provided');
 }finally{globalThis.fetch=originalFetch;store.close();globalThis.__travelFlightJobStore=originalStore;delete process.env.TRAVEL_JOB_DB;delete process.env.IGNAV_API_KEY;}
});

test('comparison-job owner can refresh a saved exact ticket block, but another owner cannot',async()=>{
 process.env.TRAVEL_JOB_DB=':memory:';process.env.IGNAV_API_KEY='test-only';
 const [{createJobStore},{POST}]=await Promise.all([import('../lib/job-store.mjs'),import('../app/api/search/booking-links/route.js')]);
 const store=createJobStore({path:':memory:'}),originalStore=globalThis.__travelFlightJobStore,originalFetch=globalThis.fetch;
 globalThis.__travelFlightJobStore=store;
 const ownerToken='a8495b65-92e1-4c38-98d0-bd3a9fbc6fed',segment={marketing_carrier_code:'AC',flight_number:'100',departure_airport:'YHZ',arrival_airport:'YUL',departure_time_local:'2099-04-15T08:00:00',departure_time_utc:'2099-04-15T11:00:00Z',arrival_time_local:'2099-04-15T09:00:00',arrival_time_utc:'2099-04-15T12:00:00Z'},ticket={ignavId:'fare_block_123456',segments:[segment],cabin:'economy',price:100,currency:'CAD'};
 let calls=0;
 try{
  const job=store.submit({mode:'segments'},'comparison_request_01',{kind:'comparison',ownerToken}),claim=store.claim();
  assert.equal(store.finish(job.id,claim.token,{result:{status:'observed',plans:[{tickets:[ticket]}]}}),true);
  globalThis.fetch=async()=>{calls++;return Response.json({itinerary:{outbound:{segments:[segment]},cabin_class:'economy'},booking_options:[{legs:['outbound'],links:[{provider_name:'Air Canada',url:'https://aircanada.com/book',specificity:'exact_flight'}]}]});};
  const request=token=>new Request('http://127.0.0.1/api/search/booking-links',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({ignavId:ticket.ignavId,ownerToken:token})});
  const denied=await POST(request('19b460d1-cf42-468a-8ddf-6188d24430f3'));assert.equal(denied.status,404);assert.equal(calls,0);
  const response=await POST(request(ownerToken)),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.itineraryMatch,'matched');assert.equal(body.coverageStatus,'complete');assert.equal(body.bookingOptions.length,1);assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;store.close();globalThis.__travelFlightJobStore=originalStore;delete process.env.TRAVEL_JOB_DB;delete process.env.IGNAV_API_KEY;}
});
