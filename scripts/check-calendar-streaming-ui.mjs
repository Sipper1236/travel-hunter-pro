import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {searchFareCalendar} from '../lib/calendar-search.mjs';
import {providerCapabilities} from '../lib/provider-capabilities.mjs';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
const leg=(from,to,date,number)=>({marketing_carrier_code:'AC',flight_number:number,departure_airport:from,arrival_airport:to,departure_time_utc:`${date}T08:00:00Z`,arrival_time_utc:`${date}T16:00:00Z`,departure_time_local:`${date}T08:00:00`,arrival_time_local:`${date}T16:00:00`});
const fare=(query,price)=>({provider:'Ignav',source:'Ignav live fare API',price,currency:'CAD',observedAt:new Date().toISOString(),travelers:'Actual query party',bookingStatus:'Observed; seller not rechecked',fees:'Inclusions unverified',cabin:query.cabin,from:query.origin,to:query.destination,departureDate:query.date,arrivalDate:query.date,departureTime:'08:00',arrivalTime:'16:00',durationMinutes:480,airlines:['AC'],via:[],segments:[leg(query.origin,query.destination,query.date,'100')],ignavId:'stream_fixture_1234',itineraryKey:'stream-fixture',...(query.tripType==='round-trip'?{inbound:{from:query.destination,to:query.origin,departureDate:query.returnDate,arrivalDate:query.returnDate,departureTime:'08:00',arrivalTime:'16:00',durationMinutes:480,via:[],segments:[leg(query.destination,query.origin,query.returnDate,'200')]}}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 let job,preview,result,polls=0;
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base.origin)return route.abort();
  if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
  if(url.pathname==='/api/search/capabilities'){
   const input=route.request().postDataJSON();
   return route.fulfill({json:{providers:providerCapabilities(input,{calendar:true,configured:{ignav:true}})}});
  }
  if(url.pathname!=='/api/search/jobs')return url.pathname.startsWith('/api/')?route.fulfill({status:404,json:{error:'Unexpected local endpoint.'}}):route.continue();
  const body=route.request().postDataJSON();
  if(body.action==='start'){
   const input=body.input;
   result=await searchFareCalendar(input,{searcher:async query=>({offers:[fare(query,400)],sources:[{provider:'Ignav',status:'ok',received:1}]})});
   const omittedAirports=Array.from({length:34},(_,index)=>({code:`A${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`,name:`Omitted Airport ${index+1}`}));
   result.locationCoverage={destination:{type:'region',method:'UNSD M49 Europe country membership',airports:[{code:'FRA',name:'Frankfurt Airport'}],uncheckedAirports:omittedAirports,uncheckedAirportCount:omittedAirports.length,moreAvailable:true,popularityExclusionLimit:3,popularityRankedCandidates:627,popularityExclusionShortfall:0,popularityExcludedAirports:[{code:'LHR',name:'London Heathrow Airport',passengers:83884572}]}};
   preview=structuredClone(result);preview.locationCoverage.destination.uncheckedAirports=preview.locationCoverage.destination.uncheckedAirports.slice(0,20);preview.locationCoverage.destination.uncheckedAirportsSampled=true;preview.partial=true;preview.status='running';preview.limitation='Live prices are provisional until all airport pairs finish.';preview.dates[0].received=0;
   preview.coverage.pairQueriesChecked=0;preview.coverage.datesChecked=0;preview.coverage.providerResponsesReceived=1;preview.coverage.providerResponsesPlanned=4;
   preview.dates[0]={...preview.dates[0],price:500,offer:fare({origin:input.origin,destination:input.destination,date:input.start,returnDate:input.tripType==='round-trip'?input.nights?new Date(Date.parse(input.start+'T00:00:00Z')+Number(input.nights)*86400000).toISOString().slice(0,10):input.returnStart:undefined,tripType:input.tripType,cabin:input.cabin},500),status:'partial_route_coverage',reason:'0 of 1 airport pairs complete; the displayed fare is provisional.'};
   preview.dates[0].offers=[preview.dates[0].offer,fare({origin:input.origin,destination:input.destination,date:input.start,returnDate:input.tripType==='round-trip'?input.nights?new Date(Date.parse(input.start+'T00:00:00Z')+Number(input.nights)*86400000).toISOString().slice(0,10):input.returnStart:undefined,tripType:input.tripType,cabin:input.cabin},510)];
   job={id:'00000000-0000-4000-8000-000000000201',kind:'calendar',input,status:'running',progress:{stage:'calendar_searching'}};
   return route.fulfill({status:202,json:job});
  }
  if(body.action==='status'){
   polls++;
   if(polls===1)return route.fulfill({json:{...job,progress:{stage:'calendar_results_streaming',calendarPreview:preview,datesPlanned:result.coverage.datesPlanned,datesChecked:0,pairQueriesPlanned:result.coverage.pairQueriesPlanned,pairQueriesChecked:0,providerResponsesReceived:1,providerResponsesPlanned:4,requestBudget:result.coverage.requestBudget}}});
   return route.fulfill({json:{...job,status:'complete',progress:{stage:'complete'},result}});
  }
  return route.fulfill({json:{...job,status:body.action==='cancel'?'cancelled':job.status}});
 });
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const flight=page.locator('form').nth(1);
 await page.getByLabel('From',{exact:true}).fill('YHZ');await page.getByLabel('To',{exact:true}).fill('LHR');
 await page.getByLabel('Trip type').selectOption('round-trip');
 await flight.getByLabel('Departure',{exact:true}).fill('2027-04-15');await flight.getByLabel('Return',{exact:true}).fill('2027-04-20');
 await flight.locator('input[type=number]').nth(0).fill('1');await flight.locator('input[type=number]').nth(1).fill('0');
 await page.getByLabel('Search date options').selectOption('calendar');
 const calendar=page.locator('details.coverage').filter({hasText:'Flexible departure dates'});
 await calendar.getByLabel('First possible departure').fill('2027-04-15');await calendar.getByLabel('Last possible departure').fill('2027-04-15');
 await calendar.getByLabel('First possible return').fill('2027-04-20');await calendar.getByLabel('Last possible return').fill('2027-04-20');
 await calendar.getByRole('button',{name:'Search flexible dates'}).click();
 await calendar.getByText('Live provisional results:',{exact:false}).waitFor();
 await calendar.locator('div').filter({hasText:'Fare calendar: running'}).filter({hasText:'1 of 4 provider responses received'}).first().waitFor();
 const liveAnnouncement=calendar.locator('[role="status"]');
 await liveAnnouncement.first().waitFor({state:'attached'});
 assert.match(await liveAnnouncement.first().textContent(),/^Fare calendar update: 1 provider response received; 1 date has matching fare observations\. Search in progress\.$/);
 assert.equal(await liveAnnouncement.count(),1,'Streaming results should expose one concise live announcement, without per-poll job announcements.');
 const day=calendar.locator('.calendar-day').first();
 await day.locator('strong').first().waitFor();
 assert.match(await day.locator('strong').first().innerText(),/CAD\s*500\.00/);
 assert.match(await day.innerText(),/Best fresh fare seen so far/);
 await day.getByText('2 validated fare observations received so far',{exact:true}).waitFor();
 await day.locator('.observed-offers').getByText('CAD 510.00',{exact:true}).waitFor();
 assert.equal(await day.locator('.observed-offers > ol > li').count(),2,'every validated fare received so far is rendered while the search is still running');
 const location=calendar.locator('div.note').filter({hasText:'Resolved location coverage'}).locator('details').filter({hasText:'destination region'});await location.locator('summary').click();
 assert.match(await location.innerText(),/Known omitted airport codes \(sample\)/,'progress UI marks the bounded airport-code sample');
 assert.doesNotMatch(await day.innerText(),/0 fare observations checked/,'a streamed provisional offer must not be paired with a zero completed-response count');
 const observedTime=day.locator('time[datetime]').first();
 await observedTime.waitFor();
 assert.equal(Number.isNaN(Date.parse(await observedTime.getAttribute('datetime'))),false,'provisional result exposes its validated observation time');
 await page.waitForFunction(element=>/CAD\s*400\.00/.test(element.textContent),await day.locator('strong').first().elementHandle());
 assert.doesNotMatch(await day.innerText(),/Best fresh fare seen so far/);
 await calendar.getByText(/1 of 1 provider responses received/).waitFor();
 await page.waitForFunction(element=>element.textContent==='Fare calendar search complete: 1 provider response received; 1 date has matching fare observations.',await liveAnnouncement.first().elementHandle());
 await page.waitForFunction(element=>element.textContent.includes('ABH'),await location.elementHandle());
 assert.match(await location.innerText(),/Known omitted airport codes:/,'completed UI lists every code returned by the resolver');
 assert.doesNotMatch(await location.innerText(),/Known omitted airport codes \(sample\)/);
 await location.getByText('Popularity policy excludes up to 3 traffic-ranked airports (627 ranked; shortfall 0): LHR (London Heathrow Airport).',{exact:true}).waitFor();
 assert.equal(errors.length,0,errors.join('; '));
 console.log(JSON.stringify({ui:'calendar-progressive-results',previewOffers:[500,510],finalPrice:400,statusPolls:polls,providerRequestsIntercepted:true,pageErrors:errors.length}));
 await context.close();
}finally{await browser.close();}
