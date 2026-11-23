import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVacationApiResponse,normalizeVacationListing} from '../lib/vacation-normalize.mjs';
import {searchVacationWithCache,vacationResponseCacheKey} from '../lib/vacation-response-cache.mjs';
import {createJobStore} from '../lib/job-store.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validateVacationQuery} from '../lib/vacation-query.mjs';
const query={origin:'YHZ',destinationLabel:'Barcelona, Spain',destinationAirport:'BCN',date:'2027-04-15',returnDate:'2027-04-25',adults:1,rooms:1,childrenAges:[]};
const listingUrl='https://vacations.aircanada.com/en/packages/product-listing?departureLocation=YHZ&arrivalLocationName=Barcelona%2C+Spain&departingDateTime=15%2F04%2F2027&returnDateTime=25%2F04%2F2027&nb_adult=1&numberOfRooms=1&nb_child=0';
const context={query,listingUrl,observedAt:'2026-10-29T01:00:00Z',currencyTermsText:'All prices are in Canadian currency, unless otherwise indicated'};
const apiRequestUrl='https://vacations-api.aircanada.com/packages-search/search?orig=YHZ&destId=barcelona-city-id&destType=city&dest=12345&adults=1&dep-date=20270415&ret-date=20270425&cabin=Y&lang=en&rooms=1&hotels=&sort=recommended&offset=0&limit=20&applySponsorPlacement=true';
function packageApiResponse(overrides={}){
 const pkg={id:'package-1',hotelId:'hotel-1',roomId:'room-1',svHotelId:'hotel-1',mealPlanId:'meal-1',selectedOptionIds:{itineraryId:'itinerary-1'},information:{checkIn:'20270416',checkOut:'20270425',origin:'YHZ',destination:'BCN',mealPlanName:'Breakfast',packageInclusions:'Flight + Hotel',refundable:false,transferIncluded:false,distanceToAirportKm:12},pricing:{grandTotal:3200,total:3200,perPaxType:[{paxCount:1,paxType:'ADULT',price:3000,taxFees:200,total:3200}]},promotions:[],dynamicPackage:false};
 const hotel={id:'hotel-1',name:'Barcelona Test Hotel',destination:'Barcelona, Spain',destinationId:'12345',starCategory:4,hotelInclusions:'Breakfast',isFeatured:false,recommended:false,recommendedIndex:0,location:{latitude:'41.3',longitude:'2.1'},media:{images:[],sizes:{}}};
 const itinerary={id:'itinerary-1',segments:[{bound:'DEPARTURE',origin:'YHZ',destination:'BCN',departureDate:'20270415',arrivalDate:'20270416',departureTime:'21:30',arrivalTime:'16:00',carrierCode:'AC',carrierName:'Air Canada',flightNumber:'123',cabinClass:'Y',cabinClassName:'Economy',numConnections:0,totalFlightDuration:'12h 30m',originName:'Halifax',destinationName:'Barcelona'},{bound:'RETURN',origin:'BCN',destination:'YHZ',departureDate:'20270425',arrivalDate:'20270425',departureTime:'10:00',arrivalTime:'13:00',carrierCode:'AC',carrierName:'Air Canada',flightNumber:'124',cabinClass:'Y',cabinClassName:'Economy',numConnections:0,totalFlightDuration:'9h',originName:'Barcelona',destinationName:'Halifax'}]};
 return {id:'search-1',results:{metaData:{totalAvailable:80,currentStart:0,currentEnd:0},packages:[pkg]},hotels:{'hotel-1':hotel},itineraries:{'itinerary-1':itinerary},alternateDates:[],filters:{},information:{economyCabins:true},triggers:{},...overrides};
}
const leg=(type,from,to,date)=>`<div class="accordion-content ${type}"><div class="city origin"><span class="code">${from}</span></div><div class="city destination"><span class="code">${to}</span></div><div class="datetime origin"><span class="date">${date}</span></div></div>`;
const html=`<div class="hotel-item"><h2 class="hotel-name">Test Property</h2><div class="hotel-city">Barcelona, Spain</div><div class="hotel-rating"><span class="stars">4stars</span></div><div class="package-includes">Included: Flight + Hotel</div><div class="price-total"><span class="price">$2,168.03</span></div><button class="flight-details-link" aria-controls="flight-1">Flight details</button></div><div id="flight-1"><div class="sr-only">Departure flight summary: 1 stop. Cabin class: Economy. Return flight summary: 2 stops. Cabin class: Economy.</div>${leg('outbound','YHZ','BCN','Apr 15, 2027')}${leg('inbound','BCN','YHZ','Apr 25, 2027')}</div>`;
test('normalizes actual group total only with matching panel, query and currency evidence',async()=>{
 const r=await normalizeVacationListing(html,context);assert.equal(r.offers.length,1);assert.equal(r.offers[0].price,2168.03);assert.equal(r.offers[0].product,'supplier-package');assert.equal(r.offers[0].propertyCity,'Barcelona, Spain');assert.equal(r.offers[0].destinationMatch.status,'provider-listed city matches selected destination');
 for(const markup of [html.replace('4stars','unknown'),html.replace('$2,168.03','USD 2168.03'),html.replace('Apr 25, 2027','Apr 26, 2027'),html.replaceAll('BCN','MAD'),html.replace('aria-controls="flight-1"','aria-controls="missing"')])assert.equal((await normalizeVacationListing(markup,context)).offers.length,0);
 assert.equal((await normalizeVacationListing(html,{...context,currencyTermsText:''})).status,'currency_unverified');
 const classFiltered=await normalizeVacationListing(html,{...context,query:{...query,minStars:5}});assert.equal(classFiltered.offers.length,0);assert.equal(classFiltered.filterRejected,1);
 const budgetFiltered=await normalizeVacationListing(html,{...context,query:{...query,maxPrice:2000}});assert.equal(budgetFiltered.offers.length,0);assert.equal(budgetFiltered.filterRejected,1);
 assert.equal((await normalizeVacationListing(html,{...context,query:{...query,maxPrice:2168.03}})).offers.length,1);
 assert.equal((await normalizeVacationListing(html.replace('Barcelona, Spain','Madrid, Spain'),context)).offers.length,0);
 assert.equal((await normalizeVacationListing(html.replace('<div class="hotel-city">Barcelona, Spain</div>',''),context)).offers.length,0);
});

