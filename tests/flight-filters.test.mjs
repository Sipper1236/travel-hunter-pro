import test from 'node:test';
import assert from 'node:assert/strict';
import {filterOffers,validateFilters} from '../lib/flight-filters.mjs';
import {validateTravelers} from '../lib/travelers.mjs';
import {flightOfferError} from '../lib/flight-offer.mjs';
test('filters stop count and CAD group budget then sorts by duration',()=>{
 const result=filterOffers([{price:300,via:['YUL'],durationMinutes:500},{price:400,via:[],durationMinutes:200},{price:200,via:['YUL','LHR'],durationMinutes:300},{price:100,durationMinutes:100}],validateFilters({maxStops:1,maxPrice:350,sort:'duration'}));
 assert.deepEqual(result.offers.map(x=>x.price),[300]);assert.deepEqual(result.rejected,{stops:1,budget:1,unknownStops:1,duration:0,unknownDuration:0,departureTime:0,unknownDepartureTime:0,airline:0,unknownAirline:0,layover:0,unknownLayover:0,country:0,unknownCountry:0});
});
test('requires actual ages and rejects invalid filters',()=>{
 assert.throws(()=>validateTravelers({adults:1,children:1}),/actual age/);
 assert.deepEqual(validateTravelers({adults:1,children:2,childrenAges:[10,15]}).childrenAges,[10,15]);
 assert.throws(()=>validateFilters({maxStops:9}));assert.throws(()=>validateFilters({maxPrice:-1}));
});

test('maximum duration applies to every direction and omits unknown durations',()=>{
 const filters=validateFilters({maxDurationMinutes:600});
 const segment=(minutes,departure='2027-04-15T08:00:00Z')=>({departure_airport:'YHZ',arrival_airport:'YUL',departure_time_utc:departure,arrival_time_utc:new Date(Date.parse(departure)+minutes*60000).toISOString()});
 const offers=[
  {price:100,durationMinutes:590,segments:[segment(590)]},
  {price:200,durationMinutes:590,segments:[segment(590)],inbound:{durationMinutes:601,segments:[segment(601,'2027-04-16T08:00:00Z')]}},
  {price:300},
 ];
 const result=filterOffers(offers,filters);
 assert.deepEqual(result.offers.map(offer=>offer.price),[100]);
 assert.equal(result.rejected.duration,1);
 assert.equal(result.rejected.unknownDuration,1);
 assert.throws(()=>validateFilters({maxDurationMinutes:59}));
 assert.throws(()=>validateFilters({maxDurationMinutes:2881}));
});

test('maximum journey duration derives full elapsed time from offset-aware segments, including layovers',()=>{
 const segments=[
  {departure_airport:'YHZ',arrival_airport:'YUL',departure_time_utc:'2027-04-15T08:00:00Z',arrival_time_utc:'2027-04-15T10:00:00Z'},
  {departure_airport:'YUL',arrival_airport:'BCN',departure_time_utc:'2027-04-15T16:00:00Z',arrival_time_utc:'2027-04-15T18:00:00Z'},
 ];
 const offer={price:100,from:'YHZ',to:'BCN',durationMinutes:240,segments};
 const overLimit=filterOffers([offer],validateFilters({maxDurationMinutes:300}));
 assert.deepEqual(overLimit.offers,[]);assert.equal(overLimit.rejected.duration,1);
 const withinLimit=filterOffers([offer],validateFilters({maxDurationMinutes:600}));
 assert.deepEqual(withinLimit.offers,[offer]);
 const missing=filterOffers([{...offer,segments:segments.map(({departure_airport,arrival_airport})=>({departure_airport,arrival_airport}))}],validateFilters({maxDurationMinutes:600}));
 assert.deepEqual(missing.offers,[]);assert.equal(missing.rejected.unknownDuration,1);
 const unknownOffset=filterOffers([{...offer,segments:[{...segments[0],departure_time_utc:'2027-04-15T08:00:00-00:00'}]}],validateFilters({maxDurationMinutes:600}));
 assert.deepEqual(unknownOffset.offers,[]);assert.equal(unknownOffset.rejected.unknownDuration,1);
});

