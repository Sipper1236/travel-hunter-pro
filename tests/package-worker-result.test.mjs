import test from 'node:test';
import assert from 'node:assert/strict';
import {packageWorkerResultError} from '../lib/package-worker-result.mjs';
import {normalizeVacationListing} from '../lib/vacation-normalize.mjs';

const input={origin:'YHZ',originLabel:'Halifax, NS',destinationAirport:'BCN',destinationLabel:'Barcelona, Spain',date:'2027-04-15',returnDate:'2027-04-25',adults:1,rooms:1,childrenAges:[],minStars:4,maxStops:2,maxResults:20};
const now=Date.parse('2026-11-14T02:00:00Z');
function makeResult(query=input){
 const listingUrl=new URL('https://vacations.aircanada.com/en/packages/product-listing');
 Object.entries({departureLocation:query.origin,arrivalLocationName:query.destinationLabel,departingDateTime:'15/04/2027',returnDateTime:'25/04/2027',nb_adult:String(query.adults),numberOfRooms:String(query.rooms),nb_child:String(query.childrenAges.length),nb_infant:'0'}).forEach(([key,value])=>listingUrl.searchParams.set(key,value));
 const observedAt=new Date(now).toISOString();
 const offer={name:'Barcelona Beach Hotel',stars:4,price:3200,currency:'CAD',currencyEvidenceUrl:'https://vacations.aircanada.com/en/terms-conditions',provider:'Air Canada Vacations',source:'Air Canada Vacations via api-anything',product:'supplier-package',observedAt,query,occupancyEvidence:{status:'listing_parameters_match',adultsRequested:query.adults,adultsInListingUrl:query.adults,roomsRequested:query.rooms,roomsInListingUrl:query.rooms,childrenAgesRequested:[...query.childrenAges],childrenAgesInListingUrl:[...query.childrenAges],lapInfantsRequested:query.infants?.length??0,lapInfantsInListingUrl:0,perRoomAllocation:'single_room_request'},propertyCity:'Barcelona',destinationMatch:{status:'provider-listed city matches selected destination',city:'Barcelona',evidence:'Hotel card city label'},mealPlan:'Breakfast',taxText:'Provider displayed package estimate.',cancellationText:null,flightSummary:'Departure flight summary: nonstop. Return flight summary: nonstop.',flightStops:{outbound:0,inbound:0},bookingStatus:'Observed estimated package total; final availability, exact property address and local charges unconfirmed',sourceUrl:listingUrl.toString()};
 return {status:'observed',query,offers:[offer],received:1,rejected:0,coverage:{visibleCards:1,flightPanelsAttempted:1,flightPanelLimit:20,moreAvailable:false,pageLoadStopped:false,resultLimit:20,pagesExpanded:0}};
}

test('package worker accepts a current CAD package matching exact route, dates, party, and filters',()=>{
 assert.equal(packageWorkerResultError(makeResult(),input,now),null);
});

test('package worker accepts the actual normalized provider listing shape',async()=>{
 const listing=new URL(makeResult().offers[0].sourceUrl);
 const leg=(type,from,to,date)=>`<div class="accordion-content ${type}"><div class="city origin"><span class="code">${from}</span></div><div class="city destination"><span class="code">${to}</span></div><div class="datetime origin"><span class="date">${date}</span></div></div>`;
 const html=`<div class="hotel-item"><h2 class="hotel-name">Barcelona Beach Hotel</h2><div class="hotel-city">Barcelona, Spain</div><div class="hotel-rating"><span class="stars">4stars</span></div><div class="package-includes">Included: Flight + Hotel</div><div class="price-total"><span class="price">$3,200.00</span></div><button class="flight-details-link" aria-controls="flight-1">Flight details</button></div><div id="flight-1"><div class="sr-only">Departure flight summary: Nonstop. Cabin class: Economy. Return flight summary: Nonstop. Cabin class: Economy.</div>${leg('outbound','YHZ','BCN','Apr 15, 2027')}${leg('inbound','BCN','YHZ','Apr 25, 2027')}</div>`;
 const normalized=await normalizeVacationListing(html,{query:input,listingUrl:listing.toString(),observedAt:new Date(now).toISOString(),currencyTermsText:'All prices are in Canadian currency, unless otherwise indicated'});
 const result={...normalized,query:input,coverage:makeResult().coverage};
 assert.equal(packageWorkerResultError(result,input,now),null);
});

