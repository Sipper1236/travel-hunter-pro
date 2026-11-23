import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();let calendarInput,resolveCalendarInput;
 const calendarInputReceived=new Promise(resolve=>{resolveCalendarInput=resolve;});
 await page.route('**/api/airports',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
 await page.route('**/api/search/jobs',async route=>{
  const body=route.request().postDataJSON();
  if(body.action==='start'&&body.kind==='calendar'){calendarInput=body.input;resolveCalendarInput(body.input);}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000201',status:'running',kind:body.kind})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const flight=page.locator('.search form').nth(1);
  await page.getByLabel('From',{exact:true}).fill('Europe');
 await page.getByLabel('To',{exact:true}).fill('LHR');
  await page.locator('#originType').selectOption('region');
 await page.locator('#destinationType').selectOption('place');
 await flight.locator('input[type=date]').first().fill('2026-12-15');
 await flight.locator('input[type=number]').nth(0).fill('1');
 await flight.locator('input[type=number]').nth(1).fill('0');
  await page.getByLabel('Search date options').selectOption('calendar');
 const calendar=page.locator('details.coverage').filter({hasText:'Flexible departure dates'});
  assert.equal(await calendar.evaluate(node=>node.open),true,'Flexible range should be visible by default.');
  assert.equal(await calendar.getByRole('radio',{name:'Flexible range'}).isChecked(),true);
  assert.deepEqual(await calendar.locator('#calendar-source option').evaluateAll(options=>options.map(option=>option.value)),['all','ignav','google','expedia','skyscanner','air-canada','ita-matrix','omkar-expedia']);
  await calendar.getByLabel('Calendar source').selectOption('all');
  await calendar.getByRole('radio',{name:'One date only'}).check();
  await calendar.getByRole('button',{name:'Tuesday, December 15, 2026'}).click();
  await calendar.getByRole('radio',{name:'Flexible range'}).check();
  await calendar.getByRole('button',{name:'Thursday, December 17, 2026'}).click();
 const request=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/search/jobs'&&r.postDataJSON()?.kind==='calendar',{timeout:10000});
  await calendar.getByRole('button',{name:'Search flexible dates'}).click();
 const startBody=JSON.parse((await request).postData());assert.match(startBody.ownerToken,/^[a-f0-9-]{36}$/i);calendarInput=await calendarInputReceived;
  assert.equal(calendarInput.source,'all');
  assert.equal(calendarInput.origin,'Europe');assert.equal(calendarInput.originType,'region');assert.deepEqual(calendarInput.originAirports,[]);
  assert.equal(calendarInput.tripType,'one-way');
  assert.deepEqual(calendarInput.routePairs,[]);assert.deepEqual(calendarInput.destinationAirports,['LHR']);
 assert.equal(calendarInput.start,'2026-12-15');
  assert.equal(calendarInput.end,'2026-12-17');
 assert.equal(calendarInput.adults,1);
 assert.equal(calendarInput.children,0);
 assert.equal(calendarInput.cabin,'economy');
   console.log(JSON.stringify({ui:'calendar-source',source:calendarInput.source,providers:await calendar.locator('#calendar-source option').count()-1,origin:calendarInput.origin,originType:calendarInput.originType,regionResolvedByWorker:true,tripType:calendarInput.tripType,routePairs:calendarInput.routePairs,jobOwnerCapability:'sent',providerRequestIntercepted:true}));
}finally{await browser.close();}
