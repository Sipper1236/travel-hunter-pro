import test from 'node:test';
import assert from 'node:assert/strict';
import {createJobStore} from '../lib/job-store.mjs';
import {searchProviders} from '../lib/providers.mjs';
import {googleOneWayResponseCacheKey,googleRoundTripResponseCacheKey} from '../lib/google-response-cache.mjs';
import {googleOneWayUrl} from '../lib/google-round-trip.mjs';
import {airportLocalInstant} from '../lib/airport-timezones.mjs';

const query={origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google'};
const timedSegment=(from,to,date,departureTime,arrivalTime,flightNumber,fromZone,toZone)=>{
 const departureLocal=`${date}T${departureTime}:00`,arrivalLocal=`${date}T${arrivalTime}:00`,departureUtc=airportLocalInstant(departureLocal,fromZone),arrivalUtc=airportLocalInstant(arrivalLocal,toZone);
 return {from,to,departure_airport:from,arrival_airport:to,carrierCode:'EA',marketing_carrier_code:'EA',flightNumber,flight_number:flightNumber,departureAt:departureLocal,arrivalAt:arrivalLocal,departure_time_local:departureLocal,arrival_time_local:arrivalLocal,departure_time_utc:departureUtc,arrival_time_utc:arrivalUtc,departureTimeZone:fromZone,arrivalTimeZone:toZone,durationMinutes:(Date.parse(arrivalUtc)-Date.parse(departureUtc))/60_000};
};
const offerFor=(input,observedAt=new Date().toISOString())=>{const segment=timedSegment(input.origin,input.destination,input.date,'09:00','18:00','EA123','America/Halifax','Europe/Madrid');return {provider:'Google Flights',source:'Google Flights native one-way results-page observation',price:240,currency:'CAD',observedAt,cabin:'economy',travelers:'1 adult; Google page displayed one passenger',from:input.origin,to:input.destination,departureDate:input.date,departureTime:'09:00',arrivalDate:input.date,arrivalTime:'18:00',durationMinutes:segment.durationMinutes,via:[],airlines:['Example Air'],segments:[segment],sourceUrl:googleOneWayUrl(input),bookingStatus:'Observed Google results-page price; seller availability and price have not been rechecked.',fees:'Baggage, mandatory charges and seller checkout total were not independently verified.'};};
const roundTripQuery={...query,tripType:'round-trip',returnDate:'2099-04-20'};
const googleReturnOffer=(input,observedAt=new Date().toISOString())=>{
 const outboundSegment=timedSegment(input.origin,input.destination,input.date,'09:00','18:00','EA123','America/Halifax','Europe/London'),returnSegment=timedSegment(input.destination,input.origin,input.returnDate,'09:00','12:00','EA456','Europe/London','America/Halifax');
 const outbound={from:input.origin,to:input.destination,departureDate:input.date,arrivalDate:input.date,departureTime:'09:00',arrivalTime:'18:00',durationMinutes:outboundSegment.durationMinutes,via:[],airlines:['Example Air'],segments:[outboundSegment]};
 const inbound={from:input.destination,to:input.origin,departureDate:input.returnDate,arrivalDate:input.returnDate,departureTime:'09:00',arrivalTime:'12:00',durationMinutes:returnSegment.durationMinutes,via:[],airlines:['Example Air'],segments:[returnSegment]};
 return {...outbound,inbound,provider:'Google Flights',source:'Google Flights native selected round-trip observation',price:540,currency:'CAD',observedAt,cabin:'economy',travelers:'1 traveler; source fare categories: 1 adult, 0 children',seller:'Example seller',googleSellerId:'seller-1',googleBookingMode:'online',googleParty:{adults:1,children:0,total:1},googleFlightSelection:{outbound:outbound.segments.map(segment=>[segment.from,segment.to,segment.marketing_carrier_code,segment.flight_number,segment.departureAt,segment.arrivalAt]),return:inbound.segments.map(segment=>[segment.from,segment.to,segment.marketing_carrier_code,segment.flight_number,segment.departureAt,segment.arrivalAt])},sourceUrl:'https://www.google.com/travel/flights/booking?tfs=observed&tfu=observed&curr=CAD',bookingStatus:'Observed group return quote; continue through Google to the named seller to verify price and eligibility.',fees:'Google reports required taxes and fees included; baggage and optional charges require seller confirmation.'};
};

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

test('Google round-trip cache reuses only exact fresh count-party quotes',async()=>{
 const store=createJobStore({path:':memory:'});let calls=0;
 try{
  const searchGoogleRoundTrip=async input=>{calls++;return {offers:[googleReturnOffer(input)],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]};};
  const first=await searchProviders(roundTripQuery,{providerCache:store,searchGoogleRoundTrip}),observedAt=first.offers[0].observedAt;
  const second=await searchProviders(roundTripQuery,{providerCache:store,searchGoogleRoundTrip});
  assert.equal(calls,1);assert.equal(second.offers[0].observedAt,observedAt);assert.equal(second.sources.find(row=>row.provider==='Google Flights').cacheStatus,'hit');
  const changed=await searchProviders({...roundTripQuery,returnDate:'2099-04-21'},{providerCache:store,searchGoogleRoundTrip});
  assert.equal(calls,2);assert.notEqual(changed.sources.find(row=>row.provider==='Google Flights').cacheStatus,'hit');
 }finally{store.close();}
});

