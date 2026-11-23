// Controlled UI acceptance check. All search/provider boundaries are intercepted; fixtures never reach production adapters.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Use the loopback application URL.');
const recoveryMode=process.env.TRAVEL_CHECK_RETRY_STATUS==='1';
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),starts=[],jobs=new Map(),errors=[],unexpected=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
   window.__travelHunterCspAudit={application:[],nextDevtoolsStyleViolations:0};
   document.addEventListener('securitypolicyviolation',event=>{
     const source=event.sourceFile?new URL(event.sourceFile,location.href).pathname:'';
     if(event.violatedDirective==='style-src-elem'&&event.blockedURI==='inline'&&source.includes('node_modules_next_dist_compiled_next-devtools'))window.__travelHunterCspAudit.nextDevtoolsStyleViolations++;
     else window.__travelHunterCspAudit.application.push({directive:event.violatedDirective,blocked:event.blockedURI,source,line:event.lineNumber});
   });
 });
 await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
   if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
   if(url.pathname==='/api/health'&&request.method()==='POST')return route.fulfill({json:{status:'ok',queueDepth:0,workerAvailable:true,expiredLeases:0,expiredDeadlines:0}});
   if(!url.pathname.startsWith('/api/'))return route.continue();
  if(url.pathname!=='/api/search/jobs'){unexpected.push(url.pathname);return route.fulfill({status:400,json:{error:'Unexpected API call during controlled QA.'}});}
  const body=request.postDataJSON();
  if(body.action==='start'){
   starts.push(body);const id=`00000000-0000-0000-0000-${String(starts.length).padStart(12,'0')}`;
   jobs.set(id,{id,kind:body.kind,input:body.input,statusPolls:0});return route.fulfill({status:202,json:{id,kind:body.kind,status:'queued'}});
  }
  const job=jobs.get(body.id);assert.ok(job,'Status must refer to the existing intercepted job.');assert.equal(body.action,'status');
  if(recoveryMode&&job.statusPolls<2){job.statusPolls++;job.retryAt??=new Date(Date.now()+60000).toISOString();return route.fulfill({json:{id:job.id,kind:job.kind,input:job.input,status:'queued',retryAt:job.retryAt,progress:{stage:'recovering'}}});}
  if(job.kind!=='flight')return route.fulfill({json:{...job,status:'cancelled'}});
  const {statusPolls,...publicJob}=job;
  const observedAt=new Date().toISOString(),query=job.input;
  const segments=[{marketing_carrier_code:'AC',flight_number:'100',departure_airport:'YHZ',arrival_airport:'YUL',departure_time_utc:'2099-04-15T08:00:00Z',arrival_time_utc:'2099-04-15T09:00:00Z',departure_time_local:'2099-04-15T08:00:00',arrival_time_local:'2099-04-15T09:00:00'},{marketing_carrier_code:'AC',flight_number:'200',departure_airport:'YUL',arrival_airport:'BCN',departure_time_utc:'2099-04-15T13:00:00Z',arrival_time_utc:'2099-04-15T21:00:00Z',departure_time_local:'2099-04-15T13:00:00',arrival_time_local:'2099-04-15T21:00:00'}];
  const offer={provider:'Ignav',source:'Controlled offline QA fixture',price:600,currency:'CAD',travelers:'2 adults',cabin:'economy',from:'YHZ',to:'BCN',airlines:['Air Canada'],departureDate:'2099-04-15',departureTime:'08:00',arrivalDate:'2099-04-15',arrivalTime:'21:00',durationMinutes:780,via:['YUL'],segments,ignavId:'offline_fare',itineraryKey:'offline_itinerary',observedAt,bookingStatus:'Test fixture, not a fare',fees:'Test-only unknown inclusions'};
  const googleOffer={...offer,id:'offline_google_fare',provider:'Google Flights',seller:'Air Canada',googleBookingMode:'phone',sourceUrl:'https://www.google.com/travel/flights/booking?tfs=test-query&tfu=test-flights&curr=CAD',source:'Google Flights native selected round-trip observation',bookingStatus:'Observed group return quote; calling the airline is required for this option.',fees:'Google reports required taxes and fees included; baggage and optional charges require seller confirmation.'};
  return route.fulfill({json:{...publicJob,status:'complete',result:{query,observedAt,offers:[offer,googleOffer],priceObservations:[],sources:[],complete:false}}});
 });
 const navigation=await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const csp=navigation.headers()['content-security-policy'];assert.ok(typeof csp==='string'&&/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp),'Response must set a nonce-based strict-dynamic script policy.');
 await page.waitForFunction(()=>[...document.scripts].some(script=>script.nonce)&&[...document.scripts].every(script=>{
   const type=script.type.trim().toLowerCase(),javascript=!type||/^(?:text|application)\/(?:java|ecma)script$/.test(type);
   if(!javascript||!script.src&&!script.textContent.trim())return true;
   // Turbopack's dev HMR client and its empty overlay shell are injected by Next,
   // not by the app; neither carries a response nonce. Production has no HMR.
   return script.src.includes('browser_dev_hmr-client')||Boolean(script.nonce);
 }));
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'YHZ');assert.equal(await page.getByLabel('To',{exact:true}).inputValue(),'');
 const identifiedToggle=page.getByLabel('Use birth dates and infant seating',{exact:true});
 const partyPill=page.locator('.search .title .pill').first();
 await identifiedToggle.check();await partyPill.getByText('1 identified traveler').waitFor();
 await page.getByRole('button',{name:'Add traveler',exact:true}).click();await partyPill.getByText('2 identified travelers').waitFor();
 await page.getByRole('button',{name:'Remove traveler 2',exact:true}).click();await partyPill.getByText('1 identified traveler').waitFor();
 await identifiedToggle.uncheck();
 const flightForm=page.getByRole('button',{name:/^Search flights/}).locator('xpath=ancestor::form[1]');
 await page.getByLabel('To',{exact:true}).fill('BCN');
 await flightForm.locator('input[type=date]').first().fill('2099-04-15');await flightForm.locator('input[type=number]').nth(0).fill('2');await flightForm.locator('input[type=number]').nth(1).fill('0');
 await page.getByRole('button',{name:/^Search flights/}).click();
 if(recoveryMode)await page.getByText(/^Worker recovery retry scheduled for /).last().waitFor({timeout:5000});
 await page.locator('article.offer').first().waitFor();await page.waitForTimeout(1500);
 assert.equal(await page.getByRole('button',{name:'Load provider handoff links',exact:true}).count(),2,'Handoff lookup must not claim that the seller was checked.');
 assert.equal(await page.getByRole('button',{name:/seller options/i}).count(),0,'Provider links must not be labeled as seller verification.');
 const googleCard=page.locator('article.offer').nth(1);
 assert.equal(await googleCard.getByRole('link',{name:'Open Google booking options · phone booking ↗',exact:true}).count(),1,'Google booking-page URLs must not be labeled as generic search links.');
 await googleCard.getByText('Price and source details',{exact:true}).click();
 await googleCard.getByText(/Data source: Google Flights native selected round-trip observation\. Seller: Air Canada\./).waitFor();
 await googleCard.getByText('Agent requirement: call Air Canada for this quote; online seller totals may differ.').waitFor();
 assert.deepEqual(starts.map(body=>body.kind),['flight'],'Normal search must not enqueue comparisons, calendars, stays or packages.');
 assert.equal(starts[0].input.adults,2);assert.equal(starts[0].input.children,0);
 assert.equal(await page.getByLabel('Compare contiguous ticket groupings',{exact:true}).isChecked(),false);
 assert.equal(await page.getByLabel('Compare adult booking splits on each segment',{exact:true}).isChecked(),false);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('article.offer').first().waitFor();
 assert.deepEqual(starts.map(body=>body.kind),['flight'],'Reload must recover the result without starting any new search.');
 await page.getByRole('button',{name:'Compare split-party tickets',exact:true}).click();
 if(recoveryMode)await page.getByText(/^Worker recovery retry scheduled for /).last().waitFor({timeout:5000});
 await page.getByText('Comparison cancelled.',{exact:true}).waitFor();
 assert.deepEqual(starts.map(body=>body.kind),['flight','comparison']);assert.equal(starts[1].input.mode,'party');
 const cspAudit=await page.evaluate(()=>window.__travelHunterCspAudit);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(cspAudit.application,[],'Application CSP violations must be resolved.');
 console.log(JSON.stringify({ui:'default-deep-search-off',identifiedPartySummary:true,nonceCsp:true,workerRecoveryStatus:recoveryMode?['flight','comparison']:[],normalFlightStarts:1,automaticComparisonStarts:0,reloadReenqueues:0,explicitPartyComparisonStarts:1,browserErrors:errors.length,applicationCspViolations:cspAudit.application.length,nextDevtoolsStyleViolations:cspAudit.nextDevtoolsStyleViolations,providerBoundariesIntercepted:true}));
}finally{await browser.close();}
