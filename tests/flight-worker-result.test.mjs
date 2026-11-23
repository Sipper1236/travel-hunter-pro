import test from 'node:test';
import assert from 'node:assert/strict';
import {flightWorkerResultError} from '../lib/flight-worker-result.mjs';

const input={origin:'YHZ',destination:'LHR',originType:'place',destinationType:'place',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],filters:{}};
const offer=(overrides={})=>({provider:'Ignav',source:'Ignav live fare API',price:500,currency:'CAD',observedAt:new Date().toISOString(),travelers:'1 adult',bookingStatus:'Fare observed; seller not rechecked',fees:'Inclusions unverified',cabin:'economy',from:'YHZ',to:'LHR',departureDate:'2099-04-15',departureTime:'08:00',arrivalDate:'2099-04-15',arrivalTime:'16:00',durationMinutes:480,airlines:['AC'],via:[],segments:[{marketing_carrier_code:'AC',flight_number:'123',departure_airport:'YHZ',arrival_airport:'LHR',departure_time_local:'2099-04-15T08:00:00',arrival_time_local:'2099-04-15T16:00:00'}],...overrides});
const result=(overrides={})=>({query:{origin:'YHZ',destination:'LHR',date:'2099-04-15',tripType:'one-way',returnDate:null,cabin:'economy',adults:1,children:0,childrenAges:[]},observedAt:new Date().toISOString(),offers:[offer()],priceObservations:[],sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}],complete:false,...overrides});

test('a valid exact flight worker result retains its validated CAD itinerary',()=>{
 assert.equal(flightWorkerResultError(result(),input),null);
});

test('flight worker result rejects a mismatched itinerary and a changed submitted query',()=>{
 assert.ok(flightWorkerResultError(result({offers:[offer({from:'YUL'})]}),input));
 assert.ok(flightWorkerResultError(result({query:{...result().query,destination:'CDG'}}),input));
});

test('flight worker result rejects missing schemas, invalid source status, and stale fares',()=>{
 assert.ok(flightWorkerResultError(result({sources:null}),input));
 assert.ok(flightWorkerResultError(result({sources:[{provider:'Ignav'}]}),input));
 assert.ok(flightWorkerResultError(result({offers:[offer({observedAt:'2020-01-01T00:00:00Z'})]}),input));
});

test('flight worker result rejects unknown top-level claims but keeps documented adapter metadata',()=>{
 assert.match(flightWorkerResultError(result({booked:true}),input),/unknown|unsupported.*field/i);
 assert.match(flightWorkerResultError(result({sellerVerified:true}),input),/unknown|unsupported.*field/i);
 assert.equal(flightWorkerResultError(result({searchUrl:'https://matrix.itasoftware.com/flights',limitations:['Price observation only.']}),input),null);
});

test('flight worker rejects offset-aware connecting segments whose departure precedes the prior arrival',()=>{
 const segments=[
  {marketing_carrier_code:'AC',flight_number:'123',departure_airport:'YHZ',arrival_airport:'YUL',departure_time_local:'2099-04-15T08:00:00-03:00',departure_time_utc:'2099-04-15T11:00:00Z',arrival_time_local:'2099-04-15T10:00:00-04:00',arrival_time_utc:'2099-04-15T14:00:00Z'},
  {marketing_carrier_code:'AC',flight_number:'456',departure_airport:'YUL',arrival_airport:'LHR',departure_time_local:'2099-04-15T11:00:00-04:00',departure_time_utc:'2099-04-15T15:00:00Z',arrival_time_local:'2099-04-15T18:00:00+01:00',arrival_time_utc:'2099-04-15T17:00:00Z'},
 ];
 const valid=result({offers:[offer({departureTime:'08:00',arrivalTime:'18:00',durationMinutes:360,via:['YUL'],segments})]});
 assert.equal(flightWorkerResultError(valid,input),null);
 const impossible=structuredClone(valid);impossible.offers[0].segments[1].departure_time_local='2099-04-15T09:00:00-04:00';impossible.offers[0].segments[1].departure_time_utc='2099-04-15T13:00:00Z';
 assert.match(flightWorkerResultError(impossible,input),/segment|chronology/i);
 const conflicting=structuredClone(valid);conflicting.offers[0].segments[1].departure_time_local='2099-04-15T11:00:00-03:00';
 assert.match(flightWorkerResultError(conflicting,input),/segment|chronology/i);
 const unknownOffset=structuredClone(valid);unknownOffset.offers[0].segments[1].departure_time_local='2099-04-15T11:00:00-00:00';
 assert.match(flightWorkerResultError(unknownOffset,input),/segment|chronology/i);
 const missingChronology=structuredClone(valid);delete missingChronology.offers[0].segments[1].departure_time_local;delete missingChronology.offers[0].segments[1].departure_time_utc;
 assert.match(flightWorkerResultError(missingChronology,input),/segment|chronology/i);
});

