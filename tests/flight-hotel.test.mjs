import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestedStay,compareFlightHotel} from '../lib/flight-hotel.mjs';
import {searchBooking} from '../lib/booking.mjs';
const destination={city:'Montréal',cityId:'Q340',countryCode:'CA',airport:'YUL'};
const flight={query:{adults:2,children:0,date:'2027-04-15'},offer:{to:'YUL',observedAt:new Date().toISOString(),price:1200,currency:'CAD',arrivalDate:'2027-04-16',inbound:{departureDate:'2027-04-20'}}};
const query={checkin:'2027-04-16',checkout:'2027-04-20',adults:2,destinationAirport:'YUL',destination};
const hotel=(priceText='CAD 100')=>({name:'Test Hotel',url:'https://www.booking.com/hotel/ca/test.en-gb.html',observedAt:new Date().toISOString(),currency:'CAD',priceText,stay:{checkin:query.checkin,checkout:query.checkout,nights:4,adults:2,rooms:1,childrenAges:[]},locationEvidence:{status:'verified',city:'Montréal',countryCode:'CA',cityId:'Q340',airport:'YUL',hotelName:'Test Hotel',propertyKey:'www.booking.com/hotel/ca/test.html',observedAt:new Date().toISOString()}});
test('hotel stay follows local flight arrival and matching property subtotal uses actual dates',()=>{
 assert.deepEqual(suggestedStay(flight),{checkin:query.checkin,checkout:query.checkout,adults:2});
 const c=compareFlightHotel(flight,hotel('CAD 1,234.50'),query);assert.equal(c.subtotal,2434.5);assert.equal(c.perAdult,1217.25);assert.equal(c.nights,4);
});
test('combined observations reject incompatible occupancy, currency, dates and malformed prices',()=>{
 const h=hotel();assert.equal(compareFlightHotel(flight,h,{...query,adults:1}),null);assert.equal(compareFlightHotel(flight,h,{...query,checkin:'2027-04-15'}),null);
 for(const priceText of ['CAD 1,2','CAD 100 per night','CAD 0','USD 100'])assert.equal(compareFlightHotel(flight,{...h,priceText},query),null);
 assert.equal(compareFlightHotel(flight,{...h,currency:'USD'},query),null);assert.equal(compareFlightHotel(null,h,query),null);
});
test('combined prices exclude stale flight, hotel or property evidence',()=>{
 const h=hotel(),old=new Date(Date.now()-16*60000).toISOString();
 assert.equal(compareFlightHotel({...flight,offer:{...flight.offer,observedAt:old}},h,query),null);
 assert.equal(compareFlightHotel(flight,{...h,observedAt:old},query),null);
 assert.equal(compareFlightHotel(flight,{...h,locationEvidence:{...h.locationEvidence,observedAt:old}},query),null);
});
test('an unrelated destination or another property cannot produce a flight-hotel subtotal',()=>{
 const h=hotel();
 for(const change of [{airport:'BCN'},{cityId:'Q1492'},{countryCode:'ES'},{city:'Barcelona'},{hotelName:'Other Hotel'},{propertyKey:'www.booking.com/hotel/ca/other.html'},{status:'unverified'}])assert.equal(compareFlightHotel(flight,{...h,locationEvidence:{...h.locationEvidence,...change}},query),null);
 assert.equal(compareFlightHotel(flight,{...h,locationEvidence:null},query),null);
});
test('hotel occupancy evidence and cent-precise flight amounts are required even if query metadata matches',()=>{
 const h=hotel();assert.equal(compareFlightHotel(flight,{...h,stay:undefined},query),null);
 for(const change of [{adults:1},{rooms:2},{childrenAges:[10]},{checkout:'2027-04-21'},{nights:5}])assert.equal(compareFlightHotel(flight,{...h,stay:{...h.stay,...change}},query),null);
 assert.equal(compareFlightHotel({...flight,offer:{...flight.offer,price:100.001}},h,query),null);
});
test('identified flight party matches exact hotel check-in ages for a single room',()=>{
 const travelers=[{id:'parent',birthDate:'1990-01-01'},{id:'child',birthDate:'2020-04-16',guardianId:'parent'}];
 const trip={...flight,query:{travelers,date:'2027-04-15'}};
 const q={...query,adults:1,childrenAges:[7],adultAges:[37],rooms:1};
 const h={...hotel(),stay:{...hotel().stay,adults:1,adultAges:[37],childrenAges:[7]}};
 assert.deepEqual(suggestedStay(trip),{checkin:'2027-04-16',checkout:'2027-04-20',adults:1,adultAges:[37],childrenAges:[7]});
 const comparison=compareFlightHotel(trip,h,q);assert.equal(comparison.subtotal,1300);assert.equal(comparison.perTraveler,650);
 assert.equal(compareFlightHotel(trip,h,{...q,childrenAges:[6]}),null);
 assert.equal(compareFlightHotel(trip,{...h,stay:{...h.stay,childrenAges:[6]}},q),null);
 assert.equal(compareFlightHotel(trip,h,{...q,adultAges:[36]}),null);
 assert.equal(compareFlightHotel(trip,h,{...q,rooms:2}),null);
});

