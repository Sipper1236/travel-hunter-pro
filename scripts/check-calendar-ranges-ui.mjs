import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {searchFareCalendar} from '../lib/calendar-search.mjs';
import {providerCapabilities} from '../lib/provider-capabilities.mjs';
const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try {
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
let completedJob,jobCalls=0;
 await context.route('**/*',async r=>{
  const target=new URL(r.request().url());
  if(target.origin===base.origin&&target.pathname==='/api/search/capabilities'&&process.env.TRAVEL_CHECK_SOURCE!=='expedia'){
   const input=r.request().postDataJSON();
   const configured=Object.fromEntries(['ignav','google','expedia','skyscanner','air-canada','ita-matrix','omkar-expedia'].map(id=>[id,true]));
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({providers:providerCapabilities(input,{calendar:true,configured})})});
  }
  if(target.origin!==base.origin||target.pathname!=='/api/search/jobs'){
   if(target.origin===base.origin&&target.pathname==='/api/airports')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})});
   if(target.origin===base.origin&&target.pathname==='/api/search/capabilities'&&process.env.TRAVEL_CHECK_SOURCE==='skyscanner')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({providers:[{id:'skyscanner',eligible:true,status:'eligible',label:'Skyscanner'}]})});
   return r.continue();
  }
  jobCalls++;const body=r.request().postDataJSON();
  if(process.env.TRAVEL_CHECK_UNSUPPORTED==='1'){
   if(body.action==='start'){
    const result=await searchFareCalendar(body.input,{searcher:async q=>({offers:[],sources:[q.date===body.input.start?{provider:'Ignav',status:'unsupported_trip',httpStatus:424,providerCode:'unsupported_search'}:{provider:'Ignav',status:'ok'}]})});
    completedJob={id:'00000000-0000-0000-0000-000000000201',status:'complete',kind:'calendar',input:body.input,result};
   }
   return r.fulfill({json:completedJob});
  }
  return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Controlled browser check: job execution disabled.'})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const flight=page.locator('form').nth(1);
 const regional=process.env.TRAVEL_CHECK_REGIONS==='1';
 await page.getByLabel('From',{exact:true}).fill(regional?'Canada':'YHZ');await page.getByLabel('To',{exact:true}).fill(regional?'Europe':'LHR');
 if(regional&&process.env.TRAVEL_CHECK_AUTO!=='1'){await page.locator('#originType').selectOption('region');await page.locator('#destinationType').selectOption('region');}
 await page.getByLabel('Trip type').selectOption('round-trip');
 await flight.getByLabel('Departure',{exact:true}).fill('2027-04-15');
 await flight.getByLabel('Return',{exact:true}).fill('2027-04-20');
 if(process.env.TRAVEL_CHECK_IDENTIFIED==='1'){
 await flight.getByLabel('Use birth dates and infant seating').check();await flight.getByLabel('Birth date',{exact:true}).first().fill('1990-01-01');await flight.getByRole('button',{name:'Add traveler',exact:true}).click();await flight.getByLabel('Birth date',{exact:true}).nth(1).fill('2017-05-01');await flight.getByLabel('Guardian for a minor').nth(1).selectOption('traveler-1');
 }else{await flight.locator('input[type=number]').nth(0).fill('1');await flight.locator('input[type=number]').nth(1).fill('0');}
 assert.equal(await flight.getByLabel('Departure',{exact:true}).isVisible(),true);
 await page.getByLabel('Search date options').selectOption('calendar');
 assert.equal(await flight.getByLabel('Departure',{exact:true}).isVisible(),false);
 const calendar=page.locator('details.coverage').filter({hasText:'Flexible departure dates'});
 const airportLimitControl=calendar.getByLabel('Airport candidates per location',{exact:true});assert.equal(await airportLimitControl.getAttribute('min'),'1');assert.equal(await airportLimitControl.getAttribute('max'),'20');await airportLimitControl.fill('12');
 if(process.env.TRAVEL_CHECK_SOURCE)await calendar.getByLabel('Calendar source').selectOption(process.env.TRAVEL_CHECK_SOURCE);
 assert.equal(await calendar.getByLabel('Provider/date search budget').inputValue(),'250');
 await calendar.getByLabel('First possible departure').fill('2027-04-15');
 await calendar.getByLabel('Last possible departure').fill('2027-04-16');
 if(process.env.TRAVEL_CHECK_NIGHTS==='1'){await calendar.getByRole('radio',{name:'Range of nights',exact:true}).check();await calendar.getByLabel('Minimum nights').fill('5');await calendar.getByLabel('Maximum nights').fill('7');}
 else if(process.env.TRAVEL_CHECK_NIGHTS==='fixed'){await calendar.getByRole('radio',{name:'Fixed stay length',exact:true}).check();await calendar.getByLabel('Stay length (nights)').fill('6');}
 else {await calendar.getByLabel('First possible return').fill('2027-04-20');
 await calendar.getByLabel('Last possible return').fill('2027-04-22');}
 if(process.env.TRAVEL_CHECK_SOURCE==='expedia'){
  await calendar.getByRole('button',{name:'Search flexible dates'}).click();
  await calendar.getByRole('alert').filter({hasText:'No selected provider can price this query'}).waitFor();
  const preview=await calendar.locator('.provider-preflight').innerText();assert.match(preview,/Expedia partner API: unconfigured/);assert.equal(jobCalls,0);
  console.log('Expedia calendar preflight correctly blocks job creation without partner credentials.');
 }else{
 const request=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/search/jobs'&&r.postDataJSON()?.action==='start'&&r.postDataJSON()?.kind==='calendar');
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/search/jobs'&&r.request().postDataJSON()?.action==='start'&&r.request().postDataJSON()?.kind==='calendar');
 if(process.env.TRAVEL_CHECK_SOURCE==='google')assert.match(await calendar.locator('.provider-preflight').innerText(),/Native economy non-infant returns/);
 await calendar.getByRole('button',{name:'Search flexible dates'}).click();
 const {input}= (await request).postDataJSON();await response;
 if(jobCalls!==1)throw Error(`Expected the single calendar submission to be intercepted; intercepted ${jobCalls}. Alerts: ${(await calendar.locator('[role=alert]').allInnerTexts()).join(' | ')}`);
 if(process.env.TRAVEL_CHECK_NIGHTS==='1')assert.deepEqual([input.nightsMin,input.nightsMax],[5,7]);else if(process.env.TRAVEL_CHECK_NIGHTS==='fixed')assert.equal(input.nights,6);else assert.deepEqual([input.start,input.end,input.returnStart,input.returnEnd,input.nights],['2027-04-15','2027-04-16','2027-04-20','2027-04-22',null]);
 assert.equal(input.source,process.env.TRAVEL_CHECK_SOURCE??'ignav');assert.equal(input.tripType,'round-trip');assert.equal(input.airportLimit,12);if(process.env.TRAVEL_CHECK_IDENTIFIED==='1'){assert.equal(input.travelers.length,2);assert.equal(input.travelers[1].guardianId,'traveler-1');assert.equal(input.adults,undefined);}else{assert.equal(input.adults,1);assert.equal(input.children,0);}
 if(regional){assert.equal(input.originType,process.env.TRAVEL_CHECK_AUTO==='1'?'auto':'region');assert.equal(input.destinationType,process.env.TRAVEL_CHECK_AUTO==='1'?'auto':'region');assert.deepEqual(input.originAirports,[]);assert.deepEqual(input.destinationAirports,[]);}
 if(process.env.TRAVEL_CHECK_UNSUPPORTED==='1'){
  await calendar.getByText('Exact trip not supported for these dates',{exact:false}).first().waitFor();
  assert.equal(await calendar.locator('.calendar-day').filter({hasText:'Exact trip not supported for these dates'}).count(),3);
  assert.equal(await calendar.locator('.calendar-day').filter({hasText:'No matching observation'}).count(),3);
  assert.equal(completedJob.result.coverage.pairQueriesUnsupported,3);
  assert.equal(completedJob.result.coverage.pairQueriesChecked,3);
  assert.equal(completedJob.result.stopped,null);
 }
 console.log('Calendar range submission passed; provider requests were intercepted.');
 }
}finally{await browser.close();}
