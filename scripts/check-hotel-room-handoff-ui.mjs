import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),jobs=new Map();let starts=0;
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base.origin)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
  if(url.pathname!=='/api/search/jobs')return route.fulfill({status:400,json:{error:'Unexpected controlled-check API call.'}});
  const body=request.postDataJSON();
  if(body.action==='start'){
   starts++;const id='00000000-0000-0000-0000-000000000901';
   jobs.set(id,{id,kind:body.kind,input:body.input});
   return route.fulfill({status:202,json:{id,kind:body.kind,status:'queued'}});
  }
  const job=jobs.get(body.id);assert.ok(job);assert.equal(body.action,'status');
  return route.fulfill({json:{...job,status:'complete',result:{query:job.input,observedAt:new Date().toISOString(),offers:[{
   name:'Controlled hotel fixture',stars:4,stayText:'4 nights',source:'Official booking engine',
   priceText:'CAD 700.00',currency:'CAD',taxText:'No itemized taxes. Reservit documentation states North American totals are before taxes and European totals include taxes.',taxSourceUrl:'https://help.reservit.com/EN/presentation-of-our-tools-for-web-agencies',
   bookingStatus:'The current Reservit booking link carries dates and total guest count only; re-enter the exact ages displayed.',observedAt:new Date().toISOString(),
   url:'https://example.org/hotel',
   stay:{checkin:job.input.checkin,checkout:job.input.checkout,nights:4,rooms:1,adults:2,adultAges:[35,39],childrenAges:[7]},
   roomQuotes:[{room:1,priceText:'CAD 700.00',adultAges:[35,39],childrenAges:[7],url:'https://example.org/room'}]
  }]}}});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const section=page.locator('section.search.hotels').first();
 await section.getByLabel('City').fill('Montréal');
 await section.getByLabel('Check-in',{exact:true}).fill('2027-05-10');
 await section.getByLabel('Check-out',{exact:true}).fill('2027-05-14');
 await section.getByLabel('Adults').fill('2');
 await section.getByLabel('Rooms').fill('1');
 await section.getByLabel('Children’s ages').fill('7');
 await section.getByLabel('Hotel price sources').selectOption('official');
 await section.getByLabel('Adults’ actual ages').fill('35, 39');
 await section.getByRole('button',{name:'Search stays'}).click();
 const link=section.getByRole('link',{name:'Open stay details to re-enter this room’s ages and verify the current rate ↗'});
 await link.waitFor({state:'visible',timeout:5000});
 assert.equal(await link.getAttribute('href'),'https://example.org/room');
 await section.getByText(/booking link carries dates and total guest count only.*re-enter the exact ages displayed/i).waitFor({state:'visible'});
 const taxSource=section.getByRole('link',{name:'Reservit Best Price tax and booking-link documentation ↗'});
 assert.equal(await taxSource.getAttribute('href'),'https://help.reservit.com/EN/presentation-of-our-tools-for-web-agencies');
 assert.match(await section.innerText(),/Cancellation terms not supplied/);
 assert.equal(starts,1);
 console.log(JSON.stringify({ui:'hotel-room-handoff',roomOccupancyVisible:true,ageReentryDisclosed:true,currentRateVerificationDisclosed:true,providerRequestsIntercepted:true}));
}finally{await browser.close();}
