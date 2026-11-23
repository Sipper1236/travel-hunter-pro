import test from 'node:test';
import assert from 'node:assert/strict';
import {hotelWorkerResultError} from '../lib/hotel-worker-result.mjs';

const input={city:'Montréal',checkin:'2027-04-15',checkout:'2027-04-20',adults:2,adultAges:[35,39],childrenAges:[12],rooms:1,minStars:4,hotelSource:'booking-demand'};
const destination={city:'Montréal',cityId:'Q340',countryCode:'CA',bookingCityId:123};
const now=Date.parse('2026-11-13T12:00:00Z');
function offer(overrides={}){return {name:'Example Hotel',stars:4,priceText:'CAD 210.00',displayPriceText:'CAD 200.00',currency:'CAD',source:'Booking.com Demand API',provider:'booking',providerPage:1,url:'https://www.booking.com/hotel/ca/example.html',observedAt:new Date(now).toISOString(),stay:{checkin:'2027-04-15',checkout:'2027-04-20',nights:5,rooms:1,adults:2,adultAges:[35,39],childrenAges:[12]},occupancyEvidence:{status:'provider_product_allocation_match',roomsRequested:1,requestedRoomAllocations:[{adultAges:[35,39],childrenAges:[12]}],productsMatchedRequestedAllocations:true,productTotalsMatchExpectedTotal:true,expectedTotalCents:21000,productTotalsCents:[21000],expectedTotalIncludesNonConditionalCharges:true},locationEvidence:{status:'verified',city:'Montréal',countryCode:'CA',cityId:'Q340',bookingCityId:123,hotelName:'Example Hotel',propertyKey:'www.booking.com/hotel/ca/example.html',observedAt:new Date(now).toISOString()},...overrides};}
function result(offers=[offer()],query=input){
 const demandOnly=offers.length>0&&offers.every(item=>item.source==='Booking.com Demand API');
 const sourceResults=offers.flatMap(item=>{
  if(item.source==='Booking.com via api-anything'&&query.rooms>1)return Array.from({length:query.rooms},(_,index)=>({provider:'Booking.com browser search',room:index+1,status:'observed',observations:1,acceptedForSameProperty:1}));
  return [{provider:item.source==='Booking.com via api-anything'?'Booking.com browser search':item.source==='Booking.com Demand API'?'Booking.com Demand API':item.source==='Official hotel website via API Anything / Reservit'?'Official hotel / Reservit':String(item.provider??'unknown'),status:'observed',observations:1,propertiesReceived:1,accepted:1}];
 });
 if(demandOnly){
  const pages=Math.max(...offers.map(item=>item.providerPage??1)),pageObservations=Array.from({length:pages},(_,index)=>{const page=index+1,pageOffers=offers.filter(item=>item.providerPage===page);return {page,propertiesReturned:pageOffers.length,accepted:pageOffers.length,observedAt:pageOffers[0]?.observedAt??new Date(now).toISOString()};});
  const demandSource={provider:'Booking.com Demand API',status:'observed',propertiesReceived:offers.length,accepted:offers.length,pagesChecked:pages,pageObservations,paginationStatus:'complete'};
  return {status:'complete',query:{...query,destination},sourceResults:[demandSource],offers,received:offers.length,rejected:0,coverage:{limit:60,pageSize:30,pagesChecked:pages,propertiesReturned:offers.length,providerReportedTotal:offers.length,moreAvailable:false,paginationStatus:'complete'}};
 }
 return {status:'complete',query:{...query,destination},sourceResults,offers};
}

test('hotel worker accepts a fresh CAD quote matching destination, dates, guests, and expected total',()=>{
 assert.equal(hotelWorkerResultError(result(),input,now),null);
});