test('flight worker rejects round trips whose inbound leg departs before the outbound arrival',()=>{
 const outbound=offer({departureTime:'08:00',arrivalTime:'18:00',durationMinutes:360,segments:[
  {marketing_carrier_code:'AC',flight_number:'123',departure_airport:'YHZ',arrival_airport:'LHR',departure_time_local:'2099-04-15T08:00:00-03:00',departure_time_utc:'2099-04-15T11:00:00Z',arrival_time_local:'2099-04-15T18:00:00+01:00',arrival_time_utc:'2099-04-15T17:00:00Z'},
 ]});
 outbound.inbound={from:'LHR',to:'YHZ',departureDate:'2099-04-15',departureTime:'15:00',arrivalDate:'2099-04-15',arrivalTime:'17:00',durationMinutes:360,via:[],segments:[
  {marketing_carrier_code:'AC',flight_number:'124',departure_airport:'LHR',arrival_airport:'YHZ',departure_time_local:'2099-04-15T15:00:00+01:00',departure_time_utc:'2099-04-15T14:00:00Z',arrival_time_local:'2099-04-15T17:00:00-03:00',arrival_time_utc:'2099-04-15T20:00:00Z'},
 ]};
 const submitted={...input,tripType:'round-trip',returnDate:'2099-04-15'},returned={...result().query,tripType:'round-trip',returnDate:'2099-04-15'};
 assert.ok(flightWorkerResultError(result({query:returned,offers:[outbound]}),submitted));
});

test('flight worker query preserves exact count-party ages and every submitted filter',()=>{
 const submitted={...input,adults:2,children:2,childrenAges:[7,15],filters:{maxPrice:900,maxDurationMinutes:840,airlinesInclude:['AC'],countriesExclude:['US']}};
 const exactQuery={...result().query,adults:2,children:2,childrenAges:[7,15],filters:submitted.filters};
 const empty={query:exactQuery,observedAt:new Date().toISOString(),offers:[],priceObservations:[],sources:[],complete:false};
 assert.equal(flightWorkerResultError(empty,submitted),null);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,childrenAges:[8,15]}},submitted),/exact child ages/);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,childrenAges:undefined}},submitted),/exact child ages/);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,filters:{...submitted.filters,maxPrice:901}}},submitted),/flight filters/);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,filters:{...submitted.filters,airlinesInclude:['DL']}}},submitted),/flight filters/);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,filters:{...submitted.filters,unrecognized:true}}},submitted),/unsupported flight filters/);
});

test('flight worker query accepts omitted count defaults only when their meaning is unchanged',()=>{
 const submitted={...input},query={...result().query};
 for(const key of ['adults','children','childrenAges']){delete submitted[key];delete query[key];}
 const empty={query,observedAt:new Date().toISOString(),offers:[],priceObservations:[],sources:[],complete:false};
 assert.equal(flightWorkerResultError(empty,submitted),null);
 assert.match(flightWorkerResultError({...empty,query:{...query,childrenAges:[8]}},submitted),/exact child ages/);
});