test('Google round-trip cache rejects tampered, stale, empty and identified-party observations',async()=>{
 const store=createJobStore({path:':memory:'});let calls=0;
 try{
  const searchGoogleRoundTrip=async input=>{calls++;return {offers:[googleReturnOffer(input)],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]};};
  const first=await searchProviders(roundTripQuery,{providerCache:store,searchGoogleRoundTrip}),key=googleRoundTripResponseCacheKey(roundTripQuery);
  store.setProviderResponse(key,{...first,offers:[{...first.offers[0],inbound:{...first.offers[0].inbound,to:'LAX'}}]},Date.now()+30_000);
  const repaired=await searchProviders(roundTripQuery,{providerCache:store,searchGoogleRoundTrip});
  assert.equal(calls,2);assert.equal(repaired.offers[0].inbound.to,'YHZ');assert.equal(repaired.sources.find(row=>row.provider==='Google Flights').cacheStatus,undefined);
  const staleInput={...roundTripQuery,date:'2099-04-16',returnDate:'2099-04-21'};
  const stale=await searchProviders(staleInput,{providerCache:store,searchGoogleRoundTrip:async input=>({offers:[googleReturnOffer(input,new Date(Date.now()-16*60_000).toISOString())],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]})});
  assert.equal(stale.offers.length,0);assert.equal(store.getProviderResponse(googleRoundTripResponseCacheKey(staleInput)),null);
  const emptyInput={...roundTripQuery,date:'2099-04-17',returnDate:'2099-04-22'};
  await searchProviders(emptyInput,{providerCache:store,searchGoogleRoundTrip:async()=>({offers:[],sources:[{provider:'Google Flights',status:'ok',received:0,accepted:0}]})});
  assert.equal(store.getProviderResponse(googleRoundTripResponseCacheKey(emptyInput)),null);
  const {adults,children,childrenAges,...identifiedBase}=roundTripQuery,identifiedInput={...identifiedBase,travelers:[{id:'adult',birthDate:'2070-01-01'}]};let identifiedCalls=0;
  const identifiedSearch=async input=>{identifiedCalls++;return {offers:[googleReturnOffer(input)],sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]};};
  const identifiedFirst=await searchProviders(identifiedInput,{providerCache:store,searchGoogleRoundTrip:identifiedSearch});
  const identifiedSecond=await searchProviders(identifiedInput,{providerCache:store,searchGoogleRoundTrip:identifiedSearch});
  assert.equal(identifiedCalls,2);assert.equal(identifiedFirst.sources.find(row=>row.provider==='Google Flights').cacheStatus,undefined);assert.equal(identifiedSecond.sources.find(row=>row.provider==='Google Flights').cacheStatus,undefined);
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
  const malformedTime={...repaired,offers:[{...repaired.offers[0],segments:[{...repaired.offers[0].segments[0],departure_time_utc:'2099-04-15T13:00:00Z'}]}]};
  store.setProviderResponse(key,malformedTime,Date.now()+60_000);
  const timingRepaired=await searchProviders(query,{providerCache:store,searchGoogle});
  assert.equal(calls,3);assert.equal(timingRepaired.offers[0].segments[0].departure_time_utc,airportLocalInstant('2099-04-15T09:00:00','America/Halifax'));
  assert.equal(timingRepaired.sources.find(row=>row.provider==='Google Flights').cacheStatus,undefined);
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

test('Google round-trip cache identity includes exact dates, ages, route and filters and excludes identified parties',()=>{
 const key=googleRoundTripResponseCacheKey(roundTripQuery);assert.ok(key);
 for(const changed of [
  {...roundTripQuery,destination:'LAX'},
  {...roundTripQuery,date:'2099-04-16'},
  {...roundTripQuery,returnDate:'2099-04-21'},
  {...roundTripQuery,filters:{maxStops:0}},
  {...roundTripQuery,children:1,childrenAges:[7]},
  {...roundTripQuery,cabin:'business'},
  {...roundTripQuery,travelers:[{id:'adult',birthDate:'2070-01-01'}]},
 ])assert.notEqual(googleRoundTripResponseCacheKey(changed),key);
 assert.equal(googleRoundTripResponseCacheKey({...roundTripQuery,travelers:[{id:'adult',birthDate:'2070-01-01'}]}),null);
 assert.equal(googleRoundTripResponseCacheKey({...roundTripQuery,cabin:'business'}),null);
});
