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
  if(url.pathname==='/api/health')return route.fulfill({json:{status:'ok',queueDepth:0,workerAvailable:true,expiredLeases:0,expiredDeadlines:0,workers:{running:1,stale:0,stopped:0}}});
  if(url.pathname.startsWith('/api/'))return route.fulfill({status:400,json:{error:'Unexpected API request.'}});
  return route.continue();
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark',{timeout:5000});
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','Dark theme should be the default.');
 const theme=page.getByRole('button',{name:'Switch to light theme'});
 await theme.click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light','Theme control should switch the palette.');
 assert.equal(await page.evaluate(()=>localStorage.getItem('travel-hunter-theme')),'light','Theme preference should persist locally.');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='light',{timeout:5000});
 const widths=[];
 for(const width of [320,375,768]){
  await page.setViewportSize({width,height:900});
  await page.waitForTimeout(100);
  const metrics=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,outside:[...document.querySelectorAll('body *')].filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&(rect.left < -1||rect.right > innerWidth+1);}).slice(0,5).map(element=>({tag:element.tagName,className:typeof element.className==='string'?element.className:'',left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right)}))}));
  assert.equal(metrics.document,width,`Document must not overflow horizontally at ${width}px: ${JSON.stringify(metrics)}`);
  assert.equal(metrics.body,width,`Body must not overflow horizontally at ${width}px: ${JSON.stringify(metrics)}`);
  assert.deepEqual(metrics.outside,[],`Visible elements must fit the viewport at ${width}px: ${JSON.stringify(metrics)}`);
  widths.push(width);
 }
 const targetAudits=[];
 for(const width of [320,1280]){
  await page.setViewportSize({width,height:900});
  const audit=await page.evaluate(()=>{
   const issues=[],targets=[];let inlineTextLinks=0;
   const record=(element,target=element,label='')=>{
    const rect=target.getBoundingClientRect(),row={name:label||element.getAttribute('aria-label')||element.innerText?.trim()||element.labels?.[0]?.innerText?.trim()||element.tagName,width:Math.round(rect.width),height:Math.round(rect.height)};
    targets.push(row);if(rect.width<24||rect.height<24)issues.push(row);
   };
   for(const element of document.querySelectorAll('button,select,textarea,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),summary')){
    if(element.checkVisibility()&&!element.disabled)record(element);
   }
   for(const element of document.querySelectorAll('input[type="checkbox"],input[type="radio"]')){
    if(!element.checkVisibility()||element.disabled)continue;
    const label=element.labels?.[0];
    if(!label){issues.push({name:element.id||'unlabeled choice',width:0,height:0});continue;}
    record(element,label,label.innerText.trim());
   }
   for(const element of document.querySelectorAll('a[href]')){
    if(!element.checkVisibility()||element.classList.contains('skip-link'))continue;
    if(element.closest('p')){inlineTextLinks++;continue;}
    record(element);
   }
   return {targets:targets.length,inlineTextLinkExceptions:inlineTextLinks,issues};
  });
  assert.deepEqual(audit.issues,[],`Interactive targets must measure at least 24×24 CSS pixels at ${width}px; checkbox/radio labels are counted as their hit target and inline text links use the WCAG inline exception: ${JSON.stringify(audit.issues)}`);
  targetAudits.push({width,targets:audit.targets,inlineTextLinkExceptions:audit.inlineTextLinkExceptions});
 }
 await page.setViewportSize({width:320,height:900});
 const comfortTargets=await page.evaluate(()=>[...document.querySelectorAll('.mode select,.filter-reset,.worker-status button,.advanced-filter-groups input,.advanced-filter-groups select')].filter(element=>element.checkVisibility()&&!element.disabled).map(element=>{const rect=element.getBoundingClientRect();return {name:element.labels?.[0]?.innerText?.trim()||element.innerText?.trim()||element.id||element.tagName,width:Math.round(rect.width),height:Math.round(rect.height)}}));
 assert.ok(comfortTargets.length>0,'The compact-control audit should find the controls it measures.');
 assert.deepEqual(comfortTargets.filter(target=>target.width<44||target.height<44),[],`Frequently used compact controls should reach the 44×44 CSS-pixel comfort target at 320px: ${JSON.stringify(comfortTargets.filter(target=>target.width<44||target.height<44))}`);
 const skipLink=page.locator('a.skip-link');
 await skipLink.focus();
 const skipTarget=await skipLink.evaluate(element=>{const rect=element.getBoundingClientRect();return {width:Math.round(rect.width),height:Math.round(rect.height)}});
 assert.ok(skipTarget.width>=24&&skipTarget.height>=24,`Focused skip link must have at least a 24×24 CSS-pixel target: ${JSON.stringify(skipTarget)}`);
 await page.setViewportSize({width:320,height:900});
 await page.evaluate(()=>{
  const spacing=new CSSStyleSheet();
  spacing.replaceSync('html{font-size:200% !important}body *{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}');
  document.adoptedStyleSheets=[...document.adoptedStyleSheets,spacing];
 });
 const enlarged=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,outside:[...document.querySelectorAll('body *')].filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&(rect.left < -1||rect.right > innerWidth+1);}).slice(0,5).map(element=>({tag:element.tagName,className:typeof element.className==='string'?element.className:'',left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right)}))}));
 assert.equal(enlarged.document,320,`Document must reflow at a narrow width with enlarged text and WCAG text spacing: ${JSON.stringify(enlarged)}`);
 assert.equal(enlarged.body,320,`Body must reflow at a narrow width with enlarged text and WCAG text spacing: ${JSON.stringify(enlarged)}`);
 assert.deepEqual(enlarged.outside,[],`Visible elements must fit when text is enlarged and spaced: ${JSON.stringify(enlarged)}`);
 assert.deepEqual(external,[],'External network requests must remain blocked.');
 assert.deepEqual(errors,[],'Page should render without browser errors.');
 console.log(JSON.stringify({ui:'responsive-layout',viewports:widths,touchTargets:targetAudits,comfortTargets:{count:comfortTargets.length,minimum:44},focusedSkipTarget:skipTarget,enlargedTextAndSpacingReflow:true,horizontalOverflow:false,themePersistence:'light-theme restored after reload',providerTraffic:'blocked',browserErrors:errors.length}));
}finally{await browser.close();}