test('flight worker query preserves identified DOBs, guardian assignments, and infant seating',()=>{
 const travelers=[
  {id:'guardian',birthDate:'1980-01-01'},
  {id:'minor',birthDate:'2016-04-16',guardianId:'guardian'},
  {id:'infant',birthDate:'2098-10-20',guardianId:'guardian',infantSeating:'seat'},
 ];
 const submitted={origin:'YHZ',destination:'LHR',date:'2099-04-15',tripType:'one-way',cabin:'economy',travelers,filters:{}};
 const exactQuery={origin:'YHZ',destination:'LHR',date:'2099-04-15',tripType:'one-way',returnDate:null,cabin:'economy',travelers,filters:{}};
 const empty={query:exactQuery,observedAt:new Date().toISOString(),offers:[],priceObservations:[],sources:[],complete:false};
 assert.equal(flightWorkerResultError(empty,submitted),null);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,travelers:travelers.map(person=>person.id==='minor'?{...person,birthDate:'2016-04-17'}:person)}},submitted),/birth dates/);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,travelers:travelers.map(person=>person.id==='minor'?{...person,guardianId:'missing'}:person)}},submitted),/guardians/);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,travelers:travelers.map(person=>person.id==='infant'?{...person,infantSeating:'lap'}:person)}},submitted),/infant seating/);
 assert.match(flightWorkerResultError({...empty,query:{...exactQuery,travelers:travelers.slice(0,2)}},submitted),/traveler identities/);
});

test('each priced offer requires a matching successful provider row with accepted coverage',()=>{
 assert.match(flightWorkerResultError(result({sources:[]}),input),/no matching successful source status/);
 assert.match(flightWorkerResultError(result({sources:[{provider:'Google Flights',status:'ok',received:1,accepted:1}]}),input),/no matching successful source status/);
 assert.match(flightWorkerResultError(result({sources:[{provider:'Ignav',status:'blocked',received:1,accepted:1}]}),input),/no matching successful source status/);
 assert.match(flightWorkerResultError(result({sources:[{provider:'Ignav',status:'ok',received:1,accepted:0}]}),input),/no matching successful source status/);
 assert.match(flightWorkerResultError(result({sources:[{provider:'Ignav',status:'ok',received:1,accepted:2}]}),input),/invalid accepted count/);
});

test('region-expanded flights must belong to a route recorded in exact pair coverage',()=>{
 const regional={...input,origin:'Atlantic Canada',destination:'Europe',originType:'region',destinationType:'region',originAirports:['YHZ'],destinationAirports:['LHR']};
 const expanded=result({query:{...result().query,origin:'Atlantic Canada',destination:'Europe'},coverage:{side:'both',pairsChecked:1,pairsPlanned:1,origin:{airports:[{code:'YHZ'}]},destination:{airports:[{code:'LHR'}]},checked:[{origin:{code:'YHZ'},destination:{code:'LHR'},sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}],complete:false,offers:1} ]}});
 assert.equal(flightWorkerResultError(expanded,regional),null);
 const noRouteSource={...expanded,coverage:{...expanded.coverage,checked:[{...expanded.coverage.checked[0],sources:[]}]},sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}]};
 assert.match(flightWorkerResultError(noRouteSource,regional),/no matching successful source status/);
 assert.ok(flightWorkerResultError({...expanded,offers:[offer({from:'YYZ'})]},regional));
 assert.ok(flightWorkerResultError({...expanded,coverage:{...expanded.coverage,checked:[{...expanded.coverage.checked[0],origin:{code:'YYZ'}}]}},regional));
});

test('unverified Matrix group prices remain price observations and never become flight offers',()=>{
 const observation={id:'matrix-1',provider:'ITA Matrix',origin:'YHZ',destination:'LHR',departureDate:'2099-04-15',price:600,currency:'CAD',priceScope:'Matrix-reported group total',travelers:'1 adult',cabin:'economy',observedAt:new Date().toISOString(),sourceUrl:'https://matrix.itasoftware.com/search',linkLabel:'Open Matrix search',itineraryVerified:false,details:'Full flight details unavailable.'};
 const value=result({offers:[],priceObservations:[observation],sources:[{provider:'ITA Matrix',status:'ok',received:1,accepted:0,priceObservations:1}]});
 assert.equal(flightWorkerResultError(value,input),null);
 assert.ok(flightWorkerResultError({...value,priceObservations:[{...observation,itineraryVerified:true}]},input));
 assert.match(flightWorkerResultError({...value,sources:[]},input),/no matching successful source status/);
 assert.match(flightWorkerResultError({...value,sources:[{provider:'ITA Matrix',status:'ok',received:1,accepted:0,priceObservations:0}]},input),/no matching successful source status/);
});