test('duration sorting orders by exact elapsed journey time, not provider summary',()=>{
 const make=(price,summaryMinutes,elapsedMinutes)=>({price,durationMinutes:summaryMinutes,segments:[{departure_airport:'YHZ',arrival_airport:'BCN',departure_time_utc:'2027-04-15T08:00:00Z',arrival_time_utc:new Date(Date.parse('2027-04-15T08:00:00Z')+elapsedMinutes*60000).toISOString()}]});
 const result=filterOffers([make(100,60,180),make(200,300,60)],validateFilters({sort:'duration'}));
 assert.deepEqual(result.offers.map(offer=>offer.price),[200,100]);
});

test('departure-time windows use observed local times on every requested direction',()=>{
 const filters=validateFilters({departureWindow:'0600_1200'});
 const result=filterOffers([
  {price:100,departureTime:'06:00',inbound:{departureTime:'11:59'}},
  {price:200,departureTime:'12:00'},
  {price:300,departureTime:'08:00',inbound:{departureTime:'18:00'}},
  {price:400},
 ],filters);
 assert.deepEqual(result.offers.map(offer=>offer.price),[100]);
 assert.equal(result.rejected.departureTime,2);
 assert.equal(result.rejected.unknownDepartureTime,1);
 assert.throws(()=>validateFilters({departureWindow:'overnight'}),/departure-time window/);
});

test('airline and layover filters use verified segment data and exclude unknowns',()=>{
 const segments=[{marketing_carrier_code:'AC',arrival_time_utc:'2027-04-15T10:00:00Z'},{marketing_carrier_code:'AC',departure_time_utc:'2027-04-15T12:00:00Z'}];
 const filters=validateFilters({airlinesInclude:['AC'],minLayover:90,maxLayover:180});
 const r=filterOffers([{price:1,via:['YUL'],segments},{price:2,via:['YUL']},{price:3,via:['YUL'],segments:[segments[0],{...segments[1],marketing_carrier_code:'BA'}]}],filters);
 assert.equal(r.offers.length,1);assert.equal(r.rejected.unknownAirline,1);assert.equal(r.rejected.airline,1);
});

test('country exclusions cover both directions and do not guess unknown airport countries',async()=>{
 const {applyFlightFilters}=await import('../lib/flight-filters.mjs');
 const r=await applyFlightFilters([{price:100,via:['JFK']},{price:200,via:['YUL'],inbound:{via:['LHR']}},{price:300,via:['ZZZ']},{price:400,via:[]}],validateFilters({countriesExclude:['US']}),{lookup:async()=>new Map([['JFK','US'],['YUL','CA'],['LHR','GB']])});
 assert.deepEqual(r.offers.map(o=>o.price),[200,400]);assert.equal(r.rejected.country,1);assert.equal(r.rejected.unknownCountry,1);
});

test('actual segment connections cannot bypass stop, country or layover filters with an empty via summary',async()=>{
 const offer={price:100,via:[],segments:[{departure_airport:'YHZ',arrival_airport:'YYZ',arrival_time_utc:'2099-04-15T11:00:00Z'},{departure_airport:'YYZ',arrival_airport:'BCN',departure_time_utc:'2099-04-15T12:00:00Z'}]};
 assert.equal(filterOffers([offer],validateFilters({maxStops:0})).offers.length,0);
 assert.equal(filterOffers([offer],validateFilters({minLayover:120})).offers.length,0);
 let airports;const filtered=await (await import('../lib/flight-filters.mjs')).applyFlightFilters([offer],validateFilters({countriesExclude:['CA']}),{lookup:async codes=>{airports=codes;return new Map([['YYZ','CA']]);}});
 assert.deepEqual(airports,['YYZ']);assert.equal(filtered.offers.length,0);
 const full={...offer,provider:'Test source',source:'test',travelers:'1 adult',bookingStatus:'not booked',fees:'unknown',currency:'CAD',observedAt:new Date().toISOString(),cabin:'economy',airlines:['AC'],from:'YHZ',to:'BCN',departureDate:'2099-04-15',arrivalDate:'2099-04-15',departureTime:'08:00',arrivalTime:'18:00',durationMinutes:600};
 assert.equal(flightOfferError(full,{origin:'YHZ',destination:'BCN',date:'2099-04-15',cabin:'economy'}),'connections');
});