test('count-based child flight parties can subtotal only with an explicit matching hotel check-in age',()=>{
 const trip={...flight,query:{adults:1,children:1,childrenAges:[7],date:'2027-04-15'}};
 const q={...query,adults:1,childrenAges:[8],rooms:1};
 const h={...hotel(),stay:{...hotel().stay,adults:1,childrenAges:[8]}};
 const comparison=compareFlightHotel(trip,h,q);
 assert.equal(comparison?.hotelAmount,100);
 assert.equal(comparison?.subtotal,1300);
 assert.equal(comparison?.perTraveler,650);
 assert.equal(compareFlightHotel(trip,h,{...q,childrenAges:[]}),null,'the hotel search must retain one child for the two-traveler flight party');
 assert.equal(compareFlightHotel(trip,{...h,stay:{...h.stay,childrenAges:[]}},q),null,'the observed stay must retain the explicitly entered check-in age');
 assert.equal(compareFlightHotel(trip,{...h,stay:{...h.stay,childrenAges:[9]}},q),null,'the source-observed stay age must match the age submitted for check-in');
 const countEvidence={status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,individualAgesEchoed:false};
 assert.equal(compareFlightHotel(trip,{...h,provider:'booking',source:'Booking.com via api-anything',occupancyEvidence:countEvidence},q),null,'a count-only hotel source cannot verify the exact child age needed for a subtotal');
});

test('separately quoted official rooms produce a subtotal only when every allocation and quote matches',()=>{
 const travelers=[{id:'adult-1',birthDate:'1990-01-01'},{id:'adult-2',birthDate:'1988-02-01'},{id:'child',birthDate:'2020-04-16',guardianId:'adult-1'}];
 const trip={...flight,query:{travelers,date:'2027-04-15'}};
 const allocations=[{adultAges:[37],childrenAges:[7]},{adultAges:[39],childrenAges:[]}];
 const q={...query,adults:2,adultAges:[37,39],childrenAges:[7],rooms:2,roomAllocations:allocations};
 const now=new Date().toISOString(),base=hotel('CAD 300');
 const h={...base,provider:'official',url:'https://secure.reservit.com/engine/booking/1/2/avail',priceText:'CAD 300.00',officialEvidence:{status:'verified',propertyKey:'reservit:1:2',officialUrl:'https://testhotel.example/',observedAt:now},locationEvidence:{...base.locationEvidence,propertyKey:'reservit:1:2'},stay:{...base.stay,rooms:2,adults:2,adultAges:[37,39],childrenAges:[7],roomAllocations:allocations},roomQuotes:[
  {room:1,priceText:'CAD 120.00',url:'https://secure.reservit.com/engine/booking/1/2/avail?room=1',observedAt:now,adultAges:[37],childrenAges:[7]},
  {room:2,priceText:'CAD 180.00',url:'https://secure.reservit.com/engine/booking/1/2/avail?room=2',observedAt:now,adultAges:[39],childrenAges:[]},
 ]};
 const comparison=compareFlightHotel(trip,h,q);
 assert.equal(comparison.hotelAmount,300);assert.equal(comparison.subtotal,1500);assert.equal(comparison.perTraveler,500);assert.equal(comparison.rooms,2);assert.equal(comparison.simultaneousRoomsVerified,false);
 assert.equal(compareFlightHotel(trip,h,{...q,roomAllocations:[allocations[1],allocations[0]]}),null);
 assert.equal(compareFlightHotel(trip,{...h,stay:{...h.stay,roomAllocations:[allocations[1],allocations[0]]}},q),null);
 assert.equal(compareFlightHotel(trip,{...h,roomQuotes:h.roomQuotes.slice(0,1)},q),null);
 assert.equal(compareFlightHotel(trip,{...h,roomQuotes:[{...h.roomQuotes[0],observedAt:'2000-01-01T00:00:00.000Z'},h.roomQuotes[1]]},q),null);
 assert.equal(compareFlightHotel(trip,{...h,priceText:'CAD 299.99'},q),null);
 assert.equal(compareFlightHotel(trip,{...h,roomQuotes:[h.roomQuotes[0],{...h.roomQuotes[1],url:'https://other.example/room'}]},q),null);
 assert.equal(compareFlightHotel(trip,{...h,roomQuotes:[h.roomQuotes[0],{...h.roomQuotes[1],url:'https://secure.reservit.com/engine/booking/1/999/avail?room=2'}]},q),null);
});

