// Live location check; explicit date environment variables enable an adult package search.
import {chromium} from 'playwright-core';

const base = new URL(process.env.TRAVEL_CHECK_URL || 'http://127.0.0.1:3000');
if (!['localhost','127.0.0.1','[::1]'].includes(base.hostname) || base.protocol !== 'http:') throw Error('Use the local application URL.');
const browser = await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER || '/usr/bin/chromium',headless:true});
try {
 const page = await browser.newPage();
 await page.goto(base.href);
 function captureLocationResponse(kind,term){
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{page.off('response',onResponse);reject(Error('Provider location response timed out.'));},75000);
   const onResponse=response=>{
    const url=new URL(response.url());
    if(url.pathname!=='/api/packages/locations'||response.request().method()!=='POST')return;
    let requestBody;
    try{requestBody=response.request().postDataJSON();}catch{return;}
    if(requestBody.kind!==kind||requestBody.term?.trim().toLocaleLowerCase()!==term.trim().toLocaleLowerCase())return;
    page.off('response',onResponse);
    clearTimeout(timer);
    // Capture while the response event is current; a later navigation may evict its CDP body.
    response.json().then(body=>resolve({response,body}),reject);
   };
   page.on('response',onResponse);
  });
 }
 async function lookup(buttonName) {
  const kind=buttonName.includes('origins')?'from':'to',term=kind==='from'?await page.getByLabel('Package origin search',{exact:true}).inputValue():await page.getByLabel('Package destination search',{exact:true}).inputValue();
  const captured=captureLocationResponse(kind,term);
  const sent = page.waitForRequest(r=>new URL(r.url()).pathname==='/api/packages/locations'&&r.method()==='POST',{timeout:10000}).catch(()=>null);
  await page.getByRole('button',{name:buttonName,exact:true}).click();
  if (!await sent) throw Error('Website did not send the location request after the click. Inspect client readiness before diagnosing the provider.');
  console.log(JSON.stringify({lookup:buttonName,event:'local-request-sent'}));
  const {response,body}=await captured;
  if (!response.ok()) throw Error(body.error || `Lookup failed: ${response.status()}`);
  console.log(JSON.stringify({lookup:buttonName,status:response.status(),count:body.items.length,observedAt:body.observedAt}));
  return body.items;
 }
 await page.getByLabel('Package origin search',{exact:true}).fill('YHZ');
 const origin = (await lookup('Find provider origins')).find(item=>item.code==='YHZ');
 if (!origin) throw Error('Provider did not return YHZ.');
 await page.getByRole('button',{name:`${origin.label} · ${origin.type}`,exact:true}).click();
 await page.getByLabel('Package destination search',{exact:true}).fill('Barcelona');
 const destinationItems = await lookup('Find provider destinations');
 const destination = destinationItems.find(item=>item.type==='CITY'&&item.label==='Barcelona, Spain');
 if (!destination) throw Error('Provider did not return the requested Barcelona city.');
 const airportChoice = destinationItems.find(item=>/AIRPORT/.test(item.type)&&item.code==='BCN');
 if (!airportChoice) throw Error('Provider did not return Barcelona airport BCN as a separate flight-arrival choice.');
 await page.getByRole('button',{name:`${destination.label} · ${destination.type}`,exact:true}).click();
 const packageSection=page.getByRole('heading',{name:'Flight + Hotel Vacation Packages',exact:true}).locator('xpath=ancestor::section[1]');
 await packageSection.getByText(`Destination selected: ${destination.label} (${destination.type})`,{exact:true}).waitFor({state:'visible'});
 const airportSelect=packageSection.locator('select[name="destinationAirport"]');
 await airportSelect.waitFor({state:'visible'});
 await airportSelect.selectOption('BCN');
 if(await airportSelect.inputValue()!=='BCN')throw Error('The selected provider arrival airport did not persist.');
 const stopControl=packageSection.getByRole('combobox',{name:'Maximum stops per direction',exact:true});
 if(await stopControl.count()!==1||!await stopControl.locator('option[value="2"]').count())throw Error('Package maximum-stops setting is missing or incomplete.');
 const resultsControl=packageSection.getByRole('combobox',{name:'Maximum package results to inspect',exact:true});
 if(await resultsControl.count()!==1||!await resultsControl.locator('option[value="40"]').count())throw Error('Package result-limit setting is missing or incomplete.');
 if (process.env.TRAVEL_PACKAGE_DATE && process.env.TRAVEL_PACKAGE_RETURN) {
  const section=packageSection;
  await section.locator('select[name="destinationAirport"]').selectOption('BCN');
  await section.locator('[name=date]').fill(process.env.TRAVEL_PACKAGE_DATE);
  await section.locator('[name=returnDate]').fill(process.env.TRAVEL_PACKAGE_RETURN);
  await section.locator('[name=adults]').fill('1');
  await section.locator('[name=rooms]').fill('1');
  const childAge=process.env.TRAVEL_PACKAGE_CHILD_AGE;
  if(childAge!==undefined){if(!/^(?:[2-9]|1[0-7])$/.test(childAge))throw Error('TRAVEL_PACKAGE_CHILD_AGE must be 2–17 at departure.');await section.getByLabel('Children and youths (ages 2–17)',{exact:true}).fill('1');await section.getByLabel('Actual age at departure · child 1',{exact:true}).fill(childAge);}
  const maxStops=process.env.TRAVEL_PACKAGE_MAX_STOPS??'2';
  if(!['0','1','2'].includes(maxStops))throw Error('TRAVEL_PACKAGE_MAX_STOPS must be 0, 1 or 2.');
  const maxResults=process.env.TRAVEL_PACKAGE_MAX_RESULTS??'20';
  if(!['20','40'].includes(maxResults))throw Error('TRAVEL_PACKAGE_MAX_RESULTS must be 20 or 40.');
  await section.getByRole('combobox',{name:'Maximum stops per direction',exact:true}).selectOption(maxStops);
  await resultsControl.selectOption(maxResults);
  const queued=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/search/jobs'&&JSON.parse(r.postData()||'{}').action==='start',{timeout:10000});
  await section.getByRole('button',{name:'Search vacation packages',exact:true}).click();
  const request=await queued,payload=JSON.parse(request.postData()||'{}');
  if(payload.input?.maxResults!==Number(maxResults)||payload.input?.maxStops!==Number(maxStops))throw Error('Package result/stops settings did not reach the queued provider search.');
  if(payload.input?.origin!=='YHZ'||payload.input?.destinationLabel!==destination.label||payload.input?.destinationAirport!=='BCN')throw Error('Provider-selected city and flight-arrival airport did not reach the package job.');
  if(childAge!==undefined&&(payload.input?.childrenAges?.length!==1||payload.input.childrenAges[0]!==Number(childAge)))throw Error('The supplied child age did not reach the package job exactly.');
  console.log(`Submitted one-adult${childAge===undefined?'':`, one child age ${childAge}`}, one-room package search through the website with provider city ${destination.label}, arrival airport BCN, max ${maxResults} cards and ${maxStops} stops.`);
  await section.getByText(/Package search: (complete|error|cancelled)/).waitFor({timeout:240000});
  const text=await section.innerText();
  console.log(JSON.stringify({renderedCards:await section.locator('article.offer').count(),result:text}));
  if (!/Package search: complete/.test(text)) throw Error('Package search did not complete.');
  if(process.env.TRAVEL_EXPECT_NO_PACKAGES==='1'){
   if(await section.locator('article.offer').count()!==0||!new RegExp(`\\d+ excluded by the maximum-stops filter`).test(text))throw Error('The selected maximum-stops filter did not remove the observed package results.');
  }else if(!await section.locator('article.offer').count())throw Error('No completed package observations rendered.');
 } else console.log('Selected both provider locations through the website; no fare search submitted.');
} finally { await browser.close(); }
