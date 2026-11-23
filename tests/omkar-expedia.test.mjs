import test from 'node:test';
import assert from 'node:assert/strict';
import {expediaSearchUrl,searchOmkarExpedia} from '../lib/omkar-expedia.mjs';
import {searchProviders} from '../lib/providers.mjs';

const query={origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',adults:1,children:0,cabin:'economy'};
const payload={flights:[{offer_id:'flight-1',departure_time:'8:20am',arrival_time:'8:32pm',duration_summary:'8:20am - 8:32pm (9h 12m, 1 stop)',fare_type:'One way per traveler',stop_count:1,airlines:[{name:'Example Air'}],itineraries:[{arrives_next_day:false,travel_time:'9h 12m (1 stop)',segments:[
 {origin_code:'YHZ',origin_airport:'Halifax Intl. (YHZ)',departure_time:'8:20am',destination_code:'YYZ',destination_airport:'Toronto Pearson (YYZ)',arrival_time:'10:00am',marketing_airline_code:'EA',flight_number:'EA123'},
 {origin_code:'YYZ',origin_airport:'Toronto Pearson (YYZ)',departure_time:'11:00am',destination_code:'BCN',destination_airport:'Barcelona (BCN)',arrival_time:'8:32pm',marketing_airline_code:'EA',flight_number:'EA456'}]}],fare_options:[{fare_name:'Economy',cabin_class:'coach',currency:'CAD',display_price:'CAD $845.50',price_detail:'CAD 845.50 one way for 1 traveler',inclusions:['Carry-on included'],booking_url:'https://www.expedia.com/Flight-Information?offer=1'}]}]};

test('Omkar adapter keeps fares price-only when segment times lack offset-aware timestamps',async()=>{
 let request;const result=await searchOmkarExpedia(query,{apiKey:'test-key',fetcher:async(url,init)=>{request={url:new URL(url),init};return Response.json(payload);}});
 assert.equal(request.url.origin+request.url.pathname,'https://expedia-scraper.omkar.cloud/expedia/flights/one-way');assert.equal(request.url.searchParams.get('departure_airport_code'),'YHZ');assert.equal(request.url.searchParams.get('arrival_airport_code'),'BCN');assert.equal(request.url.searchParams.get('departure_date'),query.date);assert.equal(request.url.searchParams.get('cabin_class'),'coach');assert.equal(request.init.headers['API-Key'],'test-key');
 assert.equal(result.offers.length,0);assert.equal(result.priceObservations.length,1);assert.equal(result.priceObservations[0].price,845.5);assert.equal(result.priceObservations[0].currency,'CAD');assert.deepEqual(result.sources[0].diagnostics,{flightsReceived:1,routeMismatchFlights:0,flightsWithoutFareOptions:0,fareOptionsExamined:1,unverifiedPrice:0,unverifiedTravelerScope:0,priceOnlyObservations:1,verifiedOffers:0});
});

test('Omkar journey duration is derived from ordered offset-aware segment timestamps including layovers',async()=>{
 const data=structuredClone(payload),segments=data.flights[0].itineraries[0].segments;
 segments[0].departure_time='2099-04-15T08:20:00-03:00';segments[0].arrival_time='2099-04-15T10:00:00-04:00';
 segments[1].departure_time='2099-04-15T11:00:00-04:00';segments[1].arrival_time='2099-04-15T20:32:00+02:00';
 const result=await searchOmkarExpedia(query,{apiKey:'test-key',fetcher:async()=>Response.json(data)});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].durationMinutes,432);assert.equal(result.offers[0].departureDate,query.date);assert.equal(result.offers[0].arrivalDate,'2099-04-15');assert.deepEqual(result.offers[0].via,['YYZ']);assert.equal(result.sources[0].diagnostics.verifiedOffers,1);
 segments[1].departure_time='2099-04-15T09:30:00-04:00';
 const outOfOrder=await searchOmkarExpedia(query,{apiKey:'test-key',fetcher:async()=>Response.json(data)});assert.equal(outOfOrder.offers.length,0);assert.equal(outOfOrder.priceObservations.length,1);
 segments[1].departure_time='2099-04-15T11:00:00';
 const noOffset=await searchOmkarExpedia(query,{apiKey:'test-key',fetcher:async()=>Response.json(data)});assert.equal(noOffset.offers.length,0);assert.equal(noOffset.priceObservations.length,1);
});

