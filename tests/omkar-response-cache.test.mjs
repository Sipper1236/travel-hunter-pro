import test from 'node:test';
import assert from 'node:assert/strict';
import {createJobStore} from '../lib/job-store.mjs';
import {searchProviders} from '../lib/providers.mjs';
import {omkarResponseCacheKey} from '../lib/omkar-response-cache.mjs';

const query={source:'omkar-expedia',origin:'YHZ',destination:'BCN',date:'2027-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],filters:{}};
const offer=(input,observedAt=new Date().toISOString())=>({
 provider:'Expedia via Omkar',source:'Omkar Expedia Scraper API',section:'one-way',price:845.5,currency:'CAD',travelers:'1 adult · provider scope: one-way per traveler',cabin:input.cabin,
 from:input.origin,to:input.destination,airlines:['Example Air'],departureDate:input.date,departureTime:'08:20',arrivalDate:input.date,arrivalTime:'11:00',durationMinutes:160,via:[],
 segments:[{marketing_carrier_code:'EA',flight_number:'EA123',departure_airport:input.origin,arrival_airport:input.destination,departure_time_local:`${input.date}T08:20:00-04:00`,arrival_time_local:`${input.date}T11:00:00-04:00`}],
 observedAt,sourceUrl:'https://www.expedia.ca/Flight-Information?offer=observed',bookingStatus:'Provider fare link; seller price and availability must be rechecked',fees:'Fare inclusions and mandatory charges not fully verified',
});

test('Omkar reuses only an exact fresh complete offer and preserves observation time',async()=>{
 const store=createJobStore({path:':memory:'});let calls=0;
 try{
  const searchOmkarExpedia=async input=>{calls++;return {offers:[offer(input)],priceObservations:[],sources:[{provider:'Expedia via Omkar',status:'ok',received:1,accepted:1}]};};
  const first=await searchProviders(query,{providerCache:store,searchOmkarExpedia});
  const observedAt=first.offers[0].observedAt;
  const second=await searchProviders(query,{providerCache:store,searchOmkarExpedia});
  assert.equal(calls,1);assert.equal(second.offers[0].observedAt,observedAt);
  assert.equal(second.sources.find(row=>row.provider==='Expedia via Omkar').cacheStatus,'hit');
  const changed=await searchProviders({...query,filters:{maxStops:0}},{providerCache:store,searchOmkarExpedia});
  assert.equal(calls,2);assert.notEqual(changed.sources.find(row=>row.provider==='Expedia via Omkar').cacheStatus,'hit');
 }finally{store.close();}
});

test('Omkar does not cache price-only, empty, stale or unsupported-party observations',async()=>{
 const store=createJobStore({path:':memory:'});let calls=0;
 try{
  const priceOnly=async()=>{calls++;return {offers:[],priceObservations:[{provider:'Expedia via Omkar',price:845.5,currency:'CAD'}],sources:[{provider:'Expedia via Omkar',status:'ok',received:1,accepted:0,priceObservations:1}]};};
  for(let i=0;i<2;i++)await searchProviders(query,{providerCache:store,searchOmkarExpedia:priceOnly});
  assert.equal(calls,2);
  const staleSearch=async input=>{calls++;return {offers:[offer(input,new Date(Date.now()-16*60_000).toISOString())],priceObservations:[],sources:[{provider:'Expedia via Omkar',status:'ok',received:1,accepted:1}]};};
  for(let i=0;i<2;i++)await searchProviders({...query,date:'2027-04-16'},{providerCache:store,searchOmkarExpedia:staleSearch});
  assert.equal(calls,4);
  const unsupported=await searchProviders({...query,adults:2},{providerCache:store,searchOmkarExpedia:()=>{throw Error('must not call');}});
  assert.notEqual(unsupported.sources.find(row=>row.provider==='Expedia via Omkar').cacheStatus,'hit');
 }finally{store.close();}
});

test('Omkar cache identity binds exact fare inputs and excludes unsupported shapes',()=>{
 const key=omkarResponseCacheKey(query);assert.ok(key);assert.equal(omkarResponseCacheKey({...query,returnDate:null}),key);
 for(const changed of [
  {...query,destination:'LAX'},
  {...query,date:'2027-04-16'},
  {...query,cabin:'business'},
  {...query,filters:{maxStops:0}},
  {...query,originAirport:{code:'YHZ',name:'Different terminal label'}},
 ])assert.notEqual(omkarResponseCacheKey(changed),key);
 assert.notEqual(omkarResponseCacheKey(query,{accountScope:'other-account'}),key);
 for(const unsupported of [
  {...query,adults:2},
  {...query,children:1,childrenAges:[7]},
  {...query,tripType:'round-trip',returnDate:'2027-04-20'},
  {...query,travelers:[{id:'traveler',birthDate:'1990-01-01'}]},
 ])assert.equal(omkarResponseCacheKey(unsupported),null);
});

test('Omkar cache scopes adapter key overrides separately even when the environment key is unchanged',async()=>{
 const store=createJobStore({path:':memory:'});let calls=0;
 try{
  const searchOmkarExpedia=async(input,options)=>{calls++;assert.ok(['account-one','account-two'].includes(options.apiKey));return {offers:[offer(input)],priceObservations:[],sources:[{provider:'Expedia via Omkar',status:'ok',received:1,accepted:1}]};};
  const first=await searchProviders(query,{providerCache:store,omkarOptions:{apiKey:'account-one'},searchOmkarExpedia});
  const second=await searchProviders(query,{providerCache:store,omkarOptions:{apiKey:'account-two'},searchOmkarExpedia});
  assert.equal(calls,2);assert.notEqual(second.sources.find(row=>row.provider==='Expedia via Omkar').cacheStatus,'hit');
  assert.equal(first.offers.length,1);assert.equal(second.offers.length,1);
 }finally{store.close();}
});

test('Omkar evicts a mismatched persisted result before dispatching a fresh exact request',async()=>{
 const store=createJobStore({path:':memory:'}),calls=[];
 try{
  const searchOmkarExpedia=async input=>({offers:[offer(input)],priceObservations:[],sources:[{provider:'Expedia via Omkar',status:'ok',received:1,accepted:1}]});
  const first=await searchProviders(query,{providerCache:store,searchOmkarExpedia}),key=omkarResponseCacheKey(query);
  store.setProviderResponse(key,{...first,query:{...first.query,destination:'LAX'}},Date.now()+30_000);
  const refreshed=await searchProviders(query,{providerCache:store,searchOmkarExpedia:async input=>{calls.push(input);return searchOmkarExpedia(input);}});
  assert.equal(calls.length,1);assert.equal(refreshed.offers[0].to,'BCN');
  assert.equal(refreshed.sources.find(row=>row.provider==='Expedia via Omkar').cacheStatus,undefined);
 }finally{store.close();}
});