test('normalizes the ordinary widget JSON response with exact route, stay, hotel, itinerary and comparable CAD total',()=>{
 const result=normalizeVacationApiResponse(packageApiResponse(),{...context,requestUrl:apiRequestUrl,sourceUrl:listingUrl,responseBytes:88189});
 assert.equal(result.status,'observed');assert.equal(result.received,1);assert.equal(result.rejected,0);
 assert.equal(result.offers.length,1);
 const offer=result.offers[0];
 assert.equal(offer.price,3200);assert.equal(offer.name,'Barcelona Test Hotel');assert.equal(offer.propertyCity,'Barcelona, Spain');
 assert.deepEqual(offer.hotelStay,{checkIn:'2027-04-16',checkOut:'2027-04-25'});
 assert.deepEqual(offer.flightStops,{outbound:0,inbound:0});assert.match(offer.flightSummary,/YHZ.*BCN.*BCN.*YHZ/);
 assert.equal(offer.packageEvidence.responsePackageId,'package-1');assert.equal(offer.packageEvidence.itineraryId,'itinerary-1');
 assert.equal(result.coverage.mode,'structured_widget_response');assert.equal(result.coverage.returnedPackages,1);assert.equal(result.coverage.moreAvailable,true);
 assert.equal(result.sourceEvidence.endpoint,'https://vacations-api.aircanada.com/packages-search/search');
 const actualAdultMarker=packageApiResponse();actualAdultMarker.results.packages[0].pricing.perPaxType[0].paxType='A';
 assert.equal(normalizeVacationApiResponse(actualAdultMarker,{...context,requestUrl:apiRequestUrl,sourceUrl:listingUrl,responseBytes:88189}).offers.length,1);
});

