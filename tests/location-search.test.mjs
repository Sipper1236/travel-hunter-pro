import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCity} from '../lib/city-resolution.mjs';
import {resolvePlace} from '../lib/place-resolution.mjs';
import {searchLocations} from '../lib/location-search.mjs';

test('airport codes need no lookup and exact names retain live provenance',async()=>{
 const noLookup=()=>{throw Error('unexpected network');};
 assert.equal((await resolvePlace('YHZ',noLookup)).airports[0].code,'YHZ');
 const result=await resolvePlace('Montréal Airport',async()=>({items:[{code:'YUL',name:'Montréal Airport',city:'Dorval',country:'CA'}],source:'Ignav'}),noLookup);
 assert.equal(result.airports[0].code,'YUL');assert.equal(result.kind,'airport');
});
test('fuzzy airport results cannot silently choose a city airport',async()=>{
 let used=false;
 const result=await resolvePlace('London',async()=>({items:[{code:'YXU',name:'London Airport',city:'London',country:'CA'}]}),async name=>{used=true;return {city:name};});
 assert.equal(used,true);assert.equal(result.city,'London');
});
test('city search uses unique city identity and served-place airport claims',async()=>{
 const calls=[];
 const scope=await resolveCity('Example',async url=>{calls.push(String(url));return Response.json(calls.length===1?{search:[{id:'Q123',label:'Example',description:'city in Canada'}]}:calls.length===2?{results:{bindings:[{city:{value:'https://www.wikidata.org/entity/Q123'}}]}}:{results:{bindings:[{code:{value:'AAA'},airportLabel:{value:'First Airport'},countryLabel:{value:'Canada'}}]}});});
 assert.equal(scope.airports[0].code,'AAA');assert.match(decodeURIComponent(calls[2]),/P931/);assert.equal(scope.cityId,'Q123');
});
test('same-named cities remain ambiguous even inside one country',async()=>{
 let calls=0;await assert.rejects(resolveCity('Example',async()=>Response.json(++calls===1?{search:[{id:'Q123',label:'Example',description:'city in Canada'},{id:'Q456',label:'Example',description:'city in Canada'}]}:{results:{bindings:[{city:{value:'https://www.wikidata.org/entity/Q123'}},{city:{value:'https://www.wikidata.org/entity/Q456'}}]}})),/multiple cities/);
});
test('multiple city airports expand to exact routes and skip identical endpoints',async()=>{
 const calls=[];
 const input={origin:'Example',destination:'AAA',date:'2099-04-15',adults:1,children:0,airportLimit:4};
 const result=await searchLocations(input,{origin:{type:'place'},destination:{type:'place'}},{resolvePlace:async name=>({kind:name==='Example'?'city':'airport',region:{name},airports:name==='Example'?[{code:'AAA'},{code:'BBB'}]:[{code:'AAA'}],method:'test'}),search:async query=>{calls.push(query);return {offers:[],sources:[],complete:false};}});
 assert.equal(calls.length,1);assert.equal(calls[0].origin,'BBB');assert.equal(calls[0].destination,'AAA');assert.equal(result.coverage.pairsPlanned,1);assert.equal(result.requestedLocations.origin,'Example');
});

test('regional airport-pair fanout suppresses Matrix detail expansion for each pair',async()=>{
 const calls=[];
 const input={origin:'North America',destination:'Europe',originType:'region',destinationType:'region',date:'2099-04-15',adults:1,children:0,airportLimit:4,matrixOptions:{maxExtraLegsRelativeToMinimum:2,allowAirportChanges:false,expandDetailedItineraries:true}};
 await searchLocations(input,{origin:{type:'region'},destination:{type:'region'}},{resolveRegion:async name=>({airports:name==='North America'?[{code:'YYZ'},{code:'YTZ'}]:[{code:'FRA'},{code:'CDG'}],method:'test'}),search:async query=>{calls.push(query);return {offers:[],sources:[],complete:false};}});
 assert.equal(calls.length,4);
 assert.ok(calls.every(query=>query.matrixOptions.expandDetailedItineraries===false));
});

