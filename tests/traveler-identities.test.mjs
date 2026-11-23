import test from 'node:test';
import assert from 'node:assert/strict';
import {ageOnDate, guardianCandidates, validateTravelerIdentities,validateIgnavRoundTripAge,expediaParty,matrixParty,googleRoundTripParty} from '../lib/travelers.mjs';
import {searchExpedia} from '../lib/expedia.mjs';
import {searchIgnav} from '../lib/ignav.mjs';
import {searchSkyscanner} from '../lib/skyscanner.mjs';
import {searchAirCanada} from '../lib/air-canada.mjs';
import {validateQuery} from '../lib/search.mjs';
import {searchProviders} from '../lib/providers.mjs';

test('age-only long round trips cannot assume younger children remain under twelve',async()=>{
 const query={tripType:'round-trip',date:'2099-04-15',returnDate:'2101-04-15',childrenAges:[10]};
 assert.throws(()=>validateIgnavRoundTripAge(query),/date of birth/);
 assert.doesNotThrow(()=>validateIgnavRoundTripAge({...query,returnDate:'2099-04-25'}));
 assert.doesNotThrow(()=>validateIgnavRoundTripAge({...query,childrenAges:[12]}));
 let requests=0;
 await assert.rejects(searchIgnav({...query,origin:'YHZ',destination:'BCN',adults:1,children:1},{apiKey:'test',fetcher:async()=>{requests++;throw Error('unexpected network call');}}),/date of birth/);
 assert.equal(requests,0);
});

test('age-only supplier checks reject only trips long enough to possibly cross the adult-fare boundary',()=>{
 const date='2099-01-01',plusDays=days=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
 const query={tripType:'round-trip',date,adults:1,children:1,childrenAges:[10],cabin:'economy'};
 assert.doesNotThrow(()=>validateIgnavRoundTripAge({...query,returnDate:plusDays(365)}));
 assert.throws(()=>validateIgnavRoundTripAge({...query,returnDate:plusDays(366)}),/date of birth/);
 assert.doesNotThrow(()=>expediaParty({...query,returnDate:plusDays(365)}));
 assert.throws(()=>expediaParty({...query,returnDate:plusDays(366)}),/cross its adult-fare boundary/);
 assert.deepEqual(matrixParty({...query,returnDate:plusDays(365)}),{adults:1,children:1});
 assert.throws(()=>matrixParty({...query,returnDate:plusDays(366)}),/birth dates/);
 assert.deepEqual(googleRoundTripParty({...query,returnDate:plusDays(365)}),{adults:1,children:1,total:2});
 assert.throws(()=>googleRoundTripParty({...query,returnDate:plusDays(366)}),/birth dates/);
 assert.throws(()=>validateIgnavRoundTripAge({...query,childrenAges:[11],returnDate:plusDays(1)}),/date of birth/);
 assert.throws(()=>matrixParty({...query,childrenAges:[11],returnDate:plusDays(1)}),/birth dates/);
 assert.throws(()=>matrixParty({...query,childrenAges:[17],returnDate:plusDays(1)}),/birth dates/);
});

test('calculates actual age on each travel date and refuses ambiguous leap-day rules', () => {
 assert.equal(ageOnDate('2025-04-16','2027-04-15'), 1);
 assert.equal(ageOnDate('2025-04-16','2027-04-16'), 2);
 assert.throws(() => ageOnDate('2024-02-29','2027-02-28'), /carrier verification/);
 assert.throws(() => ageOnDate('2024-02-29','2027-03-01'), /carrier verification/);
 assert.equal(ageOnDate('2024-02-29','2027-03-02'), 3);
 assert.throws(() => ageOnDate('2025-02-29','2027-04-15'), /valid birth date/);
});

test('guardian picker candidates must be known adults on every trip date',()=>{
 const travelers=[
  {id:'parent',birthDate:'1980-01-01'},
  {id:'turns-18',birthDate:'2008-04-16'},
  {id:'minor',birthDate:'2010-01-01'},
  {id:'unknown',birthDate:''},
 ];
 assert.deepEqual(guardianCandidates(travelers,'minor',['2026-04-15']).map(person=>person.id),['parent']);
 assert.deepEqual(guardianCandidates(travelers,'minor',['2026-04-17']).map(person=>person.id),['parent','turns-18']);
 assert.deepEqual(guardianCandidates(travelers,'minor',['2026-04-15','2026-04-17']).map(person=>person.id),['parent']);
 assert.deepEqual(guardianCandidates(travelers,'parent',['2026-04-17']).map(person=>person.id),['turns-18']);
});

test('guardian picker excludes a guardian already assigned a lap infant on overlapping dates',()=>{
 const travelers=[
  {id:'adult',birthDate:'1980-01-01'},
  {id:'otherAdult',birthDate:'1981-01-01'},
  {id:'lapOne',birthDate:'2025-01-01',guardianId:'adult',infantSeating:'lap'},
  {id:'lapTwo',birthDate:'2025-02-01',infantSeating:'lap'},
 ];
 assert.deepEqual(guardianCandidates(travelers,'lapTwo',['2026-04-15']).map(person=>person.id),['otherAdult']);
 assert.deepEqual(guardianCandidates(travelers,'lapTwo',['2027-01-01']).map(person=>person.id),['adult','otherAdult']);
 assert.deepEqual(guardianCandidates(travelers,'lapTwo',['2026-04-15','2027-01-01']).map(person=>person.id),['otherAdult']);
});