test('package worker accepts structured widget results only with exact request, response, hotel, itinerary, stay and total evidence',()=>{
 const result=makeResult(),offer=result.offers[0];
 offer.source='Air Canada Vacations packages-search/search';
 offer.destinationMatch.evidence='Structured package hotel destination field and selected provider destination ID';
 offer.hotelStay={checkIn:'2027-04-16',checkOut:'2027-04-25'};
 offer.packageEvidence={responsePackageId:'package-1',hotelId:'hotel-1',itineraryId:'itinerary-1',paxRows:[{count:1,type:'A'}],groupTotalCents:320000,adultCount:1,rooms:1,requestOrigin:'YHZ',requestDestination:'BCN',requestDestinationId:'12345',departureDate:'2027-04-15',returnDate:'2027-04-25',outboundArrivalDate:'2027-04-16'};
 result.coverage={mode:'structured_widget_response',returnedPackages:1,totalAvailable:80,responseOffset:0,responseLimit:20,resultLimit:20,moreAvailable:true,pagesExpanded:0};
 result.sourceEvidence={mode:'structured_widget_response',endpoint:'https://vacations-api.aircanada.com/packages-search/search',method:'GET',status:200,responseBytes:88189,observedAt:new Date(now).toISOString(),request:{origin:'YHZ',destination:'BCN',destinationId:'12345',departureDate:'2027-04-15',returnDate:'2027-04-25',adults:1,rooms:1,cabin:'economy',offset:0,limit:20},response:{returnedPackages:1,totalAvailable:80},packageLinks:[{packageId:'package-1',hotelId:'hotel-1',itineraryId:'itinerary-1',destinationId:'12345',totalCents:320000}],currency:'CAD'};
 assert.equal(packageWorkerResultError(result,input,now),null);
 const changedRequest=structuredClone(result);changedRequest.sourceEvidence.request.returnDate='2027-04-24';assert.match(packageWorkerResultError(changedRequest,input,now),/structured request/);
 const changedStay=structuredClone(result);changedStay.offers[0].hotelStay.checkIn='2027-04-15';assert.match(packageWorkerResultError(changedStay,input,now),/hotel stay/);
 const changedLink=structuredClone(result);changedLink.offers[0].packageEvidence.itineraryId='other';assert.match(packageWorkerResultError(changedLink,input,now),/package evidence/);
 const changedDestination=structuredClone(result);changedDestination.sourceEvidence.request.destinationId='other-destination';assert.match(packageWorkerResultError(changedDestination,input,now),/structured package evidence/);
 const changedLinkDestination=structuredClone(result);changedLinkDestination.sourceEvidence.packageLinks[0].destinationId='other-destination';assert.match(packageWorkerResultError(changedLinkDestination,input,now),/package evidence/);
 const changedPaxType=structuredClone(result);changedPaxType.offers[0].packageEvidence.paxRows[0].type='C';assert.match(packageWorkerResultError(changedPaxType,input,now),/package evidence/);
 const weakenedCityEvidence=structuredClone(result);weakenedCityEvidence.offers[0].destinationMatch.evidence='Hotel card city label';assert.match(packageWorkerResultError(weakenedCityEvidence,input,now),/property city/);
 const oversized=structuredClone(result);oversized.sourceEvidence.responseBytes=2_000_001;assert.match(packageWorkerResultError(oversized,input,now),/response evidence/);
});

test('package worker rejects changed query, source dates, destination, and party',()=>{
 assert.match(packageWorkerResultError(makeResult({...makeResult().query,date:'2027-04-16'}),input,now),/query/);
 const changed=makeResult();changed.offers[0].sourceUrl=changed.offers[0].sourceUrl.replace('15%2F04%2F2027','16%2F04%2F2027');
 assert.match(packageWorkerResultError(changed,input,now),/Air Canada Vacations listing/);
 const wrongCity=makeResult();wrongCity.offers[0].propertyCity='Madrid';wrongCity.offers[0].destinationMatch.city='Madrid';
 assert.match(packageWorkerResultError(wrongCity,input,now),/destination/);
 const wrongParty=makeResult();wrongParty.offers[0].occupancyEvidence.adultsInListingUrl=2;
 assert.match(packageWorkerResultError(wrongParty,input,now),/occupancy/);
});

test('package worker rejects stale, non-CAD, over-budget, or over-stop package cards',()=>{
 const stale=makeResult();stale.offers[0].observedAt='2026-11-14T01:00:00Z';assert.match(packageWorkerResultError(stale,input,now),/stale/);
 const currency=makeResult();currency.offers[0].currency='USD';assert.match(packageWorkerResultError(currency,input,now),/CAD/);
 const budgetInput={...input,maxPrice:3000};assert.match(packageWorkerResultError(makeResult(budgetInput),budgetInput,now),/budget/);
 const stops=makeResult();stops.offers[0].flightStops.outbound=3;assert.match(packageWorkerResultError(stops,input,now),/stop filter/);
});

test('package worker rejects result-page expansion outside the selected page budget',()=>{
 const tooMany=makeResult();tooMany.coverage.pagesExpanded=1;
 assert.match(packageWorkerResultError(tooMany,input,now),/coverage does not match/);
 const forty={...input,maxResults:40},within=makeResult(forty);within.coverage.flightPanelLimit=40;within.coverage.resultLimit=40;within.coverage.pagesExpanded=1;
 assert.equal(packageWorkerResultError(within,forty,now),null);
});

test('package worker permits empty observed results while retaining honest coverage',()=>{
 const empty=makeResult();empty.offers=[];empty.received=0;empty.rejected=0;
 assert.equal(packageWorkerResultError(empty,input,now),null);
 assert.equal(packageWorkerResultError({status:'currency_unverified',query:input,offers:[]},input,now),null);
 const invalid=makeResult();invalid.offers=[null];invalid.received=1;invalid.rejected=0;
 assert.match(packageWorkerResultError(invalid,input,now),/invalid package offer/);
});
