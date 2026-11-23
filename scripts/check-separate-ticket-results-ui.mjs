import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),pageErrors=[];let flightInput,comparisonInput,comparisonOwner;
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
 await page.route('**/api/airports',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
 await page.route('**/api/search/jobs',async route=>{
  const body=route.request().postDataJSON(),now=new Date().toISOString(),expiresAt=new Date(Date.now()+60000).toISOString();
  const leg=(from,to,number,depart,arrive)=>({marketing_carrier_code:'AC',flight_number:number,departure_airport:from,arrival_airport:to,departure_time_utc:depart,arrival_time_utc:arrive,departure_time_local:depart.slice(0,19),arrival_time_local:arrive.slice(0,19)});
  const outbound=[leg('YHZ','YUL','100','2026-12-15T08:00:00Z','2026-12-15T09:00:00Z'),leg('YUL','BCN','200','2026-12-15T13:00:00Z','2026-12-15T21:00:00Z')];
  if(body.action==='start'&&body.kind==='flight'){
   flightInput=body.input;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000301',status:'queued',kind:'flight',input:flightInput})});
  }
  if(body.action==='status'&&body.id==='00000000-0000-0000-0000-000000000301'){
   const offer={provider:'Ignav',source:'Ignav',from:'YHZ',to:'BCN',itineraryKey:'ui-test-itinerary',ignavId:'fare_ui_test',price:600,currency:'CAD',cabin:'economy',observedAt:now,expiresAt,segments:outbound,via:['YUL'],airlines:['AC'],fees:'Fees as shown by provider'};
   const result={query:flightInput,offers:[offer],sources:[],observedAt:now,locationResolution:{origin:{airports:[{code:'YHZ'},{code:'YUL'}]},destination:{airports:[{code:'BCN'},{code:'LAX'}]}}};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'flight',input:flightInput,result})});
  }
  if(body.action==='start'&&body.kind==='comparison'){
   comparisonInput=body.input;comparisonOwner=body.ownerToken;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000302',status:'queued',kind:'comparison',input:comparisonInput})});
  }
  if(body.action==='status'&&body.id==='00000000-0000-0000-0000-000000000302'){
   const result={status:'observed',tripType:'one-way',limitation:'Fixture quote evidence; simultaneous inventory and seller issuance remain unverified.',coverage:{fareRequestsStarted:3,responsesReused:0,uniqueTicketBlocks:2,pricedTicketBlocks:2,completePlans:1,eligibleTicketPartitions:1},ticketBlockCoverage:[{direction:'outbound',segmentStart:1,segmentEnd:1,status:'priced',exactFlights:[{carrier:'AC',flight:'100',from:'YHZ',to:'YUL',departureAt:outbound[0].departure_time_utc,arrivalAt:outbound[0].arrival_time_utc}],fareRequests:1,qualifyingQuotes:1,responses:[{sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}]}]},{direction:'outbound',segmentStart:2,segmentEnd:2,status:'unpriced',exactFlights:[{carrier:'AC',flight:'200',from:'YUL',to:'BCN',departureAt:outbound[1].departure_time_utc,arrivalAt:outbound[1].arrival_time_utc}],fareRequests:1,qualifyingQuotes:0,responses:[{sources:[{provider:'Ignav',status:'ok',received:5,accepted:5}]}]}],routeAlternativeCoverage:{matchingAlternatives:0,alternativesShown:0,providerCompletionKnown:true,providerReportedComplete:true,scope:'bounded_resolved_airport_pairs',alternateAirportPairsPlanned:3,alternateAirportPairsAttempted:3,alternateAirportPairsAttemptedList:[{origin:'YHZ',destination:'LAX'},{origin:'YUL',destination:'BCN'},{origin:'YUL',destination:'LAX'}],alternateAirportPairsSearched:3,alternateAirportPairsSearchedList:[{origin:'YHZ',destination:'LAX'},{origin:'YUL',destination:'BCN'},{origin:'YUL',destination:'LAX'}],alternateAirportPairsStoppedList:[],alternateAirportPairsNotSearched:[],exhaustive:false},baseline:{price:600,currency:'CAD',observedAt:now,expiresAt,itineraryKey:'ui-test-itinerary'},plans:[{price:350,currency:'CAD',observedAt:now,expiresAt,differenceBeforeExtras:250,comparison:'lower_before_extras',connectionsMinutes:[240],tickets:[{direction:'outbound',segment:1,segmentEnd:1,adults:1,price:100,currency:'CAD',cabin:'economy',ignavId:'fare_block_1',observedAt:now,expiresAt,segments:[outbound[0]]},{direction:'outbound',segment:2,segmentEnd:2,adults:1,price:250,currency:'CAD',cabin:'economy',ignavId:'fare_block_2',observedAt:now,expiresAt,segments:[outbound[1]]}]}]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'comparison',input:comparisonInput,result})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'queued',kind:body.kind,input:body.input})});
 });
 let handoffRequest;
 await page.route('**/api/search/booking-links',async route=>{
  handoffRequest=route.request().postDataJSON();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'handoff_unpriced',itineraryMatch:'matched',coverageStatus:'complete',expectedCoverage:['outbound'],coveredCoverage:['outbound'],bookingOptions:[{legs:['outbound'],legIndexes:[],links:[{provider:'Air Canada',url:'https://aircanada.com/book',specificity:'exact_flight'}]}],linkedPriceEvidenceStatus:'not_provided',sellerAvailabilityStatus:'not_checked',bookingStatus:'not_booked',observedAt:new Date().toISOString(),baggage:null,mandatoryChargesStatus:'not_itemized',limitation:'Fixture seller links only; availability not checked.'})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const themeToggle=page.locator('.theme-toggle'),initialTheme=await themeToggle.getAttribute('aria-pressed');
 await themeToggle.click();await page.waitForFunction(value=>document.querySelector('.theme-toggle')?.getAttribute('aria-pressed')!==value,initialTheme);
 await themeToggle.click();await page.waitForFunction(value=>document.querySelector('.theme-toggle')?.getAttribute('aria-pressed')===value,initialTheme);
 const form=page.locator('form').filter({has:page.locator('input[placeholder="Airport or city"]')});
 await form.getByLabel('To',{exact:true}).fill('BCN');
 await page.locator('#originType').selectOption('place');await page.locator('#destinationType').selectOption('place');
 await form.locator('input[type=date]').first().fill('2026-12-15');
 await form.locator('input[type=number]').nth(0).fill('1');await form.locator('input[type=number]').nth(1).fill('0');
 await form.getByRole('button',{name:/Search flights/}).click();
 try{await page.getByRole('button',{name:'Compare separate segment tickets'}).waitFor({timeout:10000});}
 catch(error){console.error(JSON.stringify({flightInput,formCount:await page.locator('.search form').count(),fields:await form.locator('input').evaluateAll(items=>items.map(item=>({type:item.type,value:item.value,required:item.required,valid:item.checkValidity()}))),resultText:await page.locator('.results').innerText()}));throw error;}
 await page.getByRole('button',{name:'Compare separate segment tickets'}).click();
 const result=page.locator('.booking-options').filter({hasText:'Refreshed itinerary CAD 600'});
 await result.waitFor({timeout:10000});
 assert.match(await result.innerText(),/economy · CAD 100/);
 assert.match(await result.innerText(),/Verified flight block: AC 100 YHZ 2026-12-15T08:00:00Z → YUL 2026-12-15T09:00:00Z/);
 assert.match(await result.innerText(),/Verified flight block: AC 200 YUL 2026-12-15T13:00:00Z → BCN 2026-12-15T21:00:00Z/);
 assert.match(await result.innerText(),/Ticket block coverage \(1 priced, 0 partial, 1 unpriced, 0 not searched\)/);
 await result.getByText('Ticket block coverage (1 priced, 0 partial, 1 unpriced, 0 not searched)').click();
 assert.match(await result.innerText(),/Ignav: ok \(5\/5\)/);
 assert.equal(comparisonInput.cabin,'economy');
 assert.equal(comparisonInput.routePairs.length,3);
 assert.match(await result.innerText(),/3 of 3 additional resolved airport pairs returned responses without a provider stop \(YHZ–LAX, YUL–BCN, YUL–LAX\)/);
 await result.getByRole('button',{name:'Load provider handoff links'}).first().click();
 await result.getByText(/Selected ticket block match: matched/).waitFor({timeout:5000});
 assert.equal(handoffRequest.ignavId,'fare_block_1');assert.equal(handoffRequest.ownerToken,comparisonOwner);
 assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({ui:'separate-ticket-results',verifiedCabin:'economy',exactFlightSegments:['AC 100 YHZ–YUL','AC 200 YUL–BCN'],comparisonOwnerHandedToExactTicketLookup:true,providerAndJobRequestsIntercepted:true,externalRequestsBlocked:true,pageErrors:pageErrors.length}));
}finally{await browser.close();}