test('same-property Booking.com room observations can form only a separately quoted subtotal',()=>{
 const travelers=[{id:'adult-1',birthDate:'1990-01-01'},{id:'adult-2',birthDate:'1988-02-01'},{id:'child',birthDate:'2020-04-16',guardianId:'adult-1'}];
 const trip={...flight,query:{travelers,date:'2027-04-15'}},allocations=[{adultAges:[37],childrenAges:[7]},{adultAges:[39],childrenAges:[]}];
 const q={...query,adults:2,adultAges:[37,39],childrenAges:[7],rooms:2,roomAllocations:allocations},now=new Date().toISOString(),key='www.booking.com/hotel/ca/test.html';
 const evidence={status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,individualAgesEchoed:false,requestedAdultAges:[37],requestedChildrenAges:[7]};
 const base=hotel('CAD 300.00'),h={...base,provider:'booking',source:'Booking.com via api-anything',occupancyEvidence:{status:'separate_room_count_matches',individualAgesEchoed:false,rooms:[{room:1,...evidence},{room:2,...evidence}]},url:`https://${key}`,officialEvidence:undefined,priceText:'CAD 300.00',locationEvidence:{...base.locationEvidence,propertyKey:key},stay:{...base.stay,rooms:2,adults:2,adultAges:[37,39],childrenAges:[7],roomAllocations:allocations},roomQuotes:[
  {room:1,priceText:'CAD 120.00',url:`https://${key}`,observedAt:now,adultAges:[37],childrenAges:[7],occupancyEvidence:evidence},
  {room:2,priceText:'CAD 180.00',url:`https://${key}`,observedAt:now,adultAges:[39],childrenAges:[],occupancyEvidence:{...evidence,requestedAdultAges:[39],requestedChildrenAges:[]}},
 ]};
 assert.equal(compareFlightHotel(trip,h,q),null,'children’s age-specific hotel price cannot be combined when listing text did not echo ages');
 assert.equal(compareFlightHotel(trip,{...h,roomQuotes:[h.roomQuotes[0],{...h.roomQuotes[1],url:'https://www.booking.com/hotel/ca/other.html'}]},q),null);
});

