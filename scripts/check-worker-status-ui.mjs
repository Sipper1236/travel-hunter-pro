import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),errors=[],unexpected=[];let healthCalls=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/health'&&route.request().method()==='POST'){
   healthCalls++;
   const online=healthCalls>1;
   return route.fulfill({json:{status:online?'ok':'degraded',queue:{},queueDepth:0,workers:{running:online?1:0},expiredLeases:0,expiredDeadlines:0,workerAvailable:online}});
  }
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{items:[]}});
  return route.continue();
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const status=page.locator('[aria-label="Search worker status"] [role="status"]');
 await status.getByText(/Search worker unavailable.*npm run worker/).waitFor();
 await page.locator('[aria-label="Search worker status"]').getByRole('button',{name:'Refresh worker status'}).click();
 await status.getByText(/Search worker online.*queue 0/i).waitFor();
 assert.equal(healthCalls,2);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({ui:'worker-status',offlineWarningVisible:true,refreshReflectsWorkerRecovery:true,externalRequestsBlocked:true,browserErrors:errors.length}));
}finally{await browser.close();}
