import {chromium} from 'playwright-core';
import {selectVacationLocation,selectVacationDates,selectVacationParty,openVacationFlightPanel,vacationLocationSelection} from './vacation-form.mjs';
import {normalizeVacationApiResponse,normalizeVacationListing} from './vacation-normalize.mjs';
import {fetchSource} from './source-fetch.mjs';
import {readBoundedSourceText} from './source-json.mjs';
import {getJobStore} from './job-store.mjs';
import {SourceRequestError,retryAfter} from './source-errors.mjs';
import {reserveBrowserSource} from './browser-source-policy.mjs';

import {validateVacationQuery} from './vacation-query.mjs';
export {validateVacationQuery} from './vacation-query.mjs';

let active=false;
const DEFAULT_PACKAGE_RESULT_LIMIT=20,MAX_FLIGHT_PANELS=40;
const PACKAGE_RESPONSE_MAX_BYTES=2_000_000;
export async function readVacationPackageApiResponse(response,{maxBytes=PACKAGE_RESPONSE_MAX_BYTES}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>PACKAGE_RESPONSE_MAX_BYTES)throw new TypeError('Package response limit must be from one byte to two megabytes.');
 const status=response?.status?.(),headers=response?.headers?.()??{},contentType=headers['content-type']??'';
 if(status!==200)throw new SourceRequestError(`Air Canada Vacations package response was refused (HTTP ${Number.isInteger(status)?status:'unknown'}).`,{status:status===429?'rate_limited':status===401?'auth':status===403?'blocked':'error',...(Number.isInteger(status)?{httpStatus:status}:{})});
 if(!/^application\/json(?:\s*;|$)/i.test(contentType))throw new SourceRequestError('Air Canada Vacations package response was not JSON.',{status:'invalid_response'});
 const declared=Number(headers['content-length']);if(Number.isFinite(declared)&&declared>maxBytes)throw new SourceRequestError('Air Canada Vacations package response exceeded its size limit.',{status:'invalid_response'});
 let body;try{body=await response.body();}catch{throw new SourceRequestError('Air Canada Vacations package response could not be read.',{status:'invalid_response'});}
 if(!Buffer.isBuffer(body))body=Buffer.from(body);
 if(body.byteLength>maxBytes)throw new SourceRequestError('Air Canada Vacations package response exceeded its size limit.',{status:'invalid_response'});
 let data;try{data=JSON.parse(body.toString('utf8'));}catch{throw new SourceRequestError('Air Canada Vacations package response was malformed JSON.',{status:'invalid_response'});}
 return {data,responseBytes:body.byteLength};
}
export function vacationFlightPanelBudget(visibleCards,maxPanels=DEFAULT_PACKAGE_RESULT_LIMIT){
 if(!Number.isSafeInteger(visibleCards)||visibleCards<0)throw Error('Visible package card count must be a nonnegative integer.');
 if(![20,40].includes(maxPanels))throw Error('Package inspection limit must be 20 or 40.');
 return Math.min(visibleCards,maxPanels,MAX_FLIGHT_PANELS);
}
export async function inspectVacationFlightPanels(cards,onProgress=()=>{},maxPanels=DEFAULT_PACKAGE_RESULT_LIMIT){
 const visibleCards=await cards.count(),panelsPlanned=vacationFlightPanelBudget(visibleCards,maxPanels);
 onProgress({stage:'inspecting_package_flights',panelsChecked:0,panelsPlanned});
 for(let index=0;index<panelsPlanned;index++){
  await openVacationFlightPanel(cards.nth(index));
  onProgress({stage:'inspecting_package_flights',panelsChecked:index+1,panelsPlanned});
 }
 return {visibleCards,flightPanelsAttempted:panelsPlanned,flightPanelLimit:maxPanels};
}
export async function loadVacationResultPages(page,maxResults=DEFAULT_PACKAGE_RESULT_LIMIT,onProgress=()=>{}){
 if(![20,40].includes(maxResults))throw Error('Package result limit must be 20 or 40.');
 const maxPageExpansions=Math.floor(maxResults/DEFAULT_PACKAGE_RESULT_LIMIT)-1;
 const cards=page.locator('.hotel-item'),more=page.locator('button.showmore__button');let visibleCards=await cards.count(),pagesExpanded=0,pageLoadStopped=false;
 while(visibleCards<maxResults&&pagesExpanded<maxPageExpansions){
  const hasMore=await more.isVisible().catch(()=>false);if(!hasMore)break;
  try{
   const prior=visibleCards;await more.click();
   await page.waitForFunction(count=>document.querySelectorAll('.hotel-item').length>count,prior,{timeout:20000});
   visibleCards=await cards.count();pagesExpanded++;onProgress({stage:'loading_package_results',cardsLoaded:visibleCards,cardsLimit:maxResults,pagesExpanded});
  }catch{pageLoadStopped=true;break;}
 }
 const moreAvailable=await more.isVisible().catch(()=>false);
 return {visibleCards,pagesExpanded,moreAvailable,pageLoadStopped,resultLimit:maxResults};
}
export async function searchVacation(input,options={}){
 const {fetcher=fetch,launch=opts=>chromium.launch(opts),signal,onProgress=()=>{}}=options;
 const policy=options.policy===undefined?(fetcher===fetch?getJobStore():null):options.policy;
 const query=validateVacationQuery(input);
 signal?.throwIfAborted();
 if(active)throw Error('A package search is already running. Wait for it to finish.');
 active=true;
 let browser;
 const abortBrowser=()=>void browser?.close().catch(()=>{});
 signal?.addEventListener('abort',abortBrowser,{once:true});
 try{
   onProgress({stage:'verifying_package_currency'});
   const timeoutSignal=AbortSignal.timeout(20000);
   let termsResponse;
   try{
    termsResponse=await fetchSource('Air Canada Vacations','https://vacations.aircanada.com/en/terms-conditions',{signal:signal?AbortSignal.any([signal,timeoutSignal]):timeoutSignal},{timeoutMs:20000,policy,...(fetcher===fetch?{}:{fetcher})});
   }catch(error){if(error instanceof SourceRequestError)throw new SourceRequestError(`Provider currency terms could not be verified: ${error.message}`,{status:error.sourceStatus,httpStatus:error.httpStatus,retryAt:error.retryAt,providerCode:error.providerCode});throw Error(`Provider currency terms could not be verified: ${error.message}`);}
  if(!termsResponse.ok)throw Error('Provider currency terms could not be verified.');
   const currencyTermsText=await readBoundedSourceText(termsResponse,{provider:'Air Canada Vacations currency terms',maxBytes:2_000_000});
   if(!/All prices are in Canadian currency, unless otherwise indicated/i.test(currencyTermsText))throw Error('Provider currency terms could not be verified.');
   signal?.throwIfAborted();await reserveBrowserSource(policy,'Air Canada Vacations',{signal});onProgress({stage:'launching_package_browser'});
   browser=await launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true,timeout:10000});
   signal?.throwIfAborted();
  const timeout=setTimeout(()=>void browser.close().catch(()=>{}),180000);timeout.unref();
  let providerRefusal;
  try{
   const page=await browser.newPage();page.setDefaultTimeout(20000);
   const providerFailures=[];
   page.on('response',response=>{
    try{
     const url=new URL(response.url()),status=response.status();
     if(!['vacations.aircanada.com','vacations-api.aircanada.com'].includes(url.hostname)||![401,403,429].includes(status))return;
     const headers=response.headers(),hint=retryAfter(headers['retry-after']);let retryAt=hint,state=status===429?'rate_limited':status===401?'auth':'blocked';
     if(status===429)retryAt=Math.max(hint??0,Date.now()+60000);if(status===401||status===403)retryAt=Math.max(hint??0,Date.now()+300000);
     if(retryAt)policy?.deferSource('Air Canada Vacations',retryAt,state);
     providerRefusal=new SourceRequestError(`Air Canada Vacations provider request was refused (HTTP ${status}).`,{status:state,httpStatus:status,retryAt,providerCode:'provider_access_refusal'});
     void browser?.close().catch(()=>{});
    }catch{/* Ignore malformed or unrelated provider response events. */}
   });
   page.on('requestfailed',request=>{try{const url=new URL(request.url());if(url.hostname==='vacations.aircanada.com')providerFailures.push({path:url.pathname,error:request.failure()?.errorText||'network error'});}catch{}});
   onProgress({stage:'loading_package_provider'});
   await page.goto('https://vacations.aircanada.com/en/all-booking-options/flight-hotel/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('#flight_hotel_tab-from-input').waitFor({state:'visible',timeout:20000}).catch(()=>null);
   if(!await page.locator('#flight_hotel_tab-from-input').count()){
    const authFailed=providerFailures.some(f=>f.path==='/session-authentication/token/jwt');
    const details=providerFailures.filter(f=>f.path.startsWith('/session-authentication/')).map(f=>f.error);
    throw Error(authFailed?'Air Canada Vacations search is temporarily unavailable: its session-authentication service failed to load. Please retry later.':details.length?'Air Canada Vacations search could not load required provider services. Please retry later.':'Air Canada Vacations search form did not load. No package search was submitted.');
   }
   const cookie=page.getByRole('button',{name:'Accept all',exact:true});if(await cookie.isVisible())await cookie.click();
   onProgress({stage:'filling_package_query'});
   await selectVacationLocation(page,vacationLocationSelection(query,'from'));
   await selectVacationLocation(page,vacationLocationSelection(query,'to'));
   await selectVacationDates(page,{departure:query.date,returnDate:query.returnDate});
   await selectVacationParty(page,query);
   signal?.throwIfAborted();onProgress({stage:'submitting_package_search'});
   const useStructuredResponse=query.childrenAges.length<=1&&!(query.infants?.length)&&((query.maxResults??DEFAULT_PACKAGE_RESULT_LIMIT)===DEFAULT_PACKAGE_RESULT_LIMIT);
   const packageResponseOutcome=useStructuredResponse?page.waitForResponse(response=>{try{const url=new URL(response.url());return url.protocol==='https:'&&url.hostname==='vacations-api.aircanada.com'&&url.pathname==='/packages-search/search'&&response.request().method()==='GET';}catch{return false;}},{timeout:45000}).then(response=>({response}),error=>({error})):null;
   await page.locator('#flight_hotel_tab').getByRole('button',{name:'Search',exact:true}).click();
   await page.waitForURL('https://vacations.aircanada.com/en/packages/product-listing?**',{timeout:45000});
   await page.locator('.hotel-item').first().waitFor({state:'visible',timeout:30000});
   if(useStructuredResponse){
    const outcome=await packageResponseOutcome;signal?.throwIfAborted();
    if(outcome.error)throw new SourceRequestError('Air Canada Vacations did not return its structured package response.',{status:'invalid_response'});
    onProgress({stage:'validating_structured_package_results'});
    const {data,responseBytes}=await readVacationPackageApiResponse(outcome.response),listingUrl=page.url();
    const result=normalizeVacationApiResponse(data,{query,requestUrl:outcome.response.url(),sourceUrl:listingUrl,observedAt:new Date().toISOString(),currencyTermsText,responseBytes});
    const coverage={...result.coverage,listingCardsRendered:await page.locator('.hotel-item').count()};
    return {...result,coverage,limitation:`Received ${coverage.returnedPackages} package records from one provider response. ${coverage.moreAvailable?'Additional listings remain beyond the first page. ':''}Amounts are estimated package totals, not checkout-confirmed; local charges may apply.`};
   }
   const resultCoverage=await loadVacationResultPages(page,query.maxResults??DEFAULT_PACKAGE_RESULT_LIMIT,onProgress);
   const panelCoverage=await inspectVacationFlightPanels(page.locator('.hotel-item'),onProgress,query.maxResults??DEFAULT_PACKAGE_RESULT_LIMIT);
   const coverage={...resultCoverage,...panelCoverage};
   const result=await normalizeVacationListing(await page.content(),{query,listingUrl:page.url(),observedAt:new Date().toISOString(),currencyTermsText});
   return {...result,query,coverage,limitation:`Inspected ${coverage.flightPanelsAttempted} package flight panels within the selected result limit of ${coverage.resultLimit}. ${coverage.moreAvailable?'The provider indicated additional listings remained beyond the searched page budget. ':''}${coverage.pageLoadStopped?'A provider result-page expansion did not complete; coverage is partial. ':''}Estimated package totals are not checkout-confirmed and local charges may apply.`};
  }catch(error){if(providerRefusal)throw providerRefusal;throw error;
  }finally{clearTimeout(timeout);}
 }finally{signal?.removeEventListener('abort',abortBrowser);await browser?.close().catch(()=>{});active=false;}
}
