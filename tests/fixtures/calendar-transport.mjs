// Test-only Node preload; production code never imports it and no request reaches the network.
import {setTimeout as delay} from 'node:timers/promises';
const leg=(from,to,day,n)=>({marketing_carrier_code:'AC',flight_number:n,departure_airport:from,arrival_airport:to,departure_time_utc:`${day}T08:00:00Z`,arrival_time_utc:`${day}T16:00:00Z`,departure_time_local:`${day}T08:00:00`,arrival_time_local:`${day}T16:00:00`,departure_timezone:'Etc/UTC',arrival_timezone:'Etc/UTC'});
globalThis.fetch=async(url,init)=>{
 if(url==='https://ignav.com/api/fares/cheapest-dates'){
  const q=JSON.parse(init.body),start=q.departure_date_range.start,end=q.departure_date_range.end,dates=[];
  for(let day=start;day<=end;day=new Date(Date.parse(`${day}T00:00:00Z`)+86400000).toISOString().slice(0,10))dates.push({departure_date:day,...(Number.isInteger(q.stay_days)?{return_date:new Date(Date.parse(`${day}T00:00:00Z`)+q.stay_days*86400000).toISOString().slice(0,10)}:{}),price:{amount:500,currency:'CAD',status:'unverified'}});
  return Response.json({origin:q.origin,destination:q.destination,observed_at:new Date().toISOString(),dates});
 }
 if(!['https://ignav.com/api/fares/one-way','https://ignav.com/api/fares/round-trip'].includes(url))throw Error('Unexpected calendar test URL.');
 const q=JSON.parse(init.body);if(process.env.CALENDAR_TEST_REFUSAL==='1'&&q.departure_date==='2099-04-16')return new Response(null,{status:429,headers:{'Retry-After':'60'}});
 if(q.departure_date==='2099-04-16')await delay(400,undefined,{signal:init.signal});
 const itinerary={price:{amount:500,currency:'CAD',status:'verified'},cabin_class:q.cabin_class,ignav_id:'test_fare_123',outbound:{duration_minutes:480,segments:[leg(q.origin,q.destination,q.departure_date,'100')]},...(q.return_date?{inbound:{duration_minutes:480,segments:[leg(q.destination,q.origin,q.return_date,'200')]}}:{})};
 return Response.json({origin:q.origin,destination:q.destination,departure_date:q.departure_date,...(q.return_date?{return_date:q.return_date}:{}),observed_at:new Date().toISOString(),itineraries:[itinerary]});
};