test('ACV structured package cache reuses only an exact fresh worker-valid widget result',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'vacation-response-cache-')),store=createJobStore(join(directory,'jobs.sqlite'));
 const exactQuery=validateVacationQuery({...query,originLabel:'Halifax Stanfield Intl. Airport (YHZ)'}),freshContext={...context,query:exactQuery,observedAt:new Date().toISOString()};
 const result=normalizeVacationApiResponse(packageApiResponse(),{...freshContext,requestUrl:apiRequestUrl,sourceUrl:listingUrl,responseBytes:88189});let calls=0;
 try{
  const search=async()=>{calls++;return result;};
  const first=await searchVacationWithCache(exactQuery,{cache:store,search});assert.equal(first.offers.length,1);assert.equal(first.cacheStatus,undefined);
  const second=await searchVacationWithCache(exactQuery,{cache:store,search});assert.equal(second.cacheStatus,'hit');assert.equal(second.offers[0].observedAt,first.offers[0].observedAt);assert.equal(calls,1);
  assert.notEqual(vacationResponseCacheKey(exactQuery),vacationResponseCacheKey({...exactQuery,maxStops:0}));
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('normalizes adult multi-room packages only when every provider room allocation and weighted group total match',()=>{
 const multiRoomQuery={...query,adults:2,rooms:2};
 const multiRoomListing=new URL(listingUrl);multiRoomListing.searchParams.set('nb_adult','2');multiRoomListing.searchParams.set('numberOfRooms','2');multiRoomListing.searchParams.set('r0','1-adult-0');multiRoomListing.searchParams.set('r1','1-adult-0');
 const multiRoomRequest=new URL(apiRequestUrl);multiRoomRequest.searchParams.set('adults','2');multiRoomRequest.searchParams.set('rooms','2');
 const response=packageApiResponse();response.results.packages[0].pricing={grandTotal:6400,total:6400,perPaxType:[{paxCount:2,paxType:'A',price:3000,taxFees:200,total:3200}]};
 const result=normalizeVacationApiResponse(response,{...context,query:multiRoomQuery,requestUrl:multiRoomRequest.href,sourceUrl:multiRoomListing.href,responseBytes:88189});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,6400);
 assert.equal(result.offers[0].occupancyEvidence.perRoomAllocation,'provider_listing_verified');
 assert.deepEqual(result.offers[0].occupancyEvidence.roomAllocations,[{adults:1,childrenAges:[]},{adults:1,childrenAges:[]}]);
 assert.deepEqual(result.offers[0].packageEvidence.roomAllocations,[{adults:1,childrenAges:[]},{adults:1,childrenAges:[]}]);
 const wrongRoomCount=new URL(multiRoomListing.href);wrongRoomCount.searchParams.delete('r1');
 assert.throws(()=>normalizeVacationApiResponse(response,{...context,query:multiRoomQuery,requestUrl:multiRoomRequest.href,sourceUrl:wrongRoomCount.href,responseBytes:88189}),/exact rendered provider listing/);
});

