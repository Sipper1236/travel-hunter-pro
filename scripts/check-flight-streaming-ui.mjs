import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[];page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push(error.message));
 let job,polls=0,finalResult;
 const segment=(from,to)=>({marketing_carrier_code:'AC',flight_number:'123',departure_airport:from,arrival_airport:to,departure_time_local:'2099-04-15T08:00:00',arrival_time_local:'2099-04-15T16:00:00',departure_time_utc:'2099-04-15T08:00:00Z',arrival_time_utc:'2099-04-15T16:00:00Z'});
 const offer=(price,observedAt)=>({provider:'Ignav',source:'Ignav live fare API',price,currency:'CAD',observedAt,travelers:'1 adult',bookingStatus:'Observed; seller not rechecked',fees:'Inclusions unverified',cabin:'economy',from:'YHZ',to:'LHR',departureDate:'2099-04-15',arrivalDate:'2099-04-15',departureTime:'08:00',arrivalTime:'16:00',durationMinutes:480,airlines:['Air Canada'],via:[],segments:[segment('YHZ','LHR')],ignavId:'stream_fixture_1234',itineraryKey:'stream-fixture'});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==base.origin){external.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
  if(url.pathname==='/api/airlines')return route.fulfill({json:{items:[]}});
  if(url.pathname==='/api/health')return route.fulfill({json:{status:'ok',queueDepth:0,workerAvailable:true,expiredLeases:0,expiredDeadlines:0}});
  if(url.pathname!=='/api/search/jobs')return url.pathname.startsWith('/api/')?route.fulfill({status:404,json:{error:'Unexpected API call.'}}):route.continue();
  const body=route.request().postDataJSON();
  if(body.action==='start'){
   const input=body.input,now=new Date().toISOString(),query={...input,tripType:input.tripType??'one-way',returnDate:null,cabin:input.cabin??'economy',childrenAges:input.childrenAges??[]};
   const source={provider:'Ignav',status:'ok',received:1,accepted:1};
   const locationResolution={origin:{type:'place',kind:'airport',airports:[{code:'YHZ',name:'Halifax Stanfield'}],method:'fixture'},destination:{type:'place',kind:'airport',airports:[{code:'LHR',name:'London Heathrow'}],method:'fixture'}};
   const coverage={side:'both',partial:true,airportLimit:10,pairsChecked:1,pairsPlanned:1,checked:[{origin:{code:'YHZ',name:'Halifax Stanfield'},destination:{code:'LHR',name:'London Heathrow'},sources:[source],offers:1,complete:false}],origin:locationResolution.origin,destination:locationResolution.destination,uncheckedPairs:[],uncheckedAirportPairs:[]};
   const partial={query,observedAt:now,offers:[offer(600,now)],priceObservations:[],sources:[{...source,route:{origin:'YHZ',destination:'LHR'}}],complete:false,partial:true,coverage,locationResolution,originDetection:{type:'place',kind:'airport'},destinationDetection:{type:'place',kind:'airport'},streaming:{providerResponsesReceived:1,providerResponsesPlanned:7,pairsWithResponses:1,pairsPlanned:1,firstResponseMs:450,providerLatencyMs:{ignav:{samples:1,latestMs:440,maxMs:440}}},limitation:'Live partial results; other provider responses are pending.',limitations:['This is a controlled browser fixture.']};
   finalResult={...partial,observedAt:new Date().toISOString(),offers:[offer(450,new Date().toISOString())],partial:false,coverage:{...coverage,partial:false}};
   job={id:'00000000-0000-4000-8000-000000000311',kind:'flight',input,status:'running',progress:{stage:'searching'}};
   return route.fulfill({status:202,json:job});
  }
  if(body.action==='status'){
   polls++;
   if(polls<=2){
    const flightPreview={...finalResult,offers:[offer(600,finalResult.observedAt)],partial:true,streaming:{providerResponsesReceived:1,providerResponsesPlanned:7,pairsWithResponses:1,pairsPlanned:1,firstResponseMs:450,providerLatencyMs:{ignav:{samples:1,latestMs:440,maxMs:440}}}};
    return route.fulfill({json:{...job,status:'running',progress:{stage:'provider_results_streaming',persistedAt:new Date(Date.now()-250).toISOString(),flightPreview}}});
   }
   return route.fulfill({json:{...job,status:'complete',progress:{stage:'complete'},result:finalResult}});
  }
  return route.fulfill({json:{...job,status:'cancelled'}});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 await page.getByLabel('To',{exact:true}).fill('LHR');
 const form=page.getByRole('button',{name:/^Search flights/}).locator('xpath=ancestor::form[1]');
 await form.getByLabel('Departure',{exact:true}).fill('2099-04-15');
 await form.locator('input[type=number]').nth(0).fill('1');await form.locator('input[type=number]').nth(1).fill('0');
 await page.getByRole('button',{name:/^Search flights/}).click();
 const results=page.locator('section.results'),live=results.locator('[role="status"]');
 await results.getByText('Live partial results:',{exact:false}).waitFor();
 assert.match(await live.textContent(),/Flight search update: 1 provider response received; 1 validated price observation is available\. First result became available 0\.5 seconds after search began\. Search continues\./);
 const persistedAt=Date.parse(await live.getAttribute('data-progress-persisted-at'));
 assert.ok(Number.isFinite(persistedAt)&&persistedAt<=Date.now(),'the result should retain its durable progress timestamp');
 const persistedToUiMs=Date.now()-persistedAt;
 assert.ok(persistedToUiMs<1500,`the UI should expose persisted progress within one polling interval; observed ${persistedToUiMs}ms`);
 assert.equal(await results.locator('article.offer').count(),1,'the early provider fare should render before the job completes');
 assert.match(await results.locator('article.offer').innerText(),/(?:CA\$|CAD\s*)600\.00/);
 assert.match(await results.innerText(),/1 of 7 provider\/route responses received/);
 await results.getByText(/Flight search complete: 1 validated price observation is available\./).waitFor({state:'attached'});
 await page.waitForFunction(element=>/(?:CA\$|CAD\s*)450\.00/.test(element.textContent),await results.locator('article.offer').first().elementHandle());
 assert.equal(polls,3);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({ui:'flight-progressive-provider-results',partialPrice:600,finalPrice:450,statusPolls:polls,persistedToUiMs,providerRequestsIntercepted:true,browserErrors:errors.length,externalRequestsBlocked:true}));
 await context.close();
}finally{await browser.close();}