test('Booking.com Demand API exact child-room products support one-request Flight + Hotel subtotal',async()=>{
 const travelers=[{id:'adult-1',birthDate:'1990-01-01'},{id:'adult-2',birthDate:'1988-02-01'},{id:'child',birthDate:'2020-04-16',guardianId:'adult-1'}];
 const trip={...flight,query:{travelers,date:'2027-04-15'}},allocations=[{adultAges:[37],childrenAges:[7]},{adultAges:[39],childrenAges:[]}];
 const q={...query,adults:2,adultAges:[37,39],childrenAges:[7],rooms:2,roomAllocations:allocations,hotelSource:'booking-demand'};
 const property={id:101,accommodation_status:'open',name:{'en-ca':'Test Hotel'},rating:{stars:4,stars_type:'official'},location:{city:-2140479,country:'ca'},url:'https://www.booking.com/hotel/ca/test-hotel.html'};
 const row={id:101,currency:'CAD',price:{book:300,total:330,extra_charges:{included:30,excluded:0,conditional:[]}},products:[{number_of_adults:1,children:[7],price:{total:210,extra_charges:{conditional:[]}}},{number_of_adults:1,children:[],price:{total:120,extra_charges:{conditional:[]}}}],url:property.url};let productRows=row.products;
 const fetcher=async(url,options)=>{const path=new URL(url).pathname,body=JSON.parse(options.body);let data;if(path.endsWith('/common/autocomplete'))data=[{id:-2140479,type:'city',name:'Montréal'}];else if(path.endsWith('/accommodations/search')){assert.deepEqual(body.guests.allocation,[{number_of_adults:1,children:[7]},{number_of_adults:1,children:[]}]);data=[{...row,products:productRows}];}else data=[property];return new Response(JSON.stringify({data}),{status:200,headers:{'content-type':'application/json'}});};
 const result=await searchBooking({airport:'YUL',bookerCountry:'ca',checkin:q.checkin,checkout:q.checkout,adults:q.adults,adultAges:q.adultAges,rooms:q.rooms,childrenAges:q.childrenAges,roomAllocations:allocations,minStars:4},{token:'fixture-token',affiliateId:'12',fetcher,destination:{...destination,bookingCityId:-2140479}});
 assert.equal(result.offers.length,1);const demandHotel=result.offers[0];assert.equal(demandHotel.source,'Booking.com Demand API');assert.equal(demandHotel.priceText,'CAD 330.00');
 const comparison=compareFlightHotel(trip,demandHotel,{...q,destination});
 assert.equal(comparison.hotelAmount,330);assert.equal(comparison.subtotal,1530);assert.equal(comparison.perTraveler,510);assert.equal(comparison.rooms,2);assert.equal(comparison.roomSetObservedTogether,true);assert.equal(comparison.simultaneousRoomsVerified,false);
 assert.match(demandHotel.taxText,/expected total: CAD 330.00.*included charges CAD 30.00/i);assert.match(demandHotel.taxText,/No conditional charges were listed in the search response/i);
 assert.equal(compareFlightHotel(trip,{...demandHotel,occupancyEvidence:{...demandHotel.occupancyEvidence,observedRoomProducts:[{adults:1,childrenAges:[6]},{adults:1,childrenAges:[]}]}},{...q,destination}),null);
 assert.equal(compareFlightHotel(trip,{...demandHotel,occupancyEvidence:{...demandHotel.occupancyEvidence,productTotalsCents:[22000,12000]}},{...q,destination}),null);
 productRows=[row.products[0],{...row.products[1],price:{...row.products[1].price,total:119.99}}];
 const roundedDemand=await searchBooking({airport:'YUL',bookerCountry:'ca',checkin:q.checkin,checkout:q.checkout,adults:q.adults,adultAges:q.adultAges,rooms:q.rooms,childrenAges:q.childrenAges,roomAllocations:allocations,minStars:4},{token:'fixture-token',affiliateId:'12',fetcher,destination:{...destination,bookingCityId:-2140479}});
 assert.equal(roundedDemand.offers.length,1);assert.equal(roundedDemand.offers[0].occupancyEvidence.productTotalsMatchExpectedTotal,false,'a one-cent product/total difference is not exact evidence');
 assert.equal(compareFlightHotel(trip,roundedDemand.offers[0],{...q,destination}),null,'a one-cent product/total difference cannot support a combined subtotal');
});

test('Booking.com adult-only multi-room observations can subtotal only after every room count matches',()=>{
 const trip={...flight},allocations=[{adultAges:[37],childrenAges:[]},{adultAges:[39],childrenAges:[]}],q={...query,adults:2,adultAges:[37,39],childrenAges:[],rooms:2,roomAllocations:allocations},now=new Date().toISOString(),key='www.booking.com/hotel/ca/test.html';
 const countEvidence=(adultAges)=>({status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,individualAgesEchoed:false,requestedAdultAges:adultAges,requestedChildrenAges:[]});
 const h={...hotel('CAD 300.00'),provider:'booking',source:'Booking.com via api-anything',url:`https://${key}`,priceText:'CAD 300.00',locationEvidence:{...hotel().locationEvidence,propertyKey:key},stay:{...hotel().stay,rooms:2,adults:2,adultAges:[37,39],childrenAges:[],roomAllocations:allocations},occupancyEvidence:{status:'separate_room_count_matches',individualAgesEchoed:false,rooms:[{room:1,...countEvidence([37])},{room:2,...countEvidence([39])}]},roomQuotes:allocations.map((room,index)=>({room:index+1,priceText:index?'CAD 180.00':'CAD 120.00',url:`https://${key}`,observedAt:now,...room,occupancyEvidence:countEvidence(room.adultAges)}))};
 assert.equal(compareFlightHotel(trip,h,q)?.subtotal,1500);
 assert.equal(compareFlightHotel(trip,{...h,occupancyEvidence:{...h.occupancyEvidence,rooms:[h.occupancyEvidence.rooms[0],{...h.occupancyEvidence.rooms[1],adultsMatched:false}]}},q),null);
});
