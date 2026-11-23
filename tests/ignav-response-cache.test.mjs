import test from 'node:test';
import assert from 'node:assert/strict';
import {ignavResponseCacheKey,searchIgnavWithCache} from '../lib/ignav-response-cache.mjs';
import {validateFilters} from '../lib/flight-filters.mjs';

const now=Date.parse('2026-11-23T12:00:00.000Z');
const query={origin:'YHZ',destination:'LAX',date:'2027-01-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],source:'ignav',filters:{maxStops:null,airlinesInclude:[],airlinesExclude:[]}};
const offer={provider:'Ignav',source:'Ignav live fare API',price:400,currency:'CAD',travelers:'1 adult',cabin:'economy',from:'YHZ',to:'LAX',departureDate:query.date,departureTime:'08:00',arrivalDate:query.date,arrivalTime:'16:00',durationMinutes:480,via:[],airlines:['Air Canada'],segments:[{departure_airport:'YHZ',arrival_airport:'LAX',marketing_carrier_code:'AC',flight_number:'123',departure_time_local:`${query.date}T08:00:00`,arrival_time_local:`${query.date}T16:00:00`}],observedAt:new Date(now).toISOString(),bookingStatus:'Fare observed',fees:'Verify with seller'};
const result={query:{origin:query.origin,destination:query.destination,date:query.date,cabin:query.cabin,tripType:query.tripType,returnDate:null,adults:query.adults,children:query.children,childrenAges:query.childrenAges,filters:validateFilters(query.filters)},offers:[offer],sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}]};

test('Ignav cache hits only an exact fresh result and preserves provider observation time',async()=>{
 const entries=new Map(),cache={getProviderResponse:(key,at)=>{const row=entries.get(key);return row&&row.expiresAt>at?row.value:null;},setProviderResponse:(key,value,expiresAt)=>entries.set(key,{value,expiresAt})};let calls=0;
 const search=async()=>{calls++;return structuredClone(result);};
 const first=await searchIgnavWithCache(query,{cache,search,now:()=>now});
 const second=await searchIgnavWithCache(query,{cache,search,now:()=>now+1000});
 assert.equal(calls,1);assert.equal(first.offers[0].observedAt,offer.observedAt);assert.equal(second.offers[0].observedAt,offer.observedAt);
 assert.equal(second.sources[0].cacheStatus,'hit');assert.equal(entries.values().next().value.expiresAt,now+5*60*1000);
});

test('Ignav cache key varies with account, route, dates, party ages, cabin, filters, market, and currency',()=>{
 const key=ignavResponseCacheKey(query);assert.ok(key);
 for(const changed of [
  {...query,destination:'YYZ'},
  {...query,date:'2027-01-16'},
  {...query,children:1,childrenAges:[7]},
  {...query,cabin:'business'},
  {...query,filters:{...query.filters,maxStops:1}},
 ])assert.notEqual(ignavResponseCacheKey(changed),key);
 assert.notEqual(ignavResponseCacheKey(query,{accountScope:'other-account'}),key);
 assert.notEqual(ignavResponseCacheKey(query,{market:'US'}),key);
 assert.notEqual(ignavResponseCacheKey(query,{currency:'USD'}),key);
});

test('Ignav cache skips identified parties and never caches empty, stale, or invalid results',async()=>{
 const calls=[];const cache={getProviderResponse:()=>null,setProviderResponse:(...args)=>calls.push(args)};
 const search=async()=>structuredClone(result);
 await searchIgnavWithCache({...query,travelers:[{id:'traveler-1',birthDate:'1990-01-01'}]},{cache,search,now:()=>now});
 assert.equal(calls.length,0);
 for(const invalid of [
  {...result,offers:[]},
  {...result,offers:[{...offer,observedAt:new Date(now-16*60*1000).toISOString()}]},
  {...result,offers:[{...offer,currency:'USD'}]},
  {...result,query:{...result.query,destination:'YYZ'}},
  {...result,sources:[null]},
 ])await searchIgnavWithCache(query,{cache,search:async()=>invalid,now:()=>now});
 assert.equal(calls.length,0);
});

test('an invalid persisted exact-query result is evicted and refreshed from the provider',async()=>{
 const key=ignavResponseCacheKey(query),entries=new Map([[key,{...result,query:{...result.query,destination:'YYZ'}}]]),deleted=[];let calls=0;
 const cache={getProviderResponse:key=>entries.get(key)??null,deleteProviderResponse:key=>{deleted.push(key);return entries.delete(key);},setProviderResponse:(key,value)=>entries.set(key,value)};
 const refreshed=await searchIgnavWithCache(query,{cache,search:async()=>{calls++;return structuredClone(result);},now:()=>now});
 assert.equal(calls,1);assert.deepEqual(deleted,[key]);assert.equal(refreshed.offers.length,1);
});