test('hotel worker rejects unrecognized query-envelope fields while allowing destination resolution metadata',()=>{
 const resolved=result();resolved.query.cityId=destination.cityId;
 assert.equal(hotelWorkerResultError(resolved,input,now),null);
 const misresolved=result();misresolved.query.cityId='Q999';
 assert.match(hotelWorkerResultError(misresolved,input,now),/city identifier does not match/);
 const injected=result();injected.query.unrequestedSource='partner-sandbox';
 assert.match(hotelWorkerResultError(injected,input,now),/unrecognized query field/);
});

test('priced hotel offers require matching observed source coverage',()=>{
 const valid=result();
 assert.match(hotelWorkerResultError({...valid,sourceResults:[]},input,now),/lacks valid provider source status/);
 assert.match(hotelWorkerResultError({...valid,sourceResults:[{provider:'Official hotel / Reservit',status:'observed',observations:1}]},input,now),/no matching observed provider status with accepted source coverage/);
 assert.match(hotelWorkerResultError({...valid,sourceResults:[{provider:'Booking.com browser search',status:'observed',accepted:1}]},input,now),/no matching observed provider status with accepted source coverage/);
 assert.match(hotelWorkerResultError({...valid,sourceResults:[{provider:'Booking.com Demand API',status:'observed',accepted:0}]},input,now),/no matching observed provider status with accepted source coverage/);
 assert.match(hotelWorkerResultError({...valid,sourceResults:[{provider:'Booking.com Demand API',status:'observed',propertiesReceived:1,accepted:2}]},input,now),/no matching observed provider status with accepted source coverage/);
 assert.match(hotelWorkerResultError({...valid,sourceResults:[{provider:'Booking.com Demand API',status:'rate_limited',accepted:1}]},input,now),/no matching observed provider status with accepted source coverage/);
 assert.match(hotelWorkerResultError({...valid,sourceResults:[{provider:'Booking.com Demand API',status:'error',accepted:1}]},input,now),/no matching observed provider status with accepted source coverage/);
});

test('hotel worker rejects a quote for different stay dates or traveler ages',()=>{
 assert.match(hotelWorkerResultError(result([offer({stay:{...offer().stay,checkout:'2027-04-21'}})]),input,now),/stay dates/);
 assert.match(hotelWorkerResultError(result([offer({stay:{...offer().stay,childrenAges:[11]}})]),input,now),/children/);
});

test('hotel worker rejects an unverified property or stale price',()=>{
 assert.match(hotelWorkerResultError(result([offer({locationEvidence:{...offer().locationEvidence,status:'unverified'}})]),input,now),/property destination/);
 assert.match(hotelWorkerResultError(result([offer({observedAt:'2026-11-13T11:00:00Z'})]),input,now),/stale/);
});

test('hotel worker rejects a displayed total that disagrees with room product totals',()=>{
 assert.match(hotelWorkerResultError(result([offer({occupancyEvidence:{...offer().occupancyEvidence,productTotalsCents:[20000]}})]),input,now),/product totals/);
});

test('hotel worker validates multi-room product allocations and totals without changing room assignments',()=>{
 const multi={...input,adults:2,adultAges:[35,39],childrenAges:[7],rooms:2,hotelSource:'booking-demand',roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]};
 const quoted=offer({priceText:'CAD 300.00',stay:{checkin:multi.checkin,checkout:multi.checkout,nights:5,rooms:2,adults:2,adultAges:[35,39],childrenAges:[7],roomAllocations:multi.roomAllocations},occupancyEvidence:{status:'provider_product_allocation_match',roomsRequested:2,requestedRoomAllocations:multi.roomAllocations,productsMatchedRequestedAllocations:true,productTotalsMatchExpectedTotal:true,expectedTotalCents:30000,productTotalsCents:[12000,18000],expectedTotalIncludesNonConditionalCharges:true}});
 assert.equal(hotelWorkerResultError(result([quoted],multi),multi,now),null);
 const swapped={...quoted,occupancyEvidence:{...quoted.occupancyEvidence,requestedRoomAllocations:[...multi.roomAllocations].reverse()}};
 assert.match(hotelWorkerResultError(result([swapped],multi),multi,now),/product totals or allocations/);
});

