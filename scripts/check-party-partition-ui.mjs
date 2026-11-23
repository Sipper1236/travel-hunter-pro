import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),pageErrors=[];let flightInput,comparisonInput,comparisonId,comparisonStarts=0;
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
 await page.route('**/api/airports',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
 await page.route('**/api/search/jobs',async route=>{
  const body=route.request().postDataJSON(),now=new Date().toISOString(),expiresAt=new Date(Date.now()+60000).toISOString();
  if(body.action==='start'&&body.kind==='flight'){
   flightInput=body.input;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000401',status:'queued',kind:'flight',input:flightInput})});
  }
  if(body.action==='status'&&body.id==='00000000-0000-0000-0000-000000000401'){
   const leg={operating_carrier_code:'AC',operating_carrier_name:'Air Canada',marketing_carrier_code:'AC',flight_number:'100',departure_airport:'YHZ',arrival_airport:'YYZ',departure_time_utc:'2027-04-15T08:00:00Z',arrival_time_utc:'2027-04-15T09:00:00Z',departure_time_local:'2027-04-15T05:00:00',arrival_time_local:'2027-04-15T05:00:00'};
   const unidentifiedLeg={flight_number:'200',departure_airport:'YYZ',arrival_airport:'YUL',departure_time_utc:'2027-04-15T11:00:00Z',arrival_time_utc:'2027-04-15T12:00:00Z',departure_time_local:'2027-04-15T07:00:00',arrival_time_local:'2027-04-15T08:00:00'};
   const offer={provider:'Ignav',source:'Ignav',from:'YHZ',to:'YUL',itineraryKey:'party-ui-test',ignavId:'fare_party_ui_test',price:600,currency:'CAD',cabin:'economy',observedAt:now,expiresAt,segments:[leg,unidentifiedLeg],via:['YYZ'],airlines:['AC'],fees:'Fees as shown by provider'};
   const result={query:flightInput,offers:[offer],sources:[],observedAt:now,locationResolution:{origin:{airports:[{code:'YHZ'}]},destination:{airports:[{code:'YUL'}]}}};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'flight',input:flightInput,result})});
  }
  if(body.action==='start'&&body.kind==='comparison'){
   comparisonInput=body.input;
   comparisonStarts++;comparisonId=`00000000-0000-0000-0000-${String(401+comparisonStarts).padStart(12,'0')}`;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:comparisonId,status:'queued',kind:'comparison',input:comparisonInput})});
  }
  if(body.action==='status'&&body.id===comparisonId&&comparisonStarts>1){
   const result={status:'source_unavailable',limitation:'The source refused a later group query; no complete party comparison is available.',coverage:{fareRequestsStarted:2,responsesReused:0,requestBudget:8},plans:[]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'comparison',input:comparisonInput,result})});
  }
  if(body.action==='status'&&body.id===comparisonId){
   const [guardian,otherAdult,child]=flightInput.travelers;
   const result={status:'observed',tripType:'round-trip',limitation:'Fixture quote evidence; carrier fare eligibility, simultaneous inventory and seller issuance remain unverified.',coverage:{fareRequestsStarted:3,responsesReused:0,requestBudget:8},plans:[{itineraryKey:'party-ui-test',price:700,currency:'CAD',observedAt:now,expiresAt,selfTransfer:false,segments:[{departure_airport:'YHZ',arrival_airport:'YUL'}],inbound:{segments:[{departure_airport:'YUL',arrival_airport:'YHZ'}]},tickets:[{direction:'outbound',travelerIds:[guardian.id,child.id],price:400,currency:'CAD',ignavId:'fare_guardian_outbound',segments:[{departure_airport:'YHZ',arrival_airport:'YUL',departure_time_local:'2027-04-15T05:00:00'}]},{direction:'outbound',travelerIds:[otherAdult.id],price:150,currency:'CAD',ignavId:'fare_other_adult',segments:[{departure_airport:'YHZ',arrival_airport:'YUL'}]},{direction:'inbound',travelerIds:[guardian.id,child.id],price:150,currency:'CAD',ignavId:'fare_guardian_inbound',segments:[{departure_airport:'YUL',arrival_airport:'YHZ',departure_time_local:'2027-04-22T08:00:00'}]}]}]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'comparison',input:comparisonInput,result})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'queued',kind:body.kind,input:body.input})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const themeToggle=page.locator('.theme-toggle'),initialTheme=await themeToggle.getAttribute('aria-pressed');
 await themeToggle.click();await page.waitForFunction(value=>document.querySelector('.theme-toggle')?.getAttribute('aria-pressed')!==value,initialTheme);
 const form=page.locator('form').filter({has:page.locator('input[placeholder="Airport or city"]')});
 await form.getByLabel('To',{exact:true}).fill('YUL');
 await page.locator('#originType').selectOption('place');await page.locator('#destinationType').selectOption('place');
 const dates=form.locator('input[type=date]');await dates.nth(0).fill('2027-04-15');
 await form.getByLabel('Trip type').selectOption('round-trip');
 await form.locator('input[type="date"]').nth(1).waitFor({state:'visible'});
 await form.getByLabel('Return',{exact:true}).fill('2027-04-22');
 await form.getByLabel('Use birth dates and infant seating').check();
 const groups=form.getByRole('group',{name:/^Traveler /});
 await groups.nth(0).getByLabel('Birth date').fill('1987-01-01');
 await form.getByRole('button',{name:'Add traveler'}).click();
 await groups.nth(1).getByLabel('Birth date').fill('1988-02-02');
 await form.getByRole('button',{name:'Add traveler'}).click();
 await groups.nth(2).getByLabel('Birth date').fill('2017-04-16');
 await groups.nth(2).getByLabel('Guardian for a minor').selectOption({label:'Traveler 1'});
 await form.getByRole('button',{name:/Search flights/}).click();
 await page.getByRole('button',{name:'Compare split-party tickets'}).waitFor({timeout:10000});
 assert.equal(flightInput.travelers.length,3);
 await page.getByText('Price and source details').click();
 const offerDetails=page.locator('details').filter({has:page.locator('section[aria-label="Carrier child and youth guidance"]')});
 await offerDetails.waitFor({state:'visible',timeout:5000});
 const eligibilityText=await offerDetails.innerText();
 assert.match(eligibilityText,/Air Canada is identified in both operating and marketing roles \(operating on outbound segment 1/);
 assert.match(eligibilityText,/outbound segment 2 has marketing and operating carrier identities are missing/i,eligibilityText);
 await offerDetails.locator('summary').click();
 await page.getByRole('button',{name:'Compare split-party tickets'}).click();
 const comparison=page.locator('.coverage').filter({hasText:'Lowest same-flight booking plans'});
 await comparison.getByText(/Plan 1 · 3 bookings/).waitFor({timeout:10000});
 const text=await comparison.innerText();
 assert.match(text,/Traveler 1 · age 40 on ticket date 2027-04-15 · guardian for Traveler 3/);
 assert.match(text,/Traveler 3 · age 9 on ticket date 2027-04-15 · guardian Traveler 1 on this ticket/);
 assert.match(text,/Traveler 2 · age unavailable for this ticket’s departure dates/);
 assert.match(text,/Traveler 3 · age 10 on ticket date 2027-04-22 · guardian Traveler 1 on this ticket/);
 assert.match(text,/Carrier age categories, fare eligibility, and seller acceptance are not verified/);
 assert.doesNotMatch(text,/1987-01-01|1988-02-02|2017-04-16/);
 assert.equal(comparisonInput.travelers.length,3);
 assert.deepEqual(pageErrors,[]);
 await page.getByRole('button',{name:'Compare split-party tickets'}).click();
 const noPlan=page.locator('.coverage').filter({hasText:'No complete same-flight booking plan was priced'});
 try{await noPlan.waitFor({timeout:10000});}catch(error){console.log('party-partition QA state',JSON.stringify({starts:comparisonStarts,coverage:await page.locator('.coverage').allInnerTexts(),alerts:await page.locator('[role=alert]').allInnerTexts()}));throw error;}
 assert.match(await noPlan.innerText(),/The source refused a later group query; no complete party comparison is available\./);
 assert.doesNotMatch(await noPlan.innerText(),/No current exact-flight plans found/);
 assert.equal(comparisonStarts,2);
 assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({ui:'identified-party-partition',exactAgesRendered:true,guardianOnChildTicket:true,birthDatesHidden:true,carrierEligibilityUnverified:true,carrierRolesMappedToSegments:true,unidentifiedSegmentDisclosure:true,noPlanStatusDoesNotAssertInventory:true,providerAndJobRequestsIntercepted:true,externalRequestsBlocked:true,pageErrors:pageErrors.length}));
}finally{await browser.close();}
