import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),flightInput={};let comparisonInput;
 await page.route('**/api/airports',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
 await page.route('**/api/search/jobs',async route=>{
  const body=route.request().postDataJSON();
  if(body.action==='start'&&body.kind==='flight'){
   Object.assign(flightInput,body.input);
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000101',status:'queued',kind:'flight',input:body.input})});
  }
  if(body.action==='status'&&body.id==='00000000-0000-0000-0000-000000000101'){
   const now=new Date().toISOString(),leg=(from,to,number)=>({marketing_carrier_code:'AC',flight_number:number,departure_airport:from,arrival_airport:to,departure_time_utc:'2026-12-15T08:00:00Z',arrival_time_utc:'2026-12-15T09:00:00Z',departure_time_local:'2026-12-15T08:00:00',arrival_time_local:'2026-12-15T09:00:00'});
   const offer={provider:'Ignav',source:'Ignav',from:'YHZ',to:'BCN',itineraryKey:'ui-test-itinerary',ignavId:'fare_ui_test',price:500,currency:'CAD',cabin:'economy',observedAt:now,expiresAt:new Date(Date.now()+60000).toISOString(),segments:[leg('YHZ','YUL','100'),leg('YUL','BCN','200')],via:['YUL'],airlines:['AC'],fees:'Fees as shown by provider'};
   const originAirports=[{code:'YHZ'},...Array.from({length:99},(_,index)=>({code:`A${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`}))];
   const destinationAirports=[{code:'BCN'},...Array.from({length:99},(_,index)=>({code:`C${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`}))];
   const result={query:flightInput,offers:[offer],sources:[],observedAt:now,locationResolution:{origin:{airports:originAirports},destination:{airports:destinationAirports}}};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'flight',input:flightInput,result})});
  }
  if(body.action==='start'&&body.kind==='comparison'){
   comparisonInput=body.input;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000102',status:'queued',kind:'comparison',input:body.input})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'queued',kind:body.kind,input:body.input})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const form=page.locator('.search form').nth(1);
 await page.getByLabel('From',{exact:true}).fill('YHZ');await page.getByLabel('To',{exact:true}).fill('BCN');
 await page.locator('#originType').selectOption('place');await page.locator('#destinationType').selectOption('place');
 await form.locator('input[type=date]').first().fill('2026-12-15');
 await form.locator('input[type=number]').nth(0).fill('1');await form.locator('input[type=number]').nth(1).fill('0');
 await form.getByRole('button',{name:/Search flights/}).click();
 await page.getByRole('button',{name:'Compare separate segment tickets'}).waitFor({timeout:10000});
 const routeLimit=page.getByLabel('Alternate airport pairs');
 assert.equal(await routeLimit.inputValue(),'8');await routeLimit.selectOption('12');
 assert.match(await page.locator('.booking-options').filter({hasText:'Itinerary selected for refresh'}).innerText(),/Up to 12 additional pairs/);
 const compareRequest=page.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname==='/api/search/jobs'&&request.postDataJSON()?.kind==='comparison',{timeout:10000});
 await page.getByRole('button',{name:'Compare separate segment tickets'}).click();
 const requestBody=(await compareRequest).postDataJSON();comparisonInput=requestBody.input;
 assert.equal(comparisonInput.routeSearchLimit,12);
 assert.equal(comparisonInput.searchLimit,100);
 assert.equal(comparisonInput.routePairs.length,400);assert.equal(new Set(comparisonInput.routePairs.map(pair=>`${pair.origin}:${pair.destination}`)).size,400);
 assert.equal(comparisonInput.routePairs.some(pair=>pair.origin==='YHZ'&&pair.destination==='BCN'),false);
 assert.match(await page.locator('.booking-options').filter({hasText:'Itinerary selected for refresh'}).innerText(),/9999 exact airport-pair candidates were ranked; 9599 beyond the 400-pair request cap were omitted/);
 console.log(JSON.stringify({ui:'route-search-settings',defaultPairs:8,selectedPairs:comparisonInput.routeSearchLimit,airportCandidatesPerSide:100,airportPairsProvided:comparisonInput.routePairs.length,omittedCandidatePairs:9599,providerRequestIntercepted:true}));
}finally{await browser.close();}
