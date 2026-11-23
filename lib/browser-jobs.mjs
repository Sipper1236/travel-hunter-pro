import {chromium} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {challengeFrame,challengeInput} from './challenge.mjs';
import {validateStay,stayUrl,extractStays} from './booking-browser.mjs';
import {verifyHotelLocation} from './hotel-location.mjs';
import {normalizeLocation} from './hotel-identity.mjs';
import {getJobStore} from './job-store.mjs';
import {SourceRequestError,retryAfter} from './source-errors.mjs';
import {reserveBrowserSource} from './browser-source-policy.mjs';
const state=globalThis.__travelBrowserJobs ??= {jobs:new Map(),busy:false};
export function localRequest(request){const host=request.headers.get('host')||'';return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)&&request.headers.get('origin')===`http://${host}`;}
export async function bookingPageDiagnostics(page,{httpStatus=null,challengeFrameDetected=false}={}){
 let host=null,path=null,title='',body='';
 try{const url=new URL(page.url());host=url.hostname;path=url.pathname.slice(0,160);}catch{}
 try{title=String(await page.title()).replace(/[\r\n\t]/g,' ').slice(0,120);}catch{}
 try{body=String(await page.locator('body').innerText({timeout:1500})).slice(0,100_000);}catch{}
 let propertyCards=0;try{propertyCards=await page.locator('[data-testid="property-card"]').count();}catch{}
 const lower=`${title} ${body}`.toLowerCase(),challengeMarkers=[];
 if(/captcha|recaptcha|hcaptcha/.test(lower))challengeMarkers.push('captcha_marker');
 if(/bot or not|robot or human|unusual traffic|automated quer/.test(lower))challengeMarkers.push('bot_check_marker');
 if(/verify (that )?you are human|human verification|security challenge/.test(lower))challengeMarkers.push('human_verification_marker');
 if(/access denied|request blocked/.test(lower))challengeMarkers.push('access_denied_marker');
 if(challengeFrameDetected&&!challengeMarkers.length)challengeMarkers.push('recognized_challenge_frame');
 return {host,path,title,...(Number.isInteger(httpStatus)?{httpStatus}:{}),propertyCards,challengeMarkers,pageTextLength:body.length};
}
export function startJob(input,{launch=options=>chromium.launch(options),destination,destinationWarning,policy=getJobStore()}={}){
 const query={...validateStay(input),...(destination?{destination}:{}),...(destinationWarning?{destinationWarning}:{})};if(state.busy)throw Error('A browser search is already active. Finish or cancel it first.');
 state.busy=true;const controller=new AbortController(),job={id:randomUUID(),status:'searching',query,created:Date.now(),frame:null,lock:Promise.resolve(),launch,policy,controller};state.jobs.set(job.id,job);
 for(const [id,j] of state.jobs)if(Date.now()-j.created>600000)state.jobs.delete(id);
 job.done=run(job);return {id:job.id,status:job.status};
}
async function run(job){
 try{
  await reserveBrowserSource(job.policy,'Booking.com',{signal:job.controller.signal});
  job.browser=await job.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:10000});
  if(job.cancelled)return;
  job.page=await job.browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
  if(job.cancelled)return;
  try{const response=await job.page.goto(stayUrl(job.query),{waitUntil:'domcontentloaded',timeout:30000});job.navigationStatus=response?.status?.()??null;job.navigationHeaders=response?.headers?.()??{};}catch(error){
   if(!await job.page.locator('[data-testid="property-card"]').count()&&!await challengeFrame(job.page))throw Error(`Booking.com navigation failed: ${error.message.split('\n')[0]}`);
  }
  if([401,403,429].includes(job.navigationStatus)){
   job.diagnostics=await bookingPageDiagnostics(job.page,{httpStatus:job.navigationStatus,challengeFrameDetected:Boolean(await challengeFrame(job.page).catch(()=>null))});
   job.sourceStatus=job.navigationStatus===429?'rate_limited':job.navigationStatus===401?'auth':'access_denied';
   const hinted=retryAfter(job.navigationHeaders?.['retry-after']);
   job.retryAt=job.navigationStatus===429?Math.max(hinted??0,Date.now()+60000):Math.max(hinted??0,Date.now()+300000);
   job.policy?.deferSource('Booking.com',job.retryAt,job.sourceStatus);
   throw Error(`Booking.com stopped after HTTP ${job.navigationStatus}; page title “${job.diagnostics.title||'unavailable'}” at ${job.diagnostics.host||'unknown host'}${job.diagnostics.path||''}; no challenge was interacted with.`);
  }
  while(!job.cancelled&&Date.now()-job.created<300000){
   const url=new URL(job.page.url());if(url.hostname!=='www.booking.com')throw Error('Provider navigated outside the supported search site.');
   if(await job.page.locator('[data-testid="property-card"]').count()){
    if(normalizeLocation(url.searchParams.get('ss'))!==normalizeLocation(job.query.city))throw Error('Provider changed the requested hotel location. Results were not imported.');
    if(url.searchParams.get('checkin')!==job.query.checkin||url.searchParams.get('checkout')!==job.query.checkout||url.searchParams.get('group_adults')!==String(job.query.adults))throw Error('Provider changed the requested stay. Results were not imported.');
    if(Number(url.searchParams.get('no_rooms')||1)!==job.query.rooms||Number(url.searchParams.get('group_children')||0)!==job.query.childrenAges.length||JSON.stringify(url.searchParams.getAll('age').map(Number).sort((a,b)=>a-b))!==JSON.stringify([...job.query.childrenAges].sort((a,b)=>a-b)))throw Error('Provider changed requested rooms or child ages. Results were not imported.');
    const result=await extractStays(await job.page.content(),job.query);
    let checked=0,stopChecking=false;
    for(const offer of result.offers){
     if(job.cancelled)return;
     if(job.query.destination && checked<5 && !stopChecking){
      job.progress={stage:'verifying_hotel_locations',locationsChecked:checked,locationsPlanned:Math.min(result.offers.length,5)};
      offer.locationEvidence=await verifyHotelLocation(job.page.context(),offer,job.query.destination);checked++;
      stopChecking=Boolean(offer.locationEvidence.stopChecking);
     }else offer.locationEvidence={status:'unverified',reason:job.query.destination?'Location inspection budget or source access limit reached.':job.query.destinationWarning || 'Flight arrival-city evidence was not supplied.'};
    }
    if(job.cancelled)return;
    job.result={...result,locationCoverage:{checked,verified:result.offers.filter(offer=>offer.locationEvidence.status==='verified').length,limit:5,stoppedBySource:stopChecking}};job.status='complete';return;
   }
   await new Promise(r=>setTimeout(r,1000));
  }
  if(!job.cancelled){
   job.diagnostics=await bookingPageDiagnostics(job.page,{httpStatus:job.navigationStatus,challengeFrameDetected:Boolean(await challengeFrame(job.page).catch(()=>null))});
   job.sourceStatus=job.diagnostics.challengeMarkers.length?'blocked':'temporarily_unavailable';
   throw Error(`Booking.com search timed out without visible property results; page title “${job.diagnostics.title||'unavailable'}” at ${job.diagnostics.host||'unknown host'}${job.diagnostics.path||''}; HTTP ${job.diagnostics.httpStatus??'unknown'}; property cards ${job.diagnostics.propertyCards}; challenge indicators ${job.diagnostics.challengeMarkers.join(', ')||'none'}. No challenge was interacted with.`);
  }
 }catch(e){if(!job.cancelled){job.status='error';job.message=e.message;job.sourceStatus=e.sourceStatus??job.sourceStatus;job.retryAt=e.retryAt??job.retryAt;}}
 finally{await job.browser?.close().catch(()=>{});state.busy=false;job.frame=null;}
}
export async function jobAction(input){
 const job=state.jobs.get(input.id);if(!job)throw Error('Search session expired.');
 const action=async()=>{
  if(input.action==='cancel'){job.cancelled=true;job.status='cancelled';job.controller.abort(Error('Hotel search cancelled.'));await job.browser?.close().catch(()=>{});await job.done;job.frame=null;}
  else if(input.action==='input'){if(job.status!=='challenge')throw Error('No active challenge.');await challengeInput(job.page,job.frame,input);job.frame=null;}
  else if(input.action!=='poll')throw Error('Unknown action.');
  if(!['complete','error','cancelled'].includes(job.status)&&job.page&&!job.page.isClosed()){
   const frame=await challengeFrame(job.page).catch(()=>null);
   if(!['complete','error','cancelled'].includes(job.status)){job.frame=frame;job.status=frame?'challenge':'searching';}
  }
  return {id:job.id,status:job.status,message:job.message,sourceStatus:job.sourceStatus,...(job.retryAt?{retryAt:new Date(job.retryAt).toISOString()}:{}),diagnostics:job.diagnostics,progress:job.progress,result:job.result,challenge:job.frame?{id:job.frame.id,image:job.frame.image,width:job.frame.box.width,height:job.frame.box.height}:null};
 };
 const next=job.lock.then(action);job.lock=next.catch(()=>{});return next;
}
