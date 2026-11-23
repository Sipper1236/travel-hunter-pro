// Controlled browser check: only the local UI and intercepted job boundary are exercised.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the loopback application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),starts=[],jobs=new Map(),errors=[],unexpected=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
  if(!url.pathname.startsWith('/api/'))return route.continue();
  if(url.pathname!=='/api/search/jobs'){unexpected.push(url.pathname);return route.fulfill({status:400,json:{error:'Unexpected API call.'}});}
  const body=request.postDataJSON();
  if(body.action==='start'){
   starts.push(body);const id=`00000000-0000-0000-0000-${String(starts.length).padStart(12,'0')}`;
   const job={id,kind:body.kind,input:body.input};jobs.set(id,job);return route.fulfill({status:202,json:{...job,status:'queued'}});
  }
  const job=jobs.get(body.id);assert.ok(job,'Job status must refer to the queued job.');
  return route.fulfill({json:{...job,status:'complete',result:{offers:[],query:job.input,sourceResults:[{provider:'Booking.com Demand API',status:'unavailable',reason:'Fixture only'}],limitation:'Controlled UI fixture.'}}});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const section=page.locator('section.search.hotels').first();
 await section.getByLabel('City').fill('Montréal');
 await section.getByLabel('Check-in').fill('2027-04-15');await section.getByLabel('Check-out').fill('2027-04-20');
 await section.getByLabel('Adults').fill('2');await section.getByLabel('Rooms').fill('2');await section.getByLabel('Children’s ages').fill('7');
 await section.getByLabel('Hotel price sources').selectOption('booking-demand');
 assert.equal(await section.getByLabel('Official property website (optional)').count(),0,'Demand API does not expose direct-site URL controls.');
 assert.equal(await section.getByLabel('Official website search limit').count(),0,'Demand API does not expose direct-site discovery limits.');
 await section.getByLabel('Adults’ actual ages').fill('35, 39');
 await section.locator('fieldset').nth(0).getByLabel('Adult ages').fill('35');await section.locator('fieldset').nth(0).getByLabel('Child ages').fill('7');
 await section.locator('fieldset').nth(1).getByLabel('Adult ages').fill('39');
 await section.getByRole('button',{name:'Search stays'}).click();
 await section.getByText(/0 accepted observations/).waitFor({state:'visible',timeout:5000});
 assert.equal(starts.length,1);assert.equal(starts[0].kind,'hotel');assert.equal(starts[0].input.hotelSource,'booking-demand');
 assert.deepEqual(starts[0].input.roomAllocations,[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]);
 assert.equal(starts[0].input.officialLimit,undefined);assert.equal(starts[0].input.officialUrl,undefined);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({ui:'booking-demand-source',hotelSource:starts[0].input.hotelSource,roomAllocations:starts[0].input.roomAllocations,providerCalls:0,jobBoundaryIntercepted:true,browserErrors:errors.length}));
}finally{await browser.close();}
