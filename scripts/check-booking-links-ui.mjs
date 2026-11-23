import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),errors=[],unexpected=[],started=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
  if(url.pathname==='/api/search/jobs'){
   const body=route.request().postDataJSON();
   if(body.action==='start'){
    started.push(body);
    return route.fulfill({status:202,json:{id:'00000000-0000-4000-8000-000000000401',kind:'flight',status:'queued'}});
   }
   assert.equal(body.action,'status');
   const query=started[0].input;
   const segment={marketing_carrier_code:'AC',flight_number:'123',departure_airport:'YHZ',departure_time_local:`${query.date}T08:00:00-03:00`,departure_time_utc:`${query.date}T11:00:00Z`,arrival_airport:'YYZ',arrival_time_local:`${query.date}T10:00:00-04:00`,arrival_time_utc:`${query.date}T14:00:00Z`};
   const offer={ignavId:'fare_12345678',provider:'Ignav',source:'Controlled handoff UI fixture',price:900,currency:'CAD',travelers:'1 adult',cabin:'economy',from:'YHZ',to:'YYZ',airlines:['Air Canada'],departureDate:query.date,departureTime:'08:00',arrivalDate:query.date,arrivalTime:'10:00',durationMinutes:120,via:[],segments:[segment],observedAt:new Date().toISOString(),bookingStatus:'Provider observation',fees:'Unknown'};
   const mismatchedOffer={...offer,ignavId:'fare_87654321',price:901,segments:[{...segment,flight_number:'999'}]};
   return route.fulfill({json:{id:body.id,kind:'flight',input:query,status:'complete',result:{query,observedAt:new Date().toISOString(),offers:[offer,mismatchedOffer],priceObservations:[],sources:[],complete:false}}});
  }
  if(url.pathname==='/api/search/booking-links'){
   const body=route.request().postDataJSON();
   assert.equal(body.ownerToken,started[0].ownerToken);
   if(body.ignavId==='fare_12345678')return route.fulfill({json:{status:'priced_handoff',itineraryMatch:'matched',linkedPriceEvidenceStatus:'provider_reported_verified',linkedPriceFreshnessStatus:'unknown',providerResponseFreshnessStatus:'unknown',sellerAvailabilityStatus:'not_checked',bookingStatus:'not_booked',observedAt:null,coverageStatus:'complete',expectedCoverage:['outbound'],coveredCoverage:['outbound'],itinerary:{price:{amount:900,currency:'CAD',status:'verified'},bags:null},baggage:null,mandatoryChargesStatus:'not_itemized',bookingOptions:[{legs:['outbound'],legIndexes:[],links:[{provider:'Air Canada',host:'www.aircanada.com',type:'airline',specificity:'unknown',url:'https://www.aircanada.com/',price:{amount:900,currency:'CAD',status:'verified'}}]}],limitation:'Ignav price verification is provider-reported, not seller checkout or a reservation.'}});
   assert.equal(body.ignavId,'fare_87654321');
   return route.fulfill({json:{status:'itinerary_mismatch',itineraryMatch:'mismatch',linkedPriceEvidenceStatus:'not_provided',sellerAvailabilityStatus:'not_checked',bookingStatus:'not_booked',observedAt:null,coverageStatus:'unknown',expectedCoverage:['outbound'],coveredCoverage:[],itinerary:{},baggage:null,bookingOptions:[],limitation:'Ignav returned a different itinerary from the stored search result. Seller links were suppressed.'}});
  }
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{items:[]}});
  return route.continue();
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const form=page.locator('.search form').nth(1);
 await form.getByLabel('To',{exact:true}).fill('YYZ');
 await form.getByLabel('Departure',{exact:true}).fill('2099-11-12');
 await form.getByLabel('Adults',{exact:true}).fill('1');
 await form.getByLabel('Children and youths (ages 2–17)',{exact:true}).fill('0');
 const completed=page.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname==='/api/search/jobs'&&request.postDataJSON()?.action==='start');
 await form.getByRole('button',{name:/^Search flights/}).click();
 await completed;
 const cards=page.locator('article.offer');
 const matching=cards.nth(0).locator('.booking-options');
 await matching.getByRole('button',{name:'Load provider handoff links'}).click();
 await matching.getByText(/Original search itinerary match: matched\. The provider-returned flights and cabin match the stored selection\./).waitFor();
 await matching.getByText(/Seller handoff: linked price evidence has provider-reported verified status; seller checkout not verified\. Linked price freshness: not established\. Seller availability: not checked\. Booking status: not booked/).waitFor();
 await matching.getByText(/Provider response timestamp: not supplied; response freshness: not established\. This timestamp applies to the handoff response, not an individual seller link price/).waitFor();
 await matching.getByText(/Ignav itinerary price: CAD 900 \(provider status: verified; may be the earlier search quote\)/).waitFor();
 await matching.getByText(/Option 1 covers: outbound/).waitFor();
 await matching.getByRole('link',{name:/Air Canada/}).waitFor();
 await matching.getByRole('link',{name:/Air Canada \(www\.aircanada\.com\)/}).waitFor();
 await matching.getByText(/CAD 900 for this option \(provider status: verified; freshness not established\)/).waitFor();
 await matching.getByText(/Mandatory charges: not itemized in this response/).waitFor();
 const mismatch=cards.nth(1).locator('.booking-options');
 await mismatch.getByRole('button',{name:'Load provider handoff links'}).click();
 await mismatch.getByText(/Original search itinerary match: mismatch\. The flights or cabin differ; seller links were suppressed\./).waitFor();
 assert.equal(await mismatch.locator('a').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({ui:'booking-handoff-matched-price-and-mismatch',savedOfferOwnerTokenUsed:true,providerPriceAndScopeVisible:true,sellerHostVisible:true,availabilityAndBookingCaveatsVisible:true,mandatoryChargesCaveatVisible:true,mismatchExplained:true,mismatchedSellerLinksSuppressed:true,browserErrors:errors.length,externalRequestsBlocked:true}));
}finally{await browser.close();}
