// Controlled Chromium regression for unverified Matrix price-only observations.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Use the loopback application URL.');
const id=randomUUID(),ownerToken=randomUUID(),observedAt=new Date().toISOString();
const result={observedAt,query:{origin:'YHZ',destination:'LAX',date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',source:'ita-matrix',adults:1,children:0,childrenAges:[],cabin:'economy',filters:{}},offers:[],sources:[{provider:'ITA Matrix',status:'ok',received:1,accepted:0}],priceObservations:[{provider:'ITA Matrix',price:1533.98,currency:'CAD',priceScope:'Matrix-reported group total',travelers:'1 adult',cabin:'economy',origin:'YHZ',destination:'LAX',departureDate:'2026-11-12',returnDate:'2026-11-19',observedAt,details:'Matrix reported this CAD total for the matching route and dates, but full flight and connection details could not be validated.',sourceUrl:'https://matrix.itasoftware.com/flights'}]};
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),errors=[],unexpected=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(({id,ownerToken})=>sessionStorage.setItem('travel-hunter-flight-job',JSON.stringify({id,ownerToken})),{id,ownerToken});
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/search/jobs')return route.fulfill({json:{id,ownerToken,kind:'flight',status:'complete',result}});
  if(url.pathname==='/api/health'&&request.method()==='POST')return route.fulfill({json:{status:'ok',queueDepth:0,workerAvailable:true,expiredLeases:0,expiredDeadlines:0}});
  if(url.pathname.startsWith('/api/')){unexpected.push(url.pathname);return route.fulfill({status:400,json:{error:'Unexpected API call during controlled QA.'}});}
  return route.continue();
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const card=page.locator('article.matrix-observation');
 await card.waitFor();
 assert.match(await card.innerText(),/\$1,533\.98/);
 assert.equal(await card.getByText('CAD · Matrix-reported group total',{exact:true}).count(),1);
 await card.getByText('ITA Matrix price only · itinerary and filter compliance unverified',{exact:true}).waitFor();
 await card.getByText('seller availability not confirmed',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({ui:'matrix-price-observation-currency',currencyLabel:'CAD',priceOnlyAndSellerCaveats:true,browserErrors:errors.length,providerCallsIntercepted:true}));
}finally{await browser.close();}
