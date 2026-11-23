import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();let payload=null,jobSequence=0;const browserErrors=[];page.on('pageerror',error=>browserErrors.push(error.message));
 await page.route('**/api/airports',route=>route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));
 await page.route('**/api/search/jobs',route=>{
  const body=route.request().postDataJSON();if(body.action==='start'){payload=body;const id=`00000000-0000-4000-8000-${String(++jobSequence).padStart(12,'0')}`;return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({id,status:'queued',kind:'hotel',ownerToken:body.ownerToken})});}
  const input=payload.input,now=new Date().toISOString(),propertyKey='www.booking.com/hotel/ca/example.html',evidence={status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,individualAgesEchoed:false};
  if(input.rooms===1){
   const adultAges=input.adultAges??[35],childrenAges=input.childrenAges??[],offer={name:'Example Hotel',stars:4,priceText:'CAD 180.00',currency:'CAD',provider:'booking',url:`https://${propertyKey}`,source:'Booking.com via api-anything',observedAt:now,stayText:'4 nights · 2 adults · 1 child',occupancyEvidence:{...evidence,requestedAdultAges:adultAges,requestedChildrenAges:childrenAges},stay:{checkin:input.checkin,checkout:input.checkout,nights:4,rooms:1,adults:input.adults,adultAges,childrenAges},taxText:'Taxes and fees are not included in this test observation.'};
   const sourceResults=[{provider:'Booking.com browser search',status:'observed',observations:2,accepted:1,rejected:1}];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'hotel',ownerToken:'fixture-owner',result:{offers:[offer],received:2,rejected:1,query:{...input,destination:{city:'London',cityId:'Q84',countryCode:'GB',airport:null}},sourceResults,coverage:{scope:'visible_first_page',listingsObserved:2,accepted:1,rejected:1,furtherPagesSearched:false,inventoryCompleteness:'partial'},limitation:'Visible first-page observations only. No conclusion that the property has no inventory.'}})});
  }
  const offer={name:'Example Hotel',stars:4,priceText:'CAD 300.00',currency:'CAD',provider:'booking',url:`https://${propertyKey}`,source:'Booking.com via api-anything',observedAt:now,stayText:'4 nights · 2 separately quoted rooms · 2 adults · 1 child',occupancyEvidence:{status:'separate_room_count_matches',individualAgesEchoed:false,rooms:[{room:1,...evidence},{room:2,...evidence}]},stay:{checkin:input.checkin,checkout:input.checkout,nights:4,rooms:2,adults:2,adultAges:[35,39],childrenAges:[7],roomAllocations:input.roomAllocations},roomQuotes:[{room:1,priceText:'CAD 120.00',url:`https://${propertyKey}`,observedAt:now,adultAges:[35],childrenAges:[7],occupancyEvidence:evidence,propertyKey},{room:2,priceText:'CAD 180.00',url:`https://${propertyKey}`,observedAt:now,adultAges:[39],childrenAges:[],occupancyEvidence:evidence,propertyKey}],bookingStatus:'Separate room quotes; simultaneous availability unverified.',taxText:'Taxes and fees are not included in this test observation.'};
  const sourceResults=[{provider:'Booking.com browser search',room:1,status:'observed',observations:3,acceptedForSameProperty:1},{provider:'Booking.com browser search',room:2,status:'observed',observations:2,acceptedForSameProperty:1}];
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'hotel',ownerToken:'fixture-owner',result:{offers:[offer],received:2,rejected:0,query:{...input,destination:{city:'London',cityId:'Q84',countryCode:'GB',airport:null}},sourceResults,limitation:'Separate room quotes; simultaneous availability and final charges remain unverified.'}})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const section=page.locator('section.search.hotels').first();
 await section.getByLabel('City',{exact:true}).fill('London');
 await section.getByLabel('Check-in',{exact:true}).fill('2027-05-10');
 await section.getByLabel('Check-out',{exact:true}).fill('2027-05-14');
 await section.getByLabel('Rooms',{exact:true}).fill('2');
 const room1=section.locator('fieldset').nth(0),room2=section.locator('fieldset').nth(1);
 await room1.getByLabel('Adult ages').fill('35');await room1.getByLabel('Child ages at check-in').fill('7');
 await room2.getByLabel('Adult ages').fill('39');await room2.getByLabel('Child ages at check-in').fill('');
 await section.getByLabel('Hotel price sources').selectOption('booking');
 await section.getByRole('button',{name:'Search stays'}).click();
 await section.getByText(/1 accepted observations/).waitFor({timeout:5000});
 assert.equal(payload?.kind,'hotel');assert.equal(payload.input.hotelSource,'booking');
 assert.equal(payload.input.adults,2);assert.deepEqual(payload.input.adultAges,[35,39]);assert.deepEqual(payload.input.childrenAges,[7]);
 assert.deepEqual(payload.input.roomAllocations,[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]);
 const offer=section.locator('article.offer').first();
 assert.match(await offer.innerText(),/CAD 300\.00/);assert.match(await offer.innerText(),/Room 1: CAD 120\.00/);assert.match(await offer.innerText(),/Room 2: CAD 180\.00/);
 assert.match(await offer.innerText(),/listing text confirms guest counts, not individual ages/i);assert.match(await offer.innerText(),/requested adult ages 35/);
 assert.match(await offer.innerText(),/Flight \+ Hotel subtotal is withheld because the listing did not echo the children’s exact ages/i);
 assert.match(await section.innerText(),/Booking\.com browser search: observed · 3 observed · 1 matched same property/);
 assert.match(await section.innerText(),/simultaneous availability and final charges remain unverified/i);
 await page.reload({waitUntil:'domcontentloaded'});
 await section.getByLabel('City',{exact:true}).fill('London');
 await section.getByLabel('Check-in',{exact:true}).fill('2027-05-10');
 await section.getByLabel('Check-out',{exact:true}).fill('2027-05-14');
 await section.getByLabel('Adults',{exact:true}).fill('2');
 await section.getByLabel('Children’s ages at check-in',{exact:true}).fill('7');
 await section.getByRole('button',{name:'Search stays'}).click();
 try{await section.getByText(/2 observed · 1 accepted · 1 rejected/).waitFor({timeout:5000});}
 catch(error){console.log(JSON.stringify({singleRoomPayload:payload,sectionText:await section.innerText(),browserErrors}));throw error;}
 assert.equal(payload.input.rooms,1);assert.equal(payload.input.roomAllocations,undefined);assert.equal(payload.input.adults,2);assert.deepEqual(payload.input.childrenAges,[7]);
 assert.match(await section.innerText(),/visible first-page observations only/i);
 assert.match(await section.innerText(),/Booking\.com browser search: observed · 2 observed · 1 accepted · 1 rejected/);
 assert.deepEqual(browserErrors,[]);
 console.log(JSON.stringify({ui:'hotel-source-coverage',multiRoom:{rooms:2,adultAges:[35,39],childAges:[7],combinedDisplay:'CAD 300.00',perRoomPrices:['CAD 120.00','CAD 180.00'],samePropertyCountsVisible:true},singleRoom:{rooms:1,firstPageOnly:true,observed:2,accepted:1,rejected:1},providerRequestsIntercepted:true,browserErrors:browserErrors.length}));
}finally{await browser.close();}