test('Omkar prices are shown price-only when arrival date or full itinerary verification is missing',async()=>{
 const data=structuredClone(payload);data.flights[0].itineraries[0].arrives_next_day=null;
 const result=await searchOmkarExpedia(query,{apiKey:'test-key',fetcher:async()=>Response.json(data)});assert.equal(result.offers.length,0);assert.equal(result.priceObservations.length,1);assert.equal(result.priceObservations[0].price,845.5);assert.equal(result.priceObservations[0].priceScope,'One adult · one-way per traveler');
});

test('Omkar rejects ambiguous, signed, malformed and fractional-cent prices',async()=>{
 for(const amount of ['845,50','-$845.50','$1,23','$845.501','$1,,000','EUR 845.50']){
  const data=structuredClone(payload);data.flights[0].fare_options[0].display_price=amount;
  const result=await searchOmkarExpedia(query,{apiKey:'test',fetcher:async()=>Response.json(data)});
  assert.equal(result.offers.length+result.priceObservations.length,0,amount);
 }
});

test('Omkar rejects conflicting fare-tier passenger scope despite a generic one-traveler label',async()=>{
 for(const detail of ['CAD 845.50 one way for 2 travelers','CAD 845.50 round trip for 1 traveler']){
  const data=structuredClone(payload);data.flights[0].fare_options[0].price_detail=detail;
  const result=await searchOmkarExpedia(query,{apiKey:'test',fetcher:async()=>Response.json(data)});
  assert.equal(result.offers.length+result.priceObservations.length,0,detail);
 }
});

test('Omkar rejects unknown currency, wrong price scope, and non-one-adult requests',async()=>{
 const data=structuredClone(payload);delete data.flights[0].fare_options[0].currency;data.flights[0].fare_options[0].display_price='$845.50';data.flights[0].fare_options[0].price_detail='$845.50 one way for 1 traveler';
 const unknown=await searchOmkarExpedia(query,{apiKey:'test-key',fetcher:async()=>Response.json(data)});assert.equal(unknown.offers.length,0);assert.equal(unknown.priceObservations.length,0);assert.equal(unknown.sources[0].diagnostics.unverifiedPrice,1);
 const wrongScope=structuredClone(payload);wrongScope.flights[0].fare_type='Round trip';wrongScope.flights[0].fare_options[0].price_detail='CAD 845.50 for 2 travelers';
 assert.equal((await searchOmkarExpedia(query,{apiKey:'test-key',fetcher:async()=>Response.json(wrongScope)})).offers.length,0);
 await assert.rejects(searchOmkarExpedia({...query,adults:2},{apiKey:'test-key',fetcher:()=>{throw Error('must not fetch');}}),/one adult only/);
});

test('Expedia URL builder preserves dates and trip shape without claiming a quote',()=>{
 const url=new URL(expediaSearchUrl({origin:'YHZ',destination:'LAX',date:'2099-04-15',returnDate:'2099-04-22',tripType:'round-trip',adults:1,cabin:'economy'}));
 assert.equal(url.hostname,'www.expedia.ca');assert.equal(url.searchParams.get('trip'),'roundtrip');assert.match(url.searchParams.get('leg1'),/YHZ/);assert.match(url.searchParams.get('leg2'),/LAX/);assert.equal(url.searchParams.get('d1'),'2099-04-15');assert.equal(url.searchParams.get('d2'),'2099-04-22');
});