test('verified city choices are returned and a selected identity controls airport resolution',async()=>{
 const entities={search:[{id:'Q123',label:'Example',description:'city in Canada'},{id:'Q456',label:'Example',description:'city in France'}]};
 const identities={results:{bindings:[{city:{value:'https://www.wikidata.org/entity/Q123'}},{city:{value:'https://www.wikidata.org/entity/Q456'}}]}};
 let calls=[];
 const fetcher=async url=>{calls.push(String(url));return Response.json(calls.length===1?entities:calls.length===2?identities:{results:{bindings:[{code:{value:'AAA'},airportLabel:{value:'Selected Airport'},countryLabel:{value:'France'}}]}});};
 await assert.rejects(resolveCity('Example',fetcher),error=>{assert.deepEqual(error.cityChoices.map(city=>city.id),['Q123','Q456']);return true;});
 calls=[];const scope=await resolveCity('Example',fetcher,'Q456');
 assert.equal(scope.cityId,'Q456');assert.match(new URL(calls[2]).searchParams.get('query'),/P931 wd:Q456/);
 calls=[];await assert.rejects(resolveCity('Example',fetcher,'Q999'),/no longer matches/);assert.equal(calls.length,2);
});

test('ambiguous choices retain the route side and stop before fare searches',async()=>{
 let calls=0;
 await assert.rejects(searchLocations({origin:'YHZ',destination:'Example'},{origin:{type:'place'},destination:{type:'place'}},{resolvePlace:async name=>{if(name==='Example'){const error=Error('choose');error.cityChoices=[{id:'Q123'}];throw error;}return {airports:[{code:'YHZ'}]};},search:async()=>{calls++;}}),error=>{assert.equal(error.locationSide,'destination');assert.equal(error.locationValue,'Example');return true;});
 assert.equal(calls,0);
});

test('interrupted pair scan resumes from its saved scope and fresh completed pair',async()=>{
 const query={origin:'Example',destination:'CCC',date:'2099-04-15',airportLimit:4,adults:1,children:0};
 const detections={origin:{type:'place'},destination:{type:'place'}};
 const resolvePlace=async name=>({region:{name},kind:'city',airports:name==='Example'?[{code:'AAA'},{code:'BBB'}]:[{code:'CCC'}],method:'test'});
 let saved,calls=[];
 const search=async input=>{calls.push(input.origin);return {offers:[{price:100,currency:'CAD',observedAt:new Date().toISOString()}],sources:[],complete:false};};
 await assert.rejects(searchLocations(query,detections,{resolvePlace,search,onCheckpoint:async state=>{saved=structuredClone(state);if(Object.keys(state.pairs).length===1)throw Error('interruption');}}),/interruption/);
 assert.deepEqual(calls,['AAA']);calls=[];
 const result=await searchLocations(query,detections,{checkpoint:saved,resolvePlace:()=>{throw Error('must preserve resolved scope');},search});
 assert.deepEqual(calls,['BBB']);assert.equal(result.offers.length,2);assert.equal(result.checkpointCoverage.reusedPairs,1);
 saved.pairs['AAA:CCC'].savedAt=Date.now()-16*60000;calls=[];
 await searchLocations(query,detections,{checkpoint:saved,resolvePlace,search});assert.deepEqual(calls,['AAA']);
});

test('hotel city identity includes municipalities and does not require an airport relationship',async()=>{
 const calls=[];const scope=await resolveCity('Example',async url=>{calls.push(String(url));return Response.json(calls.length===1?{search:[{id:'Q123',label:'Example',description:'commune in France'}]}:{results:{bindings:[{city:{value:'https://www.wikidata.org/entity/Q123'},countryLabel:{value:'France'},iso:{value:'FR'},coordinates:{value:'Point(6.5 43.5)'}}]}});},undefined,{includeAirports:false});
 assert.equal(calls.length,2);assert.deepEqual(scope.airports,[]);assert.equal(scope.countryCode,'FR');assert.deepEqual(scope.coordinates,{latitude:43.5,longitude:6.5});
});
