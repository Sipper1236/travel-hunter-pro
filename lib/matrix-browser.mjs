import {chromium} from 'playwright-core';
import {setTimeout as delay} from 'node:timers/promises';
import {parseMatrixBatch,matrixResponseTimeout,MATRIX_RESPONSE_MAX_BYTES} from './ita-matrix.mjs';
import {SourceRequestError} from './source-errors.mjs';
import {getJobStore} from './job-store.mjs';

/** Submit the public search form; the first-party client generates its own request context. */
export async function matrixBrowserSearch(query,{signal:upstream,timeoutMs=matrixResponseTimeout(process.env.TRAVEL_MATRIX_RESPONSE_TIMEOUT_MS),browserFactory,onStage=()=>{},policy=getJobStore()}={}){
 timeoutMs=matrixResponseTimeout(timeoutMs);
  if(query.cabin!=='COACH')throw new SourceRequestError('Native Matrix family search currently requires economy.',{status:'unsupported_trip'});
 const extraStops=query.maxExtraLegsRelativeToMinimum??1;
 if(!Number.isInteger(extraStops)||extraStops<0||extraStops>2)throw new SourceRequestError('The Matrix website currently supports detailed expansion only through two extra stops.',{status:'unsupported_trip'});
 const signal=upstream?AbortSignal.any([upstream,AbortSignal.timeout(timeoutMs+20000)]):AbortSignal.timeout(timeoutMs+20000);
 const startedAt=performance.now();let submittedAt,requestAt,responseAt;
 const timing=()=>({setupMs:Math.round((submittedAt??performance.now())-startedAt),dispatchMs:submittedAt===undefined?null:Math.round((requestAt??performance.now())-submittedAt),responseMs:requestAt===undefined?null:Math.round((responseAt??performance.now())-requestAt),totalMs:Math.round(performance.now()-startedAt),responseTimeoutMs:timeoutMs,searchRequestSent:requestAt!==undefined});
 let browser,page;
 let stage="start";const advance=value=>{stage=value;onStage(value);};
 const close=()=>{browser?.close().catch(()=>{});};
 signal.addEventListener('abort',close,{once:true});
 try{
  signal.throwIfAborted();
  if(policy)for(;;){const slot=policy.reserveSource('ITA Matrix',1000);if(slot.blockedUntil)throw new SourceRequestError('Matrix is cooling down.',{status:slot.status,retryAt:slot.blockedUntil});if(!slot.waitMs)break;await delay(slot.waitMs,undefined,{signal});}
  advance('launch');browser=await(browserFactory??(()=>chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:10000})))();
  page=await browser.newPage();page.setDefaultTimeout(10000);
  page.on('request',r=>{if(new URL(r.url()).host==='content-alkalimatrix-pa.googleapis.com'&&/POST \/v1\/search\?/.test(r.postData()||''))requestAt??=performance.now();});
  advance('homepage');await page.goto('https://matrix.itasoftware.com/',{waitUntil:'domcontentloaded',timeout:20000});
  const check=async()=>{signal.throwIfAborted();const text=await page.locator('body').innerText();if(/captcha|unusual traffic|verify.*human|access denied/i.test(text))throw new SourceRequestError('Matrix requires an access check.',{status:'blocked'});};
  await check();
  for(const [i,code] of [[0,query.origin],[1,query.destination]]){
   advance(`airport-${code}`);const input=page.getByPlaceholder('Add airport').nth(i);await input.fill(code);
   const option=page.getByRole('option').filter({hasText:new RegExp(`\\(${code}\\)`)}).first();await option.waitFor();await option.click();
  }
  advance("dates");const format=date=>`${date.slice(5,7)}/${date.slice(8,10)}/${date.slice(0,4)}`;
  if(!query.returnDate)await page.getByText('One Way',{exact:true}).click();
  await page.getByPlaceholder('Start date',{exact:true}).fill(format(query.departureDate));
  if(query.returnDate){await page.getByPlaceholder('End date',{exact:true}).fill(format(query.returnDate));await page.getByPlaceholder('End date',{exact:true}).press('Tab');}
  const fields=['adults','seniors','youths','children','infantsInSeat','infantsInLap'];
  for(const [i,name]of fields.entries())await page.locator('input[type=number]').nth(i).fill(String(query.passengers[name]??0));
  await page.locator('input[type=number]').last().press('Tab');
  advance('currency');const currency=page.getByRole('combobox',{name:'Currency',exact:true});await currency.fill('CAD');await page.getByRole('option').filter({hasText:/Canadian Dollar/}).first().click();
  advance('route_options');const currentExtraStops=page.getByText('Up to 1 extra stop',{exact:true});await currentExtraStops.click();const extraStopLabel=extraStops===0?'No extra stops':`Up to ${extraStops} extra stop${extraStops===1?'':'s'}`;await page.getByRole('option',{name:extraStopLabel,exact:true}).click();
  const allowAirportChanges=page.getByLabel('Allow airport changes',{exact:true});await allowAirportChanges.setChecked(query.allowAirportChanges??true);
  // The observed public form's cheapest-available setting is accepted only when every returned cabin matches.
  await check();
  advance("submit");const responsePromise=page.waitForResponse(r=>new URL(r.url()).host==='content-alkalimatrix-pa.googleapis.com'&&/POST \/v1\/search\?/.test(r.request().postData()||''),{timeout:timeoutMs});
  responsePromise.catch(()=>{});
  submittedAt=performance.now();await page.locator('button[value=Search]').click();
  advance("response");const response=await responsePromise;const responseBody=await matrixResponseBody(response);responseAt=performance.now();const raw=parseMatrixBatch(responseBody,response.headers()['content-type']||'');await check();
  const solutions=raw.solutionList?.solutions??[];
  const needsDetails=solutions.map((solution,index)=>({solution,index})).filter(({solution})=>solution.itinerary?.carriers?.length!==1||solution.itinerary?.slices?.some(slice=>slice.flights?.length!==1));
  const detailsStarted=performance.now(),detailCoverage={needed:needsDetails.length,requested:0,received:0,limit:3,failed:0};
  advance('itinerary_details');
  for(const {solution,index}of needsDetails.slice(0,detailCoverage.limit)){
   if(signal.aborted)break;await check();detailCoverage.requested++;
   try{
    const pending=page.waitForResponse(r=>new URL(r.url()).host==='content-alkalimatrix-pa.googleapis.com'&&(r.request().postData()||'').includes('bookingDetails'),{timeout:15000});pending.catch(()=>{});
    await page.locator('tr.row').nth(index).click({timeout:5000});
    const detailResponse=await pending,packet=parseMatrixBatch(await matrixResponseBody(detailResponse),detailResponse.headers()['content-type']||'');
    if(packet.session!==raw.session||packet.solutionSet!==raw.solutionSet||packet.bookingDetails?.id!==solution.id)throw new SourceRequestError('Matrix details did not match the selected itinerary.',{status:'invalid_response'});
    solution.matrixDetails=packet.bookingDetails;detailCoverage.received++;
   }catch(error){if(upstream?.aborted)throw upstream.reason;if(['blocked','auth','rate_limited'].includes(error.sourceStatus))throw error;detailCoverage.failed++;break;}
  }
  raw.matrixDetailCoverage=detailCoverage;raw.matrixTiming={...timing(),detailMs:Math.round(performance.now()-detailsStarted)};return raw;
 }catch(error){if(upstream?.aborted)throw upstream.reason;if(['blocked','rate_limited','auth'].includes(error.sourceStatus)){const until=Date.now()+(error.sourceStatus==='rate_limited'?60000:300000);policy?.deferSource?.('ITA Matrix',until,error.sourceStatus);error.retryAt=until;}if(signal.aborted||error.name==='TimeoutError'){const failure=new SourceRequestError(`Matrix did not complete this airport/date search during ${stage}.`,{status:'temporarily_unavailable',providerCode:'native_query_timeout'});failure.matrixTiming=timing();throw failure;}throw error;}
 finally{signal.removeEventListener('abort',close);await browser?.close().catch(()=>{});}
}

export async function matrixResponseBody(response){
 const declared=Number(response.headers()['content-length']);
 if(Number.isFinite(declared)&&declared>MATRIX_RESPONSE_MAX_BYTES)throw new SourceRequestError('Matrix response exceeded its size limit.',{status:'invalid_response'});
 const body=await response.body();
 if(body.byteLength>MATRIX_RESPONSE_MAX_BYTES)throw new SourceRequestError('Matrix response exceeded its size limit.',{status:'invalid_response'});
 return body.toString('utf8');
}