test('hotel worker sums only fresh room quotes with the requested ages and same property',()=>{
 const multi={...input,adults:2,adultAges:[35,39],childrenAges:[7],rooms:2,hotelSource:'booking',roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]};
 const shared='www.booking.com/hotel/ca/example.html',observedAt=new Date(now).toISOString();
 const quotes=[{room:1,priceText:'CAD 120.00',observedAt,adultAges:[35],childrenAges:[7],propertyKey:shared},{room:2,priceText:'CAD 180.00',observedAt,adultAges:[39],childrenAges:[],propertyKey:shared}];
 const combined=offer({source:'Booking.com via api-anything',priceText:'CAD 300.00',stay:{checkin:multi.checkin,checkout:multi.checkout,nights:5,rooms:2,adults:2,adultAges:[35,39],childrenAges:[7],roomAllocations:multi.roomAllocations},occupancyEvidence:{status:'separate_room_count_matches',individualAgesEchoed:false,rooms:[{room:1,status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,requestedAdultAges:[35],requestedChildrenAges:[7]},{room:2,status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,requestedAdultAges:[39],requestedChildrenAges:[]}]},roomQuotes:quotes});
 assert.equal(hotelWorkerResultError(result([combined],multi),multi,now),null);
 assert.match(hotelWorkerResultError({...result([combined],multi),sourceResults:[{provider:'Booking.com browser search',room:1,status:'observed',acceptedForSameProperty:1}]},multi,now),/no matching observed provider status with accepted source coverage/);
 assert.match(hotelWorkerResultError({...result([combined],multi),sourceResults:result([combined],multi).sourceResults.map(source=>({...source,acceptedForSameProperty:0}))},multi,now),/no matching observed provider status with accepted source coverage/);
 assert.match(hotelWorkerResultError(result([{...combined,roomQuotes:quotes.map(({propertyKey,...quote})=>quote)}],multi),multi,now),/room totals or assignments/);
 assert.match(hotelWorkerResultError(result([{...combined,priceText:'CAD 301.00'}],multi),multi,now),/room totals or assignments/);
});

test('hotel worker requires the selected source identity and Booking.com occupancy evidence',()=>{
 const misattributed=offer({source:'Official hotel website via API Anything / Reservit',provider:'official'});
 assert.match(hotelWorkerResultError(result([misattributed]),input,now),/selected hotel source/);
 const noOccupancy=offer({occupancyEvidence:null});
 assert.match(hotelWorkerResultError(result([noOccupancy]),input,now),/occupancy evidence/);
 const wrongOccupancy=offer({occupancyEvidence:{...offer().occupancyEvidence,requestedRoomAllocations:[{adultAges:[35,39],childrenAges:[11]}]}});
 assert.match(hotelWorkerResultError(result([wrongOccupancy]),input,now),/occupancy evidence|allocations/);
});

test('hotel worker verifies Demand API page counters, per-page timestamps and partial failures',()=>{
 const valid=result();assert.equal(hotelWorkerResultError(valid,input,now),null);
 assert.match(hotelWorkerResultError({...valid,coverage:{...valid.coverage,propertiesReturned:2}},input,now),/pagination coverage/);
 assert.match(hotelWorkerResultError({...valid,sourceResults:[{...valid.sourceResults[0],pageObservations:[{...valid.sourceResults[0].pageObservations[0],accepted:0}]}]},input,now),/source counts|page observation/);
 assert.match(hotelWorkerResultError({...valid,offers:[offer({observedAt:new Date(now+1000).toISOString()})]},input,now),/page observation/);
 assert.match(hotelWorkerResultError({...valid,status:'partial'},input,now),/marked partial/);
 const partial={...valid,status:'partial',coverage:{...valid.coverage,moreAvailable:true,paginationStatus:'page_failed'},sourceResults:[{...valid.sourceResults[0],paginationStatus:'page_failed',paginationErrorStatus:'rate_limited',reason:'A later result page or its property details could not be verified; earlier validated offers are retained.'}]};
 assert.equal(hotelWorkerResultError(partial,input,now),null);
 assert.match(hotelWorkerResultError({...partial,sourceResults:[{...partial.sourceResults[0],paginationErrorStatus:undefined}]},input,now),/source counts/);
});

