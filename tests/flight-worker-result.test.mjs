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
