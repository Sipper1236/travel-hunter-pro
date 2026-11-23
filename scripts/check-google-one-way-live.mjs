// Explicit live smoke check for the native Google one-way path. This performs
// one read-only provider search through the local durable worker and website.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

if(process.env.TRAVEL_GOOGLE_LIVE_CHECK!=='1')throw Error('Set TRAVEL_GOOGLE_LIVE_CHECK=1 to authorize one live Google Flights results-page search.');
const base=new URL(process.env.TRAVEL_CHECK_URL??'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname))throw Error('The live check only uses the loopback app.');
const origin=process.env.TRAVEL_GOOGLE_LIVE_ORIGIN??'YHZ',destination=process.env.TRAVEL_GOOGLE_LIVE_DESTINATION??'LAX',date=process.env.TRAVEL_GOOGLE_LIVE_DATE;
if(!/^[A-Z]{3}$/.test(origin)||!/^[A-Z]{3}$/.test(destination)||origin===destination||typeof date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||date<new Date().toISOString().slice(0,10)||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw Error('Set exact IATA airports and a future TRAVEL_GOOGLE_LIVE_DATE.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:10000});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 // Exact IATA codes need no directory choice; avoid spending an Ignav
 // suggestion request during this Google-only check.
 await page.route('**/api/airports',route=>route.fulfill({json:{items:[]}}));
 await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:20000});
 const form=page.getByRole('button',{name:/^Search flights/}).locator('xpath=ancestor::form[1]');
 await page.getByLabel('From',{exact:true}).fill(origin);
 await page.getByLabel('To',{exact:true}).fill(destination);
 await form.locator('input[type=date]').first().fill(date);
 await page.locator('#flightSource').selectOption('google');
 await form.locator('input[type=number]').nth(0).fill('1');
 await form.locator('input[type=number]').nth(1).fill('0');
 const started=performance.now();
 await page.getByRole('button',{name:/^Search flights/}).click();
 const completion=page.getByText(/^Search: complete$/).waitFor({timeout:90000});
 const firstOffer=page.locator('article.offer').first().waitFor({state:'visible',timeout:90000}).then(()=>Math.round(performance.now()-started)).catch(()=>null);
 const firstCard=await Promise.race([firstOffer,completion.then(()=>null)]);
 await completion;
 const sources=await page.locator('.results .source').allInnerTexts(),offerCards=await page.locator('article.offer').count();
 const sourceStatus=sources[0]?.match(/^Google Flights \/ search: ([a-z_]+)/)?.[1]??'missing';
 const nativeObservationLabel=Boolean(sources[0]?.includes('bounded Google results-page observations'));
 console.log(JSON.stringify({site:'loopback website and durable worker',route:`${origin}-${destination}`,date,party:'one adult',cabin:'economy',source:'Google Flights native one-way',jobStatus:'complete',sourceStatus,offerCards,nativeObservationLabel,msToFirstOfferCard:firstCard,msToComplete:Math.round(performance.now()-started),pageErrors:errors.length,pricesRecorded:false}));
 assert.equal(sources.length,1,'The Google-only live query must report exactly one source.');
 assert.equal(sourceStatus,'ok','The native Google source must complete successfully.');
 assert.equal(nativeObservationLabel,true,'The result must retain the unrefreshed Google page-observation label.');
 assert.deepEqual(errors,[],'The website must finish without browser errors.');
}finally{await browser.close();}
