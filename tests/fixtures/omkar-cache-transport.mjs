// Test-only API fixture used by a real flight-job child process; no request reaches Omkar.
import {appendFileSync} from 'node:fs';

globalThis.fetch=async(url)=>{
 const actual=new URL(String(url));
 if(actual.origin!=='https://expedia-scraper.omkar.cloud'||actual.pathname!=='/expedia/flights/one-way')throw Error('Unexpected worker fixture request.');
 appendFileSync(process.env.TRAVEL_OMKAR_TEST_REQUEST_LOG,'request\n');
 const origin=actual.searchParams.get('departure_airport_code'),destination=actual.searchParams.get('arrival_airport_code'),date=actual.searchParams.get('departure_date');
 const segment={origin_code:origin,destination_code:destination,departure_time:`${date}T08:20:00-04:00`,arrival_time:`${date}T11:00:00-04:00`,marketing_airline_code:'EA',flight_number:'EA123'};
 return Response.json({flights:[{offer_id:'fixture-omkar-flight',fare_type:'One way per traveler',stop_count:0,airlines:[{name:'Example Air'}],itineraries:[{segments:[segment]}],fare_options:[{fare_name:'Economy',cabin_class:'coach',currency:'CAD',display_price:'CAD 845.50',price_detail:'CAD 845.50 one way for 1 traveler',booking_url:'https://www.expedia.ca/Flight-Information?offer=fixture'}]}]});
};