test('normalizes a one-child structured package only when request and provider party rows preserve the exact age',()=>{
 const childQuery={...query,childrenAges:[7]};
 const childListing=new URL(listingUrl);childListing.searchParams.set('nb_child','1');childListing.searchParams.set('non_adult1','7');childListing.searchParams.set('r0','1-adult-0,1-child-7');
 const childRequest=new URL(apiRequestUrl);childRequest.searchParams.set('child-ages','7');
 const response=packageApiResponse();response.results.packages[0].pricing={grandTotal:3200,total:3200,perPaxType:[{paxCount:1,paxType:'A',price:2400,taxFees:200,total:2600},{paxCount:1,paxType:'C',price:500,taxFees:100,total:600}]};
 const result=normalizeVacationApiResponse(response,{...context,query:childQuery,requestUrl:childRequest.href,sourceUrl:childListing.href,responseBytes:88189});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,3200);assert.deepEqual(result.offers[0].occupancyEvidence.childrenAgesInListingUrl,[7]);
 assert.deepEqual(result.offers[0].packageEvidence.paxRows,[{count:1,type:'A'},{count:1,type:'C'}]);
});

test('normalizes three exact-age children only when the comma-separated request and room allocation match',()=>{
 const childQuery={...query,childrenAges:[7,12,15]};
 const childListing=new URL(listingUrl);childListing.searchParams.set('nb_child','3');childListing.searchParams.set('non_adult1','7');childListing.searchParams.set('non_adult2','12');childListing.searchParams.set('non_adult3','15');childListing.searchParams.set('r0','1-adult-0,1-child-7,1-child-12,1-child-15');
 const childRequest=new URL(apiRequestUrl);childRequest.searchParams.set('child-ages','7,12,15');
 const response=packageApiResponse();response.results.packages[0].pricing={grandTotal:4400,total:4400,perPaxType:[{paxCount:1,paxType:'A',price:2400,taxFees:200,total:2600},{paxCount:1,paxType:'C',price:500,taxFees:100,total:600},{paxCount:1,paxType:'C',price:500,taxFees:100,total:600},{paxCount:1,paxType:'C',price:500,taxFees:100,total:600}]};
 const result=normalizeVacationApiResponse(response,{...context,query:childQuery,requestUrl:childRequest.href,sourceUrl:childListing.href,responseBytes:88189});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,4400);assert.deepEqual(result.offers[0].occupancyEvidence.childrenAgesInListingUrl,[7,12,15]);
 assert.deepEqual(result.offers[0].packageEvidence.paxRows,[{count:1,type:'A'},{count:1,type:'C'},{count:1,type:'C'},{count:1,type:'C'}]);
 assert.throws(()=>normalizeVacationApiResponse(response,{...context,query:childQuery,requestUrl:childRequest.href.replace('child-ages=7%2C12%2C15','child-ages=15%2C12%2C7'),sourceUrl:childListing.href,responseBytes:88189}),/request does not match/);
 const extraRequestParam=new URL(childRequest.href);extraRequestParam.searchParams.set('non_adult3','14');
 assert.throws(()=>normalizeVacationApiResponse(response,{...context,query:childQuery,requestUrl:extraRequestParam.href,sourceUrl:childListing.href,responseBytes:88189}),/request does not match/);
 assert.throws(()=>normalizeVacationApiResponse(response,{...context,query:{...childQuery,childrenAges:[7,12,15,16]},requestUrl:childRequest.href,sourceUrl:childListing.href,responseBytes:88189}),/at most three/);
 const wrongRoom=new URL(childListing.href);wrongRoom.searchParams.set('r0','1-adult-0,1-child-7,1-child-12,1-child-11');
 assert.throws(()=>normalizeVacationApiResponse(response,{...context,query:childQuery,requestUrl:childRequest.href,sourceUrl:wrongRoom.href,responseBytes:88189}),/rendered provider listing/);
});