test('unsupported infant or identity fields never result in an adult-only supplier search', async () => {
 const input={origin:'YHZ',destination:'YUL',date:'2099-04-15',adults:1,children:0,childrenAges:[],tripType:'one-way',cabin:'economy',infantsOnLap:1};
 const options={apiKey:'test',authorization:'test',fetcher:()=>{throw Error('unexpected supplier request');}};
 for (const search of [searchExpedia,searchIgnav,searchSkyscanner,searchAirCanada,searchProviders]) await assert.rejects(search(input,options), /not yet supported/);
 assert.throws(()=>validateQuery(input),/not yet supported/);
 await assert.rejects(searchProviders({...input,infantsOnLap:0,travelers:[{id:'baby'}]},options),/either identified travelers or passenger counts/);
});

test('aggregator preserves identified party, sends Matrix only validated infant categories, and skips unsupported suppliers', async () => {
 const input={origin:'YHZ',destination:'YUL',date:'2099-04-15',tripType:'one-way',cabin:'economy',source:'all',travelers:[{id:'parent',birthDate:'2070-01-01'},{id:'baby',birthDate:'2098-05-01',guardianId:'parent',infantSeating:'lap'}]};
 let seen,matrixSeen;
 const unexpected=()=>{throw Error('unsupported source was called');};
 const result=await searchProviders(input,{searchIgnav:async query=>{seen=query;return {offers:[],sources:[{provider:'Ignav',status:'ok'}]};},searchMatrix:async query=>{matrixSeen=query;return {offers:[],sources:[{provider:'ITA Matrix',status:'ok'}]};},searchGoogle:unexpected,searchExpedia:unexpected,searchSkyscanner:unexpected,searchAirCanada:unexpected});
 assert.deepEqual(seen.travelers,input.travelers);assert.deepEqual(result.query.travelers,input.travelers);
 assert.deepEqual(matrixSeen.passengers,{adults:1,infantsInLap:1});
 assert.equal(result.sources.filter(source=>source.status==='unsupported_party').length,5);
});

test('requires explicit guardian and infant seating and checks each travel date', () => {
 const adult={id:'adult',birthDate:'1990-01-01'};
 const infant={id:'infant',birthDate:'2025-04-16',guardianId:'adult',infantSeating:'lap'};
 const people=validateTravelerIdentities([adult,infant],['2027-04-15','2027-04-16']);
 assert.deepEqual(people[1].ages,[1,2]);
 assert.throws(() => validateTravelerIdentities([adult,{...infant,guardianId:'missing'}],['2027-04-15']), /guardian/);
 assert.throws(() => validateTravelerIdentities([adult,{...infant,infantSeating:undefined}],['2027-04-15']), /lap or seat/);
 assert.throws(() => validateTravelerIdentities([adult,infant,{...infant,id:'other'}],['2027-04-15']), /more than one lap infant/);
 assert.throws(() => validateTravelerIdentities([adult,adult],['2027-04-15']), /unique/);
 assert.throws(() => validateTravelerIdentities([{...adult,infantSeating:'lap'}],['2027-04-15']), /Remove infant seating/);
 assert.throws(() => validateTravelerIdentities([adult,{id:'child',birthDate:'2018-01-01',guardianId:'adult',infantSeating:'seat'}],['2027-04-15']), /Remove infant seating/);
});

test('Ignav sends explicit infant seating and rejects category changes without requesting fares', async () => {
 const input={origin:'YHZ',destination:'YUL',date:'2099-04-15',tripType:'one-way',cabin:'economy',travelers:[{id:'parent',birthDate:'2070-01-01'},{id:'baby',birthDate:'2098-05-01',guardianId:'parent',infantSeating:'seat'}]};
 let body;
 const options={apiKey:'test',fetcher:async (_url,init)=>{body=JSON.parse(init.body);return Response.json({itineraries:[]});}};
 await searchIgnav(input,options);
 assert.equal(body.adults,1);assert.equal(body.children,0);assert.equal(body.infants_in_seat,1);assert.equal(body.infants_on_lap,0);
 body=null;
 await assert.rejects(searchIgnav({...input,tripType:'round-trip',returnDate:'2100-05-02'},options),/changes Ignav fare category/);
 assert.equal(body,null);
});

test('ambiguous leap-day age fails closed before Ignav receives a fare request', async () => {
 let calls=0;
 const input={origin:'YHZ',destination:'YUL',date:'2027-03-01',tripType:'one-way',cabin:'economy',travelers:[
  {id:'adult',birthDate:'1980-01-01'},
  {id:'child',birthDate:'2024-02-29',guardianId:'adult'},
 ]};
 await assert.rejects(searchIgnav(input,{apiKey:'test',fetcher:async()=>{calls++;return Response.json({itineraries:[]});}}),/carrier verification/);
 assert.equal(calls,0);
});
test('unsupported passenger aliases never produce a smaller-party supplier query',async()=>{
 const query={origin:'YHZ',destination:'BCN',date:'2099-04-15',adults:1,children:0,source:'ita-matrix'};
 for(const field of ['infantsInLap','youths','seniors','passengers']){
  let called=false;await assert.rejects(searchProviders({...query,[field]:field==='passengers'?{adults:2}:1},{searchMatrix:async()=>{called=true;return {offers:[],sources:[]};}}),/not yet supported/);assert.equal(called,false);
 }
});