test('hotel worker accepts an official Reservit result only for an official search with supplied adult ages',()=>{
 const officialInput={...input,hotelSource:'official',adults:1,adultAges:[35]};
 const direct=offer({source:'Official hotel website via API Anything / Reservit',provider:'official',officialEvidence:{status:'verified',propertyKey:'reservit:1:2'},stay:{...offer().stay,adults:1,adultAges:[35]}});
 assert.equal(hotelWorkerResultError(result([direct],officialInput),officialInput,now),null);
});

test('official multi-room worker sums require each room quote to identify the same verified property',()=>{
 const propertyKey='reservit:1:2',multi={...input,hotelSource:'official',adults:2,adultAges:[35,39],childrenAges:[],rooms:2,roomAllocations:[{adultAges:[35],childrenAges:[]},{adultAges:[39],childrenAges:[]}]};
 const direct=offer({source:'Official hotel website via API Anything / Reservit',provider:'official',priceText:'CAD 300.00',occupancyEvidence:null,officialEvidence:{status:'verified',propertyKey},locationEvidence:{...offer().locationEvidence,propertyKey},stay:{...offer().stay,adults:2,adultAges:[35,39],childrenAges:[],rooms:2,roomAllocations:multi.roomAllocations},roomQuotes:multi.roomAllocations.map((room,index)=>({room:index+1,priceText:index?'CAD 180.00':'CAD 120.00',observedAt:new Date(now).toISOString(),...room,propertyKey}))});
 assert.equal(hotelWorkerResultError(result([direct],multi),multi,now),null);
 assert.match(hotelWorkerResultError(result([{...direct,roomQuotes:direct.roomQuotes.map(({propertyKey,...quote})=>quote)}],multi),multi,now),/room totals or assignments/);
});

test('hotel worker keeps empty results valid even when a source is unavailable',()=>{
 assert.equal(hotelWorkerResultError({offers:[],status:'unavailable',query:{...input,destination},sourceResults:[{provider:'Booking.com Demand API',status:'rate_limited',reason:'Provider rate limit.'}]},input,now),null);
 assert.match(hotelWorkerResultError({offers:[],status:'unavailable',query:{...input,destination}},input,now),/source status or bounded discovery coverage/);
 assert.match(hotelWorkerResultError({offers:[],status:'unavailable',query:{...input,destination},sourceResults:[{provider:'Booking.com Demand API'}]},input,now),/invalid source status/);
 const directoryCoverage={source:'OpenStreetMap',checkedLimit:5,discovered:0,radiusMeters:10000,moreAvailable:false,attributionUrl:'https://www.openstreetmap.org/copyright'};
 assert.equal(hotelWorkerResultError({offers:[],status:'no_matching_observation',query:{...input,destination},sourceResults:[],discoveryCoverage:directoryCoverage},input,now),null);
 assert.equal(hotelWorkerResultError({offers:[],status:'no_matching_observation',query:{...input,destination},discoveryCoverage:{source:'User-selected property website',checkedLimit:1,discovered:1}},input,now),null);
 assert.match(hotelWorkerResultError({offers:[],status:'no_matching_observation',query:{...input,destination},discoveryCoverage:{}},input,now),/source status or bounded discovery coverage/);
});

test('hotel worker rejects a result envelope whose stay query changed, even with no offers',()=>{
 const changed={...result([]),query:{...input,checkout:'2027-04-21',destination}};
 assert.match(hotelWorkerResultError(changed,input,now),/result query/);
});
