import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),pageErrors=[],jobs=new Map(),hotelInputs=[];page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(20000);let flightNumber=0,hotelStarts=0;
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
 await page.route('**/api/airports',route=>route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));
 await page.route('**/api/search/jobs',async route=>{
  const body=route.request().postDataJSON();
  if(body.action==='start'){
   const hotelStart=body.kind==='hotel'?++hotelStarts:0;
   const id=`00000000-0000-4000-8000-${String(body.kind==='hotel'?200+hotelStart:100+ ++flightNumber).padStart(12,'0')}`;
   if(body.kind==='hotel')hotelInputs.push(body.input);
   jobs.set(id,{kind:body.kind,input:body.input,hotelStart});
   return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({id,status:'queued',kind:body.kind,input:body.input})});
  }
  if(body.action==='status'){
   const job=jobs.get(body.id);if(!job)return route.fulfill({status:404,contentType:'application/json',body:'{"error":"missing fixture job"}'});
   if(job.kind==='hotel'&&job.hotelStart>2)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'running',kind:'hotel',input:job.input,progress:{stage:'searching_official_sites'}})});
   if(job.kind==='hotel')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'hotel',input:job.input,result:{query:{...job.input,destination:{city:'Hotel City',cityId:'Q1',countryCode:'CA'}},offers:[],rejected:0,limitation:'Fixture hotel result.'}})});
   const input=job.input,index=Number(body.id.slice(-1)),now=new Date().toISOString(),expiresAt=new Date(Date.now()+60000).toISOString();
   const segment=(from,to,flight,departure,arrival)=>({marketing_carrier_code:'AC',flight_number:flight,departure_airport:from,arrival_airport:to,departure_time_utc:departure,arrival_time_utc:arrival,departure_time_local:departure.slice(0,19),arrival_time_local:arrival.slice(0,19)});
   const out=segment(input.origin,input.destination,`10${index}`,`${input.date}T08:00:00Z`,`${input.date}T12:00:00Z`),back=segment(input.destination,input.origin,`20${index}`,`${input.returnDate}T14:00:00Z`,`${input.returnDate}T22:00:00Z`);
   const offer={provider:'Ignav',source:'Ignav live fare API',from:input.origin,to:input.destination,price:500+index,currency:'CAD',travelers:'2 adults',cabin:'economy',departureDate:input.date,departureTime:'08:00',arrivalDate:input.date,arrivalTime:'12:00',durationMinutes:240,airlines:['AC'],via:[],segments:[out],inbound:{from:input.destination,to:input.origin,departureDate:input.returnDate,departureTime:'14:00',arrivalDate:input.returnDate,arrivalTime:'22:00',durationMinutes:480,airlines:['AC'],via:[],segments:[back]},observedAt:now,expiresAt,itineraryKey:`hotel-switch-${index}`,ignavId:`hotel_switch_${index}`,fees:'Provider fees not independently verified'};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'flight',input,result:{query:input,offers:[offer],sources:[{provider:'Ignav',status:'ok',received:1,accepted:1}],observedAt:now,locationResolution:{destination:{airports:[{code:input.destination}]}}}})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'flight'})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const flightForm=page.locator('section.search:not(.assistant):not(.hotels) form').first();
 let identifiedPartyReady=false;
 const searchFlight=async({destination,date,returnDate,identified=false})=>{
  const airports=flightForm.getByRole('combobox');
  await airports.nth(0).fill('YYZ');await airports.nth(1).fill(destination);
  await page.locator('#originType').selectOption('place');await page.locator('#destinationType').selectOption('place');
  await flightForm.locator('select').nth(1).selectOption('round-trip');
  await flightForm.locator('input[type=date]').nth(0).fill(date);await flightForm.locator('input[type=date]').nth(1).fill(returnDate);
  const identifiedToggle=flightForm.getByLabel('Use birth dates and infant seating');
  if(identified&&!(await identifiedToggle.isChecked()))await identifiedToggle.check();
  if(!identified&&(await identifiedToggle.isChecked()))await identifiedToggle.uncheck();
  if(identified&&!identifiedPartyReady){
   await flightForm.getByRole('button',{name:'Add traveler'}).click();await flightForm.getByRole('button',{name:'Add traveler'}).click();
   await flightForm.getByLabel('Birth date',{exact:true}).nth(0).fill('1987-03-01');await flightForm.getByLabel('Birth date',{exact:true}).nth(1).fill('1989-03-01');await flightForm.getByLabel('Birth date',{exact:true}).nth(2).fill('2019-10-01');
   await flightForm.locator('fieldset').nth(3).locator('select').nth(0).selectOption({label:'Traveler 1'});identifiedPartyReady=true;
  }else if(!identified){
   await flightForm.getByLabel('Adults',{exact:true}).fill('2');await flightForm.getByLabel(/Children and youths/).fill('0');
  }
  await flightForm.getByRole('button',{name:/Search flights/}).click();
  await page.getByRole('button',{name:/\+ Hotel/}).last().waitFor({timeout:8000});
 };
 await searchFlight({destination:'FRA',date:'2026-12-01',returnDate:'2026-12-06'});
 await page.getByRole('button',{name:/\+ Hotel/}).last().click();
 const hotel=page.locator('section.search.hotels').first();
 await hotel.getByLabel('Rooms',{exact:true}).fill('2');
 await hotel.locator('fieldset').nth(0).getByLabel('Adult ages').fill('39, 40');
 await hotel.locator('fieldset').nth(0).getByLabel('Child ages at check-in').fill('');
 await hotel.locator('fieldset').nth(1).getByLabel('Adult ages').fill('37');
 await hotel.locator('fieldset').nth(1).getByLabel('Child ages at check-in').fill('');
 await hotel.getByRole('button',{name:'Search stays'}).click();
 await hotel.getByText(/room assignments must match the selected flight party/i).waitFor();
 assert.equal(hotelInputs.length,0);
 await hotel.locator('fieldset').nth(0).getByLabel('Adult ages').fill('39');
 await hotel.getByRole('button',{name:'Search stays'}).click();
 await hotel.getByText(/0 accepted observations/).waitFor({timeout:5000});
 assert.deepEqual(hotelInputs[0].roomAllocations,[{adultAges:[39],childrenAges:[]},{adultAges:[37],childrenAges:[]}]);

 await searchFlight({destination:'YYC',date:'2026-12-07',returnDate:'2026-12-12',identified:true});
 await page.getByRole('button',{name:/\+ Hotel/}).last().click();
 await hotel.getByLabel('Rooms',{exact:true}).fill('2');
 await hotel.locator('fieldset').nth(0).getByLabel('Adult ages').fill('39');
 await hotel.locator('fieldset').nth(0).getByLabel('Child ages at check-in').fill('8');
 await hotel.locator('fieldset').nth(1).getByLabel('Adult ages').fill('37');
 await hotel.locator('fieldset').nth(1).getByLabel('Child ages at check-in').fill('');
 await hotel.getByRole('button',{name:'Search stays'}).click();
 await hotel.getByText(/room assignments must match the selected flight party/i).waitFor();
 assert.equal(hotelInputs.length,1);
 await hotel.locator('fieldset').nth(0).getByLabel('Child ages at check-in').fill('7');
 await hotel.getByRole('button',{name:'Search stays'}).click();
 await hotel.getByText(/0 accepted observations/).waitFor({timeout:5000});
 assert.deepEqual(hotelInputs[1].roomAllocations,[{adultAges:[39],childrenAges:[7]},{adultAges:[37],childrenAges:[]}]);
 assert.equal(Object.hasOwn(hotelInputs[1],'travelers'),false);
 assert.equal(JSON.stringify(hotelInputs[1]).includes('2019-10-01'),false);

 await searchFlight({destination:'BCN',date:'2026-12-10',returnDate:'2026-12-15'});
 await page.getByRole('button',{name:/\+ Hotel/}).last().click();
 await page.waitForFunction(()=>document.querySelector('section.search.hotels input[name="rooms"]')?.value==='1');
 assert.equal(await hotel.getByLabel('Rooms',{exact:true}).inputValue(),'1');
 assert.equal(await hotel.getByLabel('Children’s ages at check-in',{exact:true}).inputValue(),'');
 assert.equal(await hotel.locator('fieldset').count(),0);
 await hotel.getByText(/previous hotel result belongs to a different selected flight/i).waitFor();
 await hotel.getByRole('button',{name:'Search stays'}).click();
 await hotel.getByRole('button',{name:'Cancel search'}).waitFor();
 await searchFlight({destination:'MUC',date:'2026-12-20',returnDate:'2026-12-25'});
 await page.getByRole('button',{name:/\+ Hotel/}).last().click();
 await page.waitForFunction(()=>document.querySelector('section.search.hotels input[name="rooms"]')?.value==='1');
 await hotel.getByText(/still running for the previous flight/i).waitFor();
 assert.equal(await hotel.getByRole('button',{name:'Cancel search'}).count(),1);
 assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({ui:'flight-hotel-party-reset',countPartyMismatchBlocked:true,identifiedChildAgeMismatchBlocked:true,oldHotelRequest:{rooms:hotelInputs[0].rooms,roomAllocations:hotelInputs[0].roomAllocations},identifiedHotelRequest:{roomAllocations:hotelInputs[1].roomAllocations,dobForwarded:false},newFlight:'YYZ–BCN',roomsAfterFlightSwitch:1,roomAllocationsAfterFlightSwitch:0,staleRunningHotelJobDisclosed:true,cancelAvailable:true,providerAndJobRequestsIntercepted:true,pageErrors:pageErrors.length}));
}finally{await browser.close();}
