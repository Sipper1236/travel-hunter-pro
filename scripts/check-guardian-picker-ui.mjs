import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),errors=[],unexpected=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{items:[]}});
  return route.continue();
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const form=page.locator('.search form').nth(1);
 await form.getByLabel('Search date options').selectOption('dates');
 await form.getByLabel('Trip type').selectOption('round-trip');
 await form.getByLabel('Departure',{exact:true}).fill('2026-04-15');
 await form.getByLabel('Return',{exact:true}).fill('2026-04-17');
 await form.getByLabel('Use birth dates and infant seating').check();
 const births=form.getByLabel('Birth date',{exact:true});
 await births.nth(0).fill('1980-01-01');
 await form.getByRole('button',{name:'Add traveler',exact:true}).click();
 await births.nth(1).fill('2008-04-16');
 await form.getByRole('button',{name:'Add traveler',exact:true}).click();
 await births.nth(2).fill('2025-01-01');
 await form.getByRole('group',{name:'Traveler 3'}).getByLabel('Infant seating').selectOption('lap');
 const guardian=form.getByLabel('Guardian for a minor').nth(2);
 assert.deepEqual(await guardian.locator('option').evaluateAll(options=>options.map(option=>option.textContent)),['No guardian selected','Traveler 1']);
 await guardian.selectOption({label:'Traveler 1'});
 await page.waitForTimeout(100);
 await form.getByLabel('Departure',{exact:true}).fill('2026-04-17');
 await form.getByLabel('Return',{exact:true}).fill('2026-04-18');
 await form.getByRole('button',{name:'Add traveler',exact:true}).click();
 await births.nth(3).fill('2025-02-01');
 await form.getByRole('group',{name:'Traveler 4'}).getByLabel('Infant seating').selectOption('lap');
 const secondInfantGuardian=form.getByLabel('Guardian for a minor').nth(3);
 assert.deepEqual(await secondInfantGuardian.locator('option').evaluateAll(options=>options.map(option=>option.textContent)),['No guardian selected','Traveler 2']);
 assert.deepEqual(await secondInfantGuardian.locator('option').evaluateAll(options=>options.map(option=>option.textContent)),['No guardian selected','Traveler 2']);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({ui:'guardian-picker',minorCandidatesExcluded:true,lapInfantGuardianLimitEnforced:true,age18BoundaryEvaluatedOnBothTripDates:true,browserErrors:errors.length,externalRequestsBlocked:true}));
}finally{await browser.close();}
