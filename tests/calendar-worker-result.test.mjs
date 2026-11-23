import test from 'node:test';
import assert from 'node:assert/strict';
import {searchFareCalendar} from '../lib/calendar-search.mjs';
import {calendarWorkerResultError} from '../lib/calendar-worker-result.mjs';
import {itineraryKey} from '../lib/ignav.mjs';

async function observedCalendar(){
 const query={origin:'YHZ',destination:'LHR',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'ignav',searchLimit:1};
 const segment={marketing_carrier_code:'AC',flight_number:'123',departure_airport:'YHZ',arrival_airport:'LHR',departure_time_local:'2099-04-15T08:00:00',arrival_time_local:'2099-04-15T16:00:00',departure_time_utc:'2099-04-15T11:00:00Z',arrival_time_utc:'2099-04-15T15:00:00Z',departure_timezone:'America/Halifax',arrival_timezone:'Europe/London'};
 return searchFareCalendar(query,{searcher:async q=>({sources:[{provider:'Ignav',status:'ok',received:1,accepted:1,rejected:0}],offers:[{provider:'Ignav',source:'Ignav live fare API',price:500,currency:'CAD',observedAt:new Date().toISOString(),travelers:'1 adult',bookingStatus:'Observed; seller not rechecked',fees:'Inclusions unverified',cabin:'economy',from:q.origin,to:q.destination,departureDate:q.date,arrivalDate:q.date,departureTime:'08:00',arrivalTime:'16:00',durationMinutes:480,airlines:['AC'],via:[],ignavId:'fare_12345678',itineraryKey:itineraryKey({outbound:{segments:[segment]}}),segments:[segment]}]})});
}

test('a complete calendar worker result has an exact date grid and internally matching observed prices',async()=>{
 const result=await observedCalendar();
 assert.equal(calendarWorkerResultError(result),null);
});

test('calendar worker result rejects a displayed amount that differs from its exact observed offer',async()=>{
 const result=structuredClone(await observedCalendar());result.dates[0].price++;
 assert.ok(calendarWorkerResultError(result));
});

test('calendar worker result rejects a quote whose segments no longer match its selected route',async()=>{
 const result=structuredClone(await observedCalendar());result.dates[0].offer.segments[0].arrival_airport='CDG';
 assert.ok(calendarWorkerResultError(result));
});

test('calendar worker result rejects missing coverage accounting or an incomplete date grid',async()=>{
 const withoutCoverage=structuredClone(await observedCalendar());delete withoutCoverage.coverage.pairQueriesChecked;
 assert.ok(calendarWorkerResultError(withoutCoverage));
 const withoutDate=structuredClone(await observedCalendar());withoutDate.dates.length=0;
 assert.ok(calendarWorkerResultError(withoutDate));
});

test('calendar worker accepts a strictly scoped price-only Google date value but rejects it as a fare quote when mislabeled',async()=>{
 const observedAt=new Date().toISOString();
 const sourceUrl='https://www.google.com/travel/flights?'+new URLSearchParams({q:'Flights from YHZ to LHR on 2099-04-15 one way',hl:'en-CA',gl:'CA',curr:'CAD'});
 const result=await searchFareCalendar({origin:'YHZ',destination:'LHR',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{},source:'google',searchLimit:1},{providerOptions:{searchGoogleCalendar:async()=>({provider:'Google Flights',status:'ok',observedAt,priceObservations:[{provider:'Google Flights',source:'Google Flights price calendar RPC',from:'YHZ',to:'LHR',date:'2099-04-15',calendarStart:'2099-04-15',calendarEnd:'2099-04-15',tripType:'one-way',price:701,currency:'CAD',observedAt,sourceUrl,priceScope:'one-way one adult economy; itinerary details not returned',itineraryVerified:false,bookingStatus:'Price-only calendar observation; no itinerary, seller availability, baggage or final charges verified.'}],noPriceDates:[],coverage:{datesReturned:1,endpointResponses:1},limitations:['Price only; no itinerary returned.']})}});
 assert.equal(calendarWorkerResultError(result),null);
 const mislabeled=structuredClone(result);mislabeled.dates[0].priceObservations[0].priceScope='verified itinerary fare';
 assert.match(calendarWorkerResultError(mislabeled),/price-only limits/);
});
