// Controlled end-to-end UI check. All provider traffic is intercepted; fixture data cannot reach production adapters.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the loopback application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),starts=[],jobs=new Map(),errors=[],unexpected=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
  if(url.pathname==='/api/health')return route.fulfill({json:{status:'ok'}});
  if(url.pathname!=='/api/search/jobs')return route.continue();
  const body=request.postDataJSON();
  if(body.action==='start'){
   starts.push(body);const id=`00000000-0000-0000-0000-${String(starts.length).padStart(12,'0')}`;
   jobs.set(id,{id,kind:body.kind,input:body.input});return route.fulfill({status:202,json:{id,kind:body.kind,status:'queued',ownerToken:'fixture-owner'}});
  }
  const job=jobs.get(body.id);assert.ok(job,'Status must refer to a started intercepted job.');
  const now=new Date().toISOString();
  if(job.kind==='flight'){
   const query={...job.input,tripType:'round-trip',start:'2027-04-15',returnStart:'2027-04-20'};
   const offer={provider:'Controlled QA fixture',source:'Test fixture; not a fare',price:1200,currency:'CAD',travelers:'2 adults, 1 child',cabin:'economy',from:'YHZ',to:'YUL',airlines:['Air Canada'],departureDate:'2027-04-15',departureTime:'08:00',arrivalDate:'2027-04-16',arrivalTime:'09:00',durationMinutes:1560,via:['YYZ'],segments:[{departure_airport:'YHZ',arrival_airport:'YYZ',flight_number:'AC601',marketing_carrier_code:'AC',departure_time_local:'2027-04-15T08:00:00-03:00',arrival_time_local:'2027-04-15T10:00:00-04:00',departure_time_utc:'2027-04-15T11:00:00Z',arrival_time_utc:'2027-04-15T14:00:00Z'},{departure_airport:'YYZ',arrival_airport:'YUL',flight_number:'AC401',marketing_carrier_code:'AC',departure_time_local:'2027-04-16T08:00:00-04:00',arrival_time_local:'2027-04-16T09:00:00-04:00',departure_time_utc:'2027-04-16T12:00:00Z',arrival_time_utc:'2027-04-16T13:00:00Z'}],inbound:{from:'YUL',to:'YHZ',departureDate:'2027-04-20',departureTime:'12:00',arrivalDate:'2027-04-20',arrivalTime:'15:00',durationMinutes:120,via:[],segments:[{departure_airport:'YUL',arrival_airport:'YHZ',flight_number:'AC601',marketing_carrier_code:'AC',departure_time_local:'2027-04-20T12:00:00-04:00',arrival_time_local:'2027-04-20T15:00:00-03:00',departure_time_utc:'2027-04-20T16:00:00Z',arrival_time_utc:'2027-04-20T18:00:00Z'}]},observedAt:now,bookingStatus:'Fixture only; no seller availability verified.',fees:'Test fixture'};
   const destinationScope={kind:'city',cityId:'Q340',region:{name:'Montréal',url:'https://www.wikidata.org/wiki/Q340'},airports:[{code:'YUL',name:'Montréal–Trudeau'}],method:'Controlled fixture city mapping'};
   return route.fulfill({json:{...job,status:'complete',ownerToken:'fixture-owner',result:{query,observedAt:now,offers:[offer],priceObservations:[],sources:[],locationResolution:{destination:destinationScope},complete:false}}});
  }
  assert.equal(job.kind,'hotel');
  assert.equal(job.input.hotelSource,'booking-demand');assert.equal(job.input.destinationAirport,'YUL');
  const allocations=[{adultAges:[37],childrenAges:[7]},{adultAges:[39],childrenAges:[]}];
  assert.deepEqual(job.input.roomAllocations,allocations);
  const destination={city:'Montréal',cityId:'Q340',countryCode:'CA',airport:'YUL'};
  const key='www.booking.com/hotel/ca/example-hotel.html';
  const offer={name:'Example Hotel',stars:4,starRatingType:'official',priceText:'CAD 330.00',displayPriceText:'CAD 300.00',currency:'CAD',provider:'booking',url:`https://${key}`,source:'Booking.com Demand API',observedAt:now,stayText:'4 nights · 2 rooms · 2 adults · 1 child',stay:{checkin:'2027-04-16',checkout:'2027-04-20',nights:4,rooms:2,adults:2,adultAges:[37,39],childrenAges:[7],roomAllocations:allocations},occupancyEvidence:{status:'provider_product_allocation_match',roomsRequested:2,requestedRoomAllocations:allocations,observedRoomProducts:[{adults:1,childrenAges:[7]},{adults:1,childrenAges:[]}],adultCountsEchoed:true,adultAgesEchoed:false,childAgesEchoed:true,productsMatchedRequestedAllocations:true,productTotalsCents:[21000,12000],expectedTotalCents:33000,productTotalsMatchExpectedTotal:true,expectedTotalIncludesNonConditionalCharges:true},taxText:'Booking.com display price: CAD 300.00; expected total: CAD 330.00 (included charges CAD 30.00, excluded/non-conditional charges CAD 0.00). Included: charge ID 21, percentage: CAD 30.00; provider marks chargeable online yes. Excluded: none reported. Conditional: charge ID 3, per stay, condition 28: amount unavailable; provider marks chargeable online no. Conditional or incalculable charges may apply; this response did not provide their complete amounts.',cancellationText:'Cancellation policy supplied by test fixture.',bookingStatus:'Booking.com Demand API returned matching room products and an expected-total observation in one search response. Seller recheck required; conditional charges may apply. No booking was made.',locationEvidence:{status:'verified',city:'Montréal',countryCode:'CA',cityId:'Q340',airport:'YUL',hotelName:'Example Hotel',propertyKey:key,sourceUrl:`https://${key}`,observedAt:now}};
  return route.fulfill({json:{...job,status:'complete',ownerToken:'fixture-owner',result:{offers:[offer],received:1,rejected:0,query:{...job.input,destination},limitation:'Fixture result. Current availability and conditional charges remain unverified.'}}});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await page.getByLabel('To',{exact:true}).fill('YUL');
 await page.getByLabel('Trip type',{exact:false}).selectOption('round-trip');
 const form=page.getByRole('button',{name:/^Search flights/}).locator('xpath=ancestor::form[1]');
 await form.locator('input[type=date]').nth(0).fill('2027-04-15');await form.locator('input[type=date]').nth(1).fill('2027-04-20');
 await form.getByLabel(/Adults/).fill('2');await form.getByLabel(/Children and youths/).fill('1');await form.getByLabel(/Age at departure/).fill('7');
 await page.getByRole('button',{name:/^Search flights/}).click();
 const flightCard=page.locator('article.offer').first();await flightCard.waitFor();
 await flightCard.getByRole('button',{name:'+ Hotel',exact:true}).click();
 const section=page.locator('section.search.hotels').first();
 await section.getByLabel('City',{exact:true}).fill('Montréal');
 await section.getByLabel('Check-in',{exact:true}).fill('2027-04-16');await section.getByLabel('Check-out',{exact:true}).fill('2027-04-20');
 await section.getByLabel('Rooms',{exact:true}).fill('2');
 const room1=section.locator('fieldset').nth(0),room2=section.locator('fieldset').nth(1);
 await room1.getByLabel('Adult ages').fill('37');await room1.getByLabel('Child ages at check-in').fill('7');
 await room2.getByLabel('Adult ages').fill('39');await room2.getByLabel('Child ages at check-in').fill('');
 await section.getByLabel('Hotel price sources').selectOption('booking-demand');
 await section.getByRole('button',{name:'Search stays'}).click();
 await section.getByText(/1 accepted observations/).waitFor({timeout:10000});
 const card=section.locator('article.offer').first(),text=await card.innerText();
 assert.match(text,/Flight \+ hotel observed subtotal: CAD 1530\.00/);
 assert.match(text,/CAD 510\.00 average per traveler/);
 assert.match(text,/Room products and the expected hotel total were observed together in one Booking\.com Demand API response/);
 assert.match(text,/current availability is unverified/i);
 assert.match(text,/expected total including observed non-conditional charges; conditional charges may apply/i);
 assert.match(text,/Conditional or incalculable charges may apply; this response did not provide their complete amounts/i);
 assert.match(text,/charge ID 21, percentage: CAD 30\.00; provider marks chargeable online yes/i);
 assert.match(text,/charge ID 3, per stay, condition 28: amount unavailable; provider marks chargeable online no/i);
 assert.match(text,/Flight and hotel are separate purchases/i);
 assert.deepEqual(starts.map(item=>item.kind),['flight','hotel']);assert.equal(starts[1].input.rooms,2);assert.deepEqual(starts[1].input.childrenAges,[7]);
 assert.deepEqual(starts[0].input.childrenAges,[7]);assert.equal(Object.hasOwn(starts[0].input,'travelers'),false,'the selected flight is the count-based party whose actual hotel check-in age is entered below');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({ui:'flight-hotel-demand-multi-room',flightAndHotelSeparate:true,rooms:2,allocations:starts[1].input.roomAllocations,subtotal:'CAD 1530.00',perTraveler:'CAD 510.00',roomProductsObservedTogether:true,currentAvailability:'unverified',providerTrafficIntercepted:true,browserErrors:errors.length}));
}finally{await browser.close();}
