import test from 'node:test';
import assert from 'node:assert/strict';
import {createJobStore} from '../lib/job-store.mjs';
import {searchProviders} from '../lib/providers.mjs';
import {googleOneWayResponseCacheKey} from '../lib/google-response-cache.mjs';
import {googleOneWayUrl} from '../lib/google-round-trip.mjs';

const query={origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google'};
const offerFor=(input,observedAt=new Date().toISOString())=>({provider:'Google Flights',source:'Google Flights native one-way results-page observation',price:240,currency:'CAD',observedAt,cabin:'economy',travelers:'1 adult; Google page displayed one passenger',from:input.origin,to:input.destination,departureDate:input.date,departureTime:'09:00',arrivalDate:input.date,arrivalTime:'18:00',durationMinutes:540,via:[],airlines:['Example Air'],segments:[{from:input.origin,to:input.destination,carrierCode:'EA',flightNumber:'EA123',departureAt:`${input.date}T09:00:00-03:00`,arrivalAt:`${input.date}T18:00:00+01:00`}],sourceUrl:googleOneWayUrl(input),bookingStatus:'Observed Google results-page price; seller availability and price have not been rechecked.',fees:'Baggage, mandatory charges and seller checkout total were not independently verified.'});

test('Google one-way cache reuses an exact fresh observation and preserves its source time',async()=>{
 const store=createJobStore({path:':memory:'});let calls=0;
 try{
  const searchGoogle=async input=>{calls++;return {offers:[offerFor(input)],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]};};
  const first=await searchProviders(query,{providerCache:store,searchGoogle});
  const observedAt=first.offers[0].observedAt;
  const second=await searchProviders(query,{providerCache:store,searchGoogle});
  assert.equal(calls,1);assert.equal(second.offers[0].observedAt,observedAt);
  assert.equal(second.sources.find(row=>row.provider==='Google Flights').cacheStatus,'hit');
  const changed=await searchProviders({...query,filters:{maxStops:0}},{providerCache:store,searchGoogle});
  assert.equal(calls,2,'a changed filter must make a new exact source request');
  assert.notEqual(changed.sources.find(row=>row.provider==='Google Flights').cacheStatus,'hit');
 }finally{store.close();}
});

test('all-source fan-out reuses the same durable Google observation',async()=>{
 const store=createJobStore({path:':memory:'});let googleCalls=0;
 const common={providerCache:store,
  searchGoogle:async input=>{googleCalls++;return {offers:[offerFor(input)],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]};},
  searchIgnav:async()=>({offers:[],sources:[{provider:'Ignav',status:'ok',received:0,accepted:0}]}),
  searchExpedia:async()=>({offers:[],sources:[{provider:'Expedia',status:'ok',received:0,accepted:0}]}),
  searchSkyscanner:async()=>({offers:[],sources:[{provider:'Skyscanner',status:'ok',received:0,accepted:0}]}),
  searchAirCanada:async()=>({offers:[],sources:[{provider:'Air Canada NDC',status:'ok',received:0,accepted:0}]}),
  searchMatrix:async()=>({offers:[],sources:[{provider:'ITA Matrix',status:'ok',received:0,accepted:0}]}),
  searchOmkarExpedia:async()=>({offers:[],sources:[{provider:'Expedia via Omkar',status:'ok',received:0,accepted:0}]})};
 try{
  const input={...query,source:'all'};
  await searchProviders(input,common);
  const second=await searchProviders(input,common);
  assert.equal(googleCalls,1);
  assert.equal(second.sources.find(row=>row.provider==='Google Flights').cacheStatus,'hit');
  assert.equal(second.offers.filter(row=>row.provider==='Google Flights').length,1);
 }finally{store.close();}
});

test('Google one-way cache drops tampered entries and never stores empty or stale results',async()=>{
 const store=createJobStore({path:':memory:'});let calls=0;
 try{
  const searchGoogle=async input=>{calls++;return {offers:[offerFor(input)],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]};};
  const first=await searchProviders(query,{providerCache:store,searchGoogle}),key=googleOneWayResponseCacheKey(query);
  store.setProviderResponse(key,{...first,offers:[{...first.offers[0],to:'LAX'}]},Date.now()+60_000);
  const repaired=await searchProviders(query,{providerCache:store,searchGoogle});
  assert.equal(calls,2);assert.equal(repaired.offers[0].to,'BCN');
  assert.equal(repaired.sources.find(row=>row.provider==='Google Flights').cacheStatus,undefined);
  const empty=await searchProviders({...query,date:'2099-04-16'},{providerCache:store,searchGoogle:async()=>({offers:[],sources:[{provider:'Google Flights',status:'ok',received:0,accepted:0}]})});
  assert.equal(empty.offers.length,0);
  const stale=await searchProviders({...query,date:'2099-04-17'},{providerCache:store,searchGoogle:async input=>({offers:[offerFor(input,new Date(Date.now()-16*60_000).toISOString())],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]})});
  assert.equal(stale.offers.length,0);
  assert.equal(store.getProviderResponse(googleOneWayResponseCacheKey({...query,date:'2099-04-16'})),null);
  assert.equal(store.getProviderResponse(googleOneWayResponseCacheKey({...query,date:'2099-04-17'})),null);
 }finally{store.close();}
});

test('Google cache identity covers exact route, date, market mode and filters only for its supported shape',()=>{
 const key=googleOneWayResponseCacheKey(query);assert.ok(key);
 for(const changed of [
  {...query,destination:'LAX'},
  {...query,date:'2099-04-16'},
  {...query,filters:{maxStops:0}},
  {...query,tripType:'round-trip',returnDate:'2099-04-20'},
  {...query,adults:2},
  {...query,cabin:'business'},
  {...query,travelers:[{id:'private',birthDate:'1990-01-01'}]},
 ])assert.notEqual(googleOneWayResponseCacheKey(changed),key);
 assert.equal(googleOneWayResponseCacheKey({...query,tripType:'round-trip',returnDate:'2099-04-20'}),null);
 assert.equal(googleOneWayResponseCacheKey({...query,adults:2}),null);
});
