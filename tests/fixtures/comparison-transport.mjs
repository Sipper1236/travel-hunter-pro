// Explicit test-only preload. Every request is intercepted; unexpected hosts fail closed.
import {setTimeout as delay} from 'node:timers/promises';
const leg=(from,to,n,depart,arrive)=>({marketing_carrier_code:'AC',flight_number:n,departure_airport:from,arrival_airport:to,departure_time_utc:depart,arrival_time_utc:arrive,departure_time_local:depart.slice(0,19),arrival_time_local:arrive.slice(0,19),departure_timezone:'Etc/UTC',arrival_timezone:'Etc/UTC'});
const legs=[leg('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z'),leg('YUL','BCN','200','2099-04-15T13:00:00Z','2099-04-15T21:00:00Z')];
globalThis.fetch=async(url,init)=>{
  if(url!=='https://ignav.com/api/fares/one-way')throw Error('Unexpected test transport URL.');
  if(process.env.COMPARISON_TEST_REFUSAL==='1')return new Response(null,{status:429,headers:{'Retry-After':'60'}});
  const q=JSON.parse(init.body),whole=q.origin==='YHZ'&&q.destination==='BCN';
  if(!whole)await delay(400,undefined,{signal:init.signal});
  const segments=whole?legs:[q.origin==='YHZ'?legs[0]:legs[1]];
  const amount=whole?600:q.origin==='YHZ'?100:250;
  return Response.json({origin:q.origin,destination:q.destination,departure_date:q.departure_date,observed_at:new Date().toISOString(),itineraries:[{ignav_id:'test_fare_123',price:{amount,currency:'CAD',status:'verified'},cabin_class:q.cabin_class,outbound:{segments,duration_minutes:whole?780:q.origin==='YHZ'?60:480}}]});
};