test('Expedia Halifax–Los Angeles link preserves the supplied November 2026 search constraints',()=>{
 const url=new URL(expediaSearchUrl({origin:'YHZ',destination:'LAX',date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',adults:1,cabin:'economy'}));
 assert.equal(url.hostname,'www.expedia.ca');
 assert.equal(url.searchParams.get('trip'),'roundtrip');
 assert.equal(url.searchParams.get('d1'),'2026-11-12');
 assert.equal(url.searchParams.get('d2'),'2026-11-19');
 assert.equal(url.searchParams.get('fromDate'),'12/11/2026');
 assert.equal(url.searchParams.get('toDate'),'19/11/2026');
 assert.match(url.searchParams.get('leg1'),/from:YHZ \(YHZ\),to:LAX \(LAX\),departure:12\/11\/2026TANYT/);
 assert.match(url.searchParams.get('leg2'),/from:LAX \(LAX\),to:YHZ \(YHZ\),departure:19\/11\/2026TANYT/);
 assert.equal(url.searchParams.get('options'),'cabinclass:economy');
 assert.equal(url.searchParams.get('passengers'),'adults:1,infantinlap:N');
});

test('Expedia search link carries selected airport display names when available',()=>{
 const url=new URL(expediaSearchUrl({origin:'YHZ',destination:'LAX',date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',adults:1,cabin:'economy',originAirport:{code:'YHZ',name:'Stanfield Intl.',city:'Halifax',region:'NS',country:'Canada'},destinationAirport:{code:'LAX',name:'Los Angeles Intl.',city:'Los Angeles',region:'CA',country:'United States of America'}}));
 assert.match(url.searchParams.get('leg1'),/from:Halifax, NS \(YHZ-Stanfield Intl\.\)/);
 assert.match(url.searchParams.get('leg1'),/to:Los Angeles, CA, United States of America \(LAX-Los Angeles Intl\.\)/);
 assert.match(url.searchParams.get('leg2'),/from:Los Angeles, CA, United States of America \(LAX-Los Angeles Intl\.\)/);
 assert.match(url.searchParams.get('leg2'),/to:Halifax, NS \(YHZ-Stanfield Intl\.\)/);
});

test('provider routing keeps Omkar one-way support separate and gives round trips a manual search link',async()=>{
 const result=await searchProviders({...query,source:'omkar-expedia'},{searchOmkarExpedia:async()=>({offers:[],priceObservations:[],sources:[{provider:'Expedia via Omkar',status:'ok'}]})});assert.equal(result.sources[0].provider,'Expedia via Omkar');
 const roundTrip=await searchProviders({...query,source:'omkar-expedia',tripType:'round-trip',returnDate:'2099-04-22'},{searchOmkarExpedia:()=>{throw Error('must not call');}});assert.equal(roundTrip.sources[0].status,'unsupported_trip');assert.match(roundTrip.sources[0].searchUrl,/expedia\.ca\/Flights-Search/);
});

test('Omkar HTTP 500 remains a temporary source failure after bounded retry and adds no fare',async()=>{
 let attempts=0;
 const result=await searchProviders({...query,source:'omkar-expedia'},{searchOmkarExpedia:input=>searchOmkarExpedia(input,{apiKey:'test-key',fetcher:async()=>{attempts++;return new Response('upstream failure',{status:500});}})});
 assert.equal(attempts,2);
 assert.equal(result.sources.find(source=>source.provider==='Expedia via Omkar')?.status,'temporarily_unavailable');
 assert.equal(result.sources.find(source=>source.provider==='Expedia via Omkar')?.httpStatus,500);
 assert.equal(result.offers.length,0);
 assert.equal(result.priceObservations.length,0);
});

test('round-trip Expedia handoff uses the airport selections carried by the search job',async()=>{
 const result=await searchProviders({...query,destination:'LAX',source:'omkar-expedia',tripType:'round-trip',returnDate:'2099-04-22',originAirport:{code:'YHZ',name:'Stanfield Intl.',city:'Halifax',region:'NS',country:'Canada'},destinationAirport:{code:'LAX',name:'Los Angeles Intl.',city:'Los Angeles',region:'CA',country:'United States of America'}},{searchOmkarExpedia:()=>{throw Error('must not call');}});
 const url=new URL(result.sources[0].searchUrl);
 assert.match(url.searchParams.get('leg1'),/Halifax, NS \(YHZ-Stanfield Intl\.\)/);
 assert.match(url.searchParams.get('leg1'),/Los Angeles, CA, United States of America \(LAX-Los Angeles Intl\.\)/);
});
