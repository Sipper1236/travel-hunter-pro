import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();let jobs=0;
 await page.route('**/api/airports',route=>route.fulfill({json:{items:[]}}));
 await page.route('**/api/search/capabilities',route=>route.fulfill({json:{providers:[{id:'ignav',label:'Ignav',eligible:false,status:'unconfigured',reason:'Controlled test: no access.'}]}}));
 await page.route('**/api/search/jobs',route=>{if(route.request().method()==='POST')jobs++;return route.fulfill({json:{jobs:[]}});});
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const flight=page.locator('.search form').nth(1);
 await page.getByLabel('From',{exact:true}).fill('Canada');await page.getByLabel('To',{exact:true}).fill('Europe');
 await page.getByLabel('Trip type').selectOption('round-trip');
 await flight.getByLabel('Departure',{exact:true}).fill('2027-04-15');await flight.getByLabel('Return',{exact:true}).fill('2027-04-20');
 // Synthetic test-only identities, never sent to a supplier.
 await flight.getByLabel('Use birth dates and infant seating').check();await flight.getByLabel('Birth date',{exact:true}).first().fill('1990-01-01');
 await flight.getByRole('button',{name:'Add traveler',exact:true}).click();await flight.getByLabel('Birth date',{exact:true}).nth(1).fill('2015-04-20');await flight.getByLabel('Guardian for a minor').nth(1).selectOption('traveler-1');
 await page.getByLabel('Search date options').selectOption('calendar');
 const calendar=page.locator('details.coverage').filter({hasText:'Flexible departure dates'});
 await calendar.getByLabel('First possible departure').fill('2027-04-15');await calendar.getByLabel('Last possible departure').fill('2027-04-16');
 await calendar.getByRole('radio',{name:'Range of nights',exact:true}).check();await calendar.getByLabel('Minimum nights').fill('5');await calendar.getByLabel('Maximum nights').fill('7');
 await calendar.getByRole('button',{name:'Search flexible dates',exact:true}).click();
 await page.getByText('No selected provider can price this query with current server access.',{exact:false}).waitFor();
 assert.equal(jobs,0);
 const manual=page.locator('.manual-flight-search');await manual.locator('summary').click();
 await manual.getByLabel('Manual departure airport',{exact:true}).fill('YHZ');await manual.getByLabel('Manual arrival airport',{exact:true}).fill('IST');
 await manual.getByLabel('Manual date combination',{exact:true}).selectOption('2027-04-16/2027-04-23');
 const text=await manual.getByLabel('Exact trip checklist',{exact:true}).inputValue();
 for(const item of ['YHZ → IST','2027-04-16','2027-04-23','age 11 at departure, 12 at return','guardian traveler 1'])assert.ok(text.includes(item),item);
 assert.ok(!text.includes('2015-04-20'));
 const href=await manual.getByRole('link',{name:'Open Google Flights for manual entry ↗'}).getAttribute('href');
 assert.equal(new URL(href).searchParams.size,3);assert.equal(jobs,0);
 await manual.getByLabel('Manual arrival airport',{exact:true}).fill('YHZ');
 await manual.getByRole('alert').waitFor();assert.equal(await manual.getByRole('link').count(),0);
 console.log('PASS: blocked regional family search creates no job; exact manual dates, birthday ages, guardian and private link verified.');
}finally{await browser.close();}
