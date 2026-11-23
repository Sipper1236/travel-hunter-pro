import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base.origin){external.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/airports')return route.fulfill({json:{items:[]}});
  if(url.pathname==='/api/airlines')return route.fulfill({json:{items:[{name:'Air Canada',code:'AC'}],sourceUrl:'https://www.wikidata.org/',limitation:'Controlled browser fixture.'}});
  if(url.pathname==='/api/health')return route.fulfill({json:{status:'ok',queueDepth:0,workerAvailable:true,expiredLeases:0,expiredDeadlines:0,workers:{running:1,stale:0,stopped:0}}});
  if(url.pathname.startsWith('/api/'))return route.fulfill({status:400,json:{error:'Unexpected API request.'}});
  return route.continue();
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('main');
 await page.keyboard.press('Tab');
 const skipLink=page.locator('a.skip-link');
 assert.equal(await skipLink.evaluate(element=>document.activeElement===element),true,'The skip link should be the first keyboard focus target.');
 assert.equal(await skipLink.innerText(),'Skip to flight search','The first keyboard stop should offer a direct route to the main task.');
 assert.equal(await skipLink.evaluate(element=>getComputedStyle(element).position),'fixed','The skip link should be placed above the page when focused.');
 await page.keyboard.press('Enter');
 assert.equal(new URL(page.url()).hash,'#flight-search','The skip link should navigate to Flight Search.');
 assert.equal(await page.locator('#flight-search').count(),1,'The skip link destination should be unique.');
 assert.equal(await page.locator('#flight-search').evaluate(element=>document.activeElement===element),true,'The skip link should move keyboard focus to the search section.');
 const settings=page.locator('details.advanced-filters');
 const summary=settings.locator(':scope > summary');
 await summary.focus();await page.keyboard.press('Enter');
 assert.equal(await settings.evaluate(element=>element.open),false,'Enter should close the focused advanced-settings disclosure.');
 await page.keyboard.press('Space');
 assert.equal(await settings.evaluate(element=>element.open),true,'Space should reopen the focused advanced-settings disclosure.');
 const airlineQuery=page.getByLabel('Find an airline by name or code');
 await airlineQuery.fill('Air Canada');
 const airlineSuggestion=page.getByRole('button',{name:'Include Air Canada (AC) in airline filter'});
 await airlineSuggestion.waitFor({state:'visible',timeout:5000});
 assert.equal(await airlineSuggestion.evaluate(element=>element.closest('[aria-live="polite"]')!==null),true,'Dynamic airline suggestions should be announced politely.');
 await airlineSuggestion.focus();
 await page.keyboard.press('Enter');
 assert.equal(await page.getByRole('button',{name:'Remove Air Canada (AC) from airline filter'}).getAttribute('aria-pressed'),'true','The live airline control should be keyboard-operable and expose its selected state.');
 const audit=await page.evaluate(()=>{
  const elements=[...document.querySelectorAll('input:not([type="hidden"]),select,textarea,button')];
  const nameOf=el=>{
   const labelText=el.labels?[...el.labels].map(label=>label.innerText).join(' ').trim():'';
   return el.getAttribute('aria-label')?.trim()||labelText||((el.tagName==='BUTTON')?el.innerText.trim():'');
  };
  const unnamed=elements.filter(el=>!nameOf(el)).map(el=>({tag:el.tagName,type:el.type||null,id:el.id||null}));
  const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
  const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
  const brokenRefs=[...document.querySelectorAll('[aria-describedby],[aria-labelledby]')].flatMap(el=>['aria-describedby','aria-labelledby'].flatMap(attribute=>(el.getAttribute(attribute)||'').split(/\s+/).filter(Boolean).filter(id=>!document.getElementById(id)).map(id=>({attribute,id,tag:el.tagName}))));
  const fieldsets=[...document.querySelectorAll('fieldset')];
  const missingLegends=fieldsets.filter(fieldset=>!fieldset.querySelector(':scope > legend')).length;
  return {controlCount:elements.length,unnamed,duplicateIds,brokenRefs,fieldsetCount:fieldsets.length,missingLegends,mainLandmarks:document.querySelectorAll('main').length,advancedSettingsSummaries:[...document.querySelectorAll('details.advanced-filters > summary')].map(summary=>summary.innerText.trim())};
 });
 assert.equal(audit.unnamed.length,0,`Controls without accessible names: ${JSON.stringify(audit.unnamed)}`);
 assert.equal(audit.duplicateIds.length,0,`Duplicate IDs: ${JSON.stringify(audit.duplicateIds)}`);
 assert.equal(audit.brokenRefs.length,0,`Broken ARIA references: ${JSON.stringify(audit.brokenRefs)}`);
 assert.equal(audit.missingLegends,0,'Every fieldset must have a direct legend.');
 assert.equal(audit.mainLandmarks,1,'The page must expose exactly one main landmark.');
 assert.ok(audit.advancedSettingsSummaries.includes('More search settings'),'Advanced settings need a named summary.');
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('main');
 await page.getByLabel('Find an airline by name or code').fill('Air Canada');
 await page.getByRole('button',{name:'Include Air Canada (AC) in airline filter'}).waitFor({state:'visible',timeout:5000});
 const keyboardTargets=await page.evaluate(()=>[...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]')].map((element,index)=>({element,index})).filter(({element})=>element.tabIndex>=0&&!element.disabled&&element.checkVisibility()).map(({element,index})=>({index,name:element.getAttribute('aria-label')||element.labels?.[0]?.innerText?.trim()||element.innerText?.trim()||element.tagName,tag:element.tagName,type:element.type||null,id:element.id||null,className:typeof element.className==='string'?element.className:''})));
 assert.ok(keyboardTargets.length>0,'The page should expose keyboard targets.');
 await page.locator('a.skip-link').focus();
 for(const [position,target] of keyboardTargets.slice(1).entries()){
  await page.keyboard.press('Tab');
  let activeIndex=await page.evaluate(()=>[...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]')].indexOf(document.activeElement));
  const previousTarget=keyboardTargets[position];
  for(let internalStep=0;activeIndex===previousTarget.index&&previousTarget.type==='date'&&internalStep<4;internalStep++){
   await page.keyboard.press('Tab');
   activeIndex=await page.evaluate(()=>[...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]')].indexOf(document.activeElement));
  }
  assert.equal(activeIndex,target.index,`Tab ${position+2} should reach ${target.name} in rendered order; expected ${target.index} (${target.tag} ${target.type||''} #${target.id} .${target.className}), got ${activeIndex}.`);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({ui:'accessible-controls',...audit,keyboardDisclosure:true,dynamicAirlineSuggestion:true,keyboardTargetsTraversed:keyboardTargets.length,browserErrors:errors.length,externalRequestsBlocked:true,searchSubmitted:false}));
}finally{await browser.close();}
