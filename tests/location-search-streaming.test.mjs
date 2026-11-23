import test from 'node:test';
import assert from 'node:assert/strict';
import {searchLocations} from '../lib/location-search.mjs';
import {flightWorkerResultError} from '../lib/flight-worker-result.mjs';

const input={origin:'Halifax',destination:'Europe',originType:'place',destinationType:'region',date:'2099-04-15',tripType:'one-way',cabin:'economy',source:'all',adults:1,children:0,childrenAges:[],airportLimit:4,filters:{}};
const segment=(from,to)=>({from,to,carrierCode:'AC',flightNumber:'123',departureAt:'2099-04-15T08:00:00Z',arrivalAt:'2099-04-15T16:00:00Z',marketing_carrier_code:'AC',flight_number:'123',departure_airport:from,arrival_airport:to,departure_time_local:'2099-04-15T08:00:00',arrival_time_local:'2099-04-15T16:00:00',departure_time_utc:'2099-04-15T08:00:00Z',arrival_time_utc:'2099-04-15T16:00:00Z'});

test('location-expanded search publishes a validated partial result with exact route and honest coverage',async()=>{
 const updates=[];
 const origin={type:'place',kind:'city',airports:[{code:'YHZ',name:'Halifax Stanfield',country:'Canada'}],method:'fixture resolver'};
 const destination={type:'region',region:{name:'Europe'},airports:[{code:'FRA',name:'Frankfurt',country:'Germany'},{code:'CDG',name:'Paris',country:'France'}],method:'fixture resolver'};
 const search=async(query,{onProviderResult})=>{
  const observedAt=new Date().toISOString(),row=segment(query.origin,query.destination);
  const offer={provider:'Ignav',source:'Ignav live fare API',price:400,currency:'CAD',observedAt,travelers:'1 adult',bookingStatus:'Observed; seller not rechecked',fees:'Inclusions unverified',cabin:'economy',from:query.origin,to:query.destination,departureDate:query.date,arrivalDate:query.date,departureTime:'08:00',arrivalTime:'16:00',durationMinutes:480,airlines:['Air Canada'],via:[],segments:[row],ignavId:'fixture-12345678'};
  const result={query:{origin:query.origin,destination:query.destination,date:query.date,tripType:'one-way',returnDate:null,cabin:'economy',adults:1,children:0,childrenAges:[]},observedAt,offers:[offer],priceObservations:[],sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}],filterCoverage:{},schemaCoverage:{},complete:false,limitations:[],transportCoverage:{providers:{Ignav:{attempts:2,retries:0,responses:2,networkFailures:0,httpStatuses:{'200':2}}}}};
  onProviderResult({sourceId:'ignav',sourceIndex:1,sourceCount:7,result});
  return result;
 };
 const result=await searchLocations(input,{origin:{type:'place',kind:'city'},destination:{type:'region',canonicalName:'Europe'}},{resolvePlace:async()=>origin,resolveRegion:async()=>destination,search,onProgress:update=>updates.push(update)});
 const progress=updates.find(update=>update.flightPreview);
 assert.ok(progress,'a provider result should be published before the route scan completes');
 assert.equal(progress.flightPreview.partial,true);
 assert.equal(progress.flightPreview.query.origin,input.origin);
 assert.equal(progress.flightPreview.query.destination,input.destination);
 assert.equal(progress.flightPreview.offers.length,1);
 assert.equal(progress.flightPreview.offers[0].from,'YHZ');
 assert.equal(progress.flightPreview.offers[0].to,'FRA');
 assert.equal(progress.flightPreview.coverage.pairsPlanned,2);
 assert.equal(progress.flightPreview.coverage.pairsChecked,1);
 assert.equal(progress.flightPreview.coverage.partial,true);
 assert.equal(progress.flightPreview.streaming.sourceTransportCoverage.ignav.providers.Ignav.attempts,2,'partial previews retain sanitized provider HTTP metrics');
 assert.equal(flightWorkerResultError(progress.flightPreview,input),null);
 assert.equal(result.offers.length,2,'final completed result still contains all searched route offers');
});