test('structured widget results fail closed on mismatched requests, routes, stays, references, totals, currencies, or unverified parties',()=>{
 const base=packageApiResponse();
 for(const changed of [
  {...base,results:{...base.results,packages:[{...base.results.packages[0],information:{...base.results.packages[0].information,destination:'MAD'}}]}},
  {...base,results:{...base.results,packages:[{...base.results.packages[0],information:{...base.results.packages[0].information,checkOut:'20270424'}}]}},
  {...base,results:{...base.results,packages:[{...base.results.packages[0],selectedOptionIds:{itineraryId:'missing'}}]}},
  {...base,results:{...base.results,packages:[{...base.results.packages[0],pricing:{...base.results.packages[0].pricing,grandTotal:3199}}]}},
  {...base,results:{...base.results,packages:[{...base.results.packages[0],pricing:{...base.results.packages[0].pricing,perPaxType:[{...base.results.packages[0].pricing.perPaxType[0],total:3100}]}}]}},
  {...base,results:{...base.results,packages:[{...base.results.packages[0],pricing:{...base.results.packages[0].pricing,perPaxType:[{...base.results.packages[0].pricing.perPaxType[0],paxType:'C'}]}}]}},
  {...base,hotels:{...base.hotels,'hotel-1':{...base.hotels['hotel-1'],destinationId:'another-destination'}}},
  {...base,itineraries:{...base.itineraries,'itinerary-1':{...base.itineraries['itinerary-1'],segments:base.itineraries['itinerary-1'].segments.map((segment,index)=>index===0?{...segment,cabinClass:'B'}:segment)}}},
  {...base,hotels:{...base.hotels,'hotel-1':{...base.hotels['hotel-1'],destination:'Madrid, Spain'}}},
 ]){
  const result=normalizeVacationApiResponse(changed,{...context,requestUrl:apiRequestUrl,sourceUrl:listingUrl,responseBytes:88189});
  assert.equal(result.offers.length,0);
 }
 assert.throws(()=>normalizeVacationApiResponse(base,{...context,requestUrl:apiRequestUrl.replace('orig=YHZ','orig=YYZ'),sourceUrl:listingUrl,responseBytes:88189}),/request does not match/);
 assert.throws(()=>normalizeVacationApiResponse(base,{...context,requestUrl:apiRequestUrl.replace('cabin=Y','cabin=E'),sourceUrl:listingUrl,responseBytes:88189}),/request does not match/);
 assert.throws(()=>normalizeVacationApiResponse({...base,results:{...base.results,metaData:{...base.results.metaData,currentEnd:1}}},{...context,requestUrl:apiRequestUrl,sourceUrl:listingUrl,responseBytes:88189}),/unsupported result envelope/);
 assert.throws(()=>normalizeVacationApiResponse(base,{...context,query:{...query,childrenAges:[8]},requestUrl:apiRequestUrl,sourceUrl:listingUrl,responseBytes:88189}),/request does not match/);
 assert.throws(()=>normalizeVacationApiResponse(base,{...context,currencyTermsText:'',requestUrl:apiRequestUrl,sourceUrl:listingUrl,responseBytes:88189}),/CAD terms/);
});
test('maximum stops requires explicit outbound and return evidence and applies to both directions',async()=>{
 const upToTwo=await normalizeVacationListing(html,{...context,query:{...query,maxStops:2}});
 assert.equal(upToTwo.offers.length,1);assert.deepEqual(upToTwo.offers[0].flightStops,{outbound:1,inbound:2});
 const nonstop=await normalizeVacationListing(html,{...context,query:{...query,maxStops:0}});
 assert.equal(nonstop.offers.length,0);assert.equal(nonstop.stopFilterRejected,1);
 const unknown=await normalizeVacationListing(html.replace('Return flight summary: 2 stops.','Return details unavailable.'),{...context,query:{...query,maxStops:2}});
 assert.equal(unknown.offers.length,0);assert.equal(unknown.unknownStops,1);
 const nonstopEvidence=await normalizeVacationListing(html.replace('Departure flight summary: 1 stop.','Departure flight summary: Nonstop.').replace('Return flight summary: 2 stops.','Return flight summary: Nonstop.'),{...context,query:{...query,maxStops:0}});
 assert.equal(nonstopEvidence.offers.length,1);assert.deepEqual(nonstopEvidence.offers[0].flightStops,{outbound:0,inbound:0});
});
test('rejects wrong party, destination, host and unsupported child occupancy',async()=>{
 for(const patch of [{query:{...query,adults:2}},{query:{...query,childrenAges:[8]}},{query:{...query,infantsOnLap:1}},{query:{...query,destinationLabel:'Paris, France'}},{listingUrl:listingUrl+'&nb_infant=1'},{listingUrl:listingUrl+'&nb_infant=0&nb_infant=1'},{listingUrl:listingUrl.replace('vacations.aircanada.com','example.com')}])await assert.rejects(normalizeVacationListing(html,{...context,...patch}));
});

test('child package results must preserve every requested age in both provider occupancy fields',async()=>{
 const childQuery={...query,childrenAges:[10]};
 const childUrl=new URL(listingUrl);childUrl.searchParams.set('nb_child','1');childUrl.searchParams.set('non_adult1','10');childUrl.searchParams.set('r0','1-adult-0,1-child-10');
 const result=await normalizeVacationListing(html,{...context,query:childQuery,listingUrl:childUrl.href});
 assert.equal(result.offers.length,1);
 assert.deepEqual(result.offers[0].query.childrenAges,[10]);
 for(const patch of [
  {query:{...childQuery,childrenAges:[8]}},
  {listingUrl:new URLSearchParams(childUrl.searchParams).toString()},
  {listingUrl:childUrl.href.replace('non_adult1=10','non_adult1=11')},
  {listingUrl:childUrl.href.replace('1-child-10','1-child-11')},
  {listingUrl:childUrl.href.replace('nb_child=1','nb_child=2')},
  {query:{...childQuery,rooms:2}},
 ])await assert.rejects(normalizeVacationListing(html,{...context,query:childQuery,...patch}));
});

test('adult multi-room package results disclose that per-room allocation is not exposed',async()=>{
 const multiRoom={...query,adults:2,rooms:2},multiUrl=new URL(listingUrl);
 multiUrl.searchParams.set('nb_adult','2');multiUrl.searchParams.set('numberOfRooms','2');
 const result=await normalizeVacationListing(html,{...context,query:multiRoom,listingUrl:multiUrl.href});
 assert.equal(result.offers.length,1);
 assert.deepEqual(result.offers[0].occupancyEvidence,{status:'listing_parameters_match',adultsRequested:2,adultsInListingUrl:2,roomsRequested:2,roomsInListingUrl:2,childrenAgesRequested:[],childrenAgesInListingUrl:[],lapInfantsRequested:0,lapInfantsInListingUrl:0,perRoomAllocation:'not_exposed_by_widget'});
 await assert.rejects(normalizeVacationListing(html,{...context,query:multiRoom,listingUrl:multiUrl.href.replace('numberOfRooms=2','numberOfRooms=1')}),/requested party and dates/);
 await assert.rejects(normalizeVacationListing(html,{...context,query:multiRoom,listingUrl:multiUrl.href.replace('nb_adult=2','nb_adult=1')}),/requested party and dates/);
});

test('lap-infant package results must preserve the requested infant count in the provider URL',async()=>{
 const infant={seating:'lap',departureAge:1,returnAge:1};
 const infantQuery={...query,infants:[infant]};
 const infantUrl=new URL(listingUrl);infantUrl.searchParams.set('nb_infant','1');
 const result=await normalizeVacationListing(html,{...context,query:infantQuery,listingUrl:infantUrl.href});
 assert.equal(result.offers.length,1);
 assert.equal(result.offers[0].query.infants.length,1);
 for(const url of [listingUrl,listingUrl+'&nb_infant=0',listingUrl+'&nb_infant=2',listingUrl+'&nb_infant=1&infants=1'])
  await assert.rejects(normalizeVacationListing(html,{...context,query:infantQuery,listingUrl:url}));
 await assert.rejects(normalizeVacationListing(html,{...context,query:{...infantQuery,infants:[{...infant,returnAge:2}]},listingUrl:infantUrl.href}));
});
