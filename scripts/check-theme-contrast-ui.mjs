import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],external=[];
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
 await page.waitForSelector('main');
 await page.evaluate(()=>{
  const card=document.createElement('article');card.className='offer';card.setAttribute('aria-label','Controlled visual contrast fixture');
  card.innerHTML='<div><strong>Example result label</strong><p class="route">YHZ <span>→</span> BCN</p><p class="muted">Connection and source details</p><p class="note">Observation freshness and limitations</p></div><div class="price"><strong>Observed price</strong><small>Currency and traveler scope</small><a href="#contrast-fixture">Seller handoff</a></div>';
  document.querySelector('.search')?.append(card);
 });
 const themes={},palettes={};
 for(const theme of ['dark','light']){
  await page.evaluate(value=>{document.documentElement.dataset.theme=value;document.documentElement.style.colorScheme=value;},theme);
  palettes[theme]=await page.evaluate(()=>Object.fromEntries(['--color-page-bg','--color-text-primary','--color-surface','--color-accent'].map(name=>[name,getComputedStyle(document.documentElement).getPropertyValue(name).trim()])));
  for(const [token,value]of Object.entries(palettes[theme]))assert.ok(value,`${theme} theme is missing ${token}.`);
  assert.notEqual(palettes[theme]['--color-page-bg'],palettes[theme]['--color-text-primary'],`${theme} page and text tokens must remain distinct.`);
  themes[theme]=await page.evaluate(()=>{
   const rgb=value=>{const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(value);return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null;};
   const luminance=color=>{const values=color.slice(0,3).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2];};
   const contrast=(foreground,background)=>{const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
   const imageColors=value=>[...value.matchAll(/rgba?\([^)]*\)/g)].map(match=>rgb(match[0])).filter(color=>color&&color[3]>.05);
   const selectors='h1,h2,h3,p,a,button,label,span,small,strong,summary,legend,li,textarea';
   const failures=[];let visibleText=0,minimum={ratio:Infinity,text:'',selector:''};
   for(const element of document.querySelectorAll(selectors)){
    const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
    if(rect.width===0||rect.height===0||style.visibility==='hidden'||style.display==='none')continue;
    const foreground=rgb(style.color);if(!foreground||foreground[3]<.1)continue;
    visibleText++;
    const size=parseFloat(style.fontSize),bold=Number(style.fontWeight)>=700,threshold=size>=24||bold&&size>=18.67?3:4.5;
    let backgrounds=[],node=element;
    while(node&&node!==document.documentElement){
     const parentStyle=getComputedStyle(node),solid=rgb(parentStyle.backgroundColor);
     if(solid&&solid[3]>.01){backgrounds=[solid];break;}
     if(parentStyle.backgroundImage!=='none'){backgrounds=imageColors(parentStyle.backgroundImage);if(backgrounds.length)break;}
     node=node.parentElement;
    }
    if(!backgrounds.length){const root=rgb(getComputedStyle(document.documentElement).backgroundColor);if(root)backgrounds=[root];}
    if(!backgrounds.length){failures.push({text:(element.innerText||element.getAttribute('aria-label')||'').trim().slice(0,80),reason:'No measurable background color.'});continue;}
    const ratios=backgrounds.map(background=>({background:background.slice(0,3).map(Math.round),ratio:contrast(foreground,background)}));
    const observed=Math.min(...ratios.map(item=>item.ratio));
    const text=(element.innerText||element.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,80);
    if(observed<minimum.ratio)minimum={ratio:Number(observed.toFixed(2)),text,selector:element.tagName.toLowerCase()};
    if(observed+1e-9<threshold)failures.push({text,selector:element.tagName.toLowerCase(),fontSize:size,fontWeight:style.fontWeight,required:threshold,observed:Number(observed.toFixed(2)),backgrounds:ratios.map(item=>({rgb:item.background,contrast:Number(item.ratio.toFixed(2))}))});
   }
   return {visibleText,minimum,failures};
  });
  assert.ok(themes[theme].visibleText>0,`No text was audited in ${theme} theme.`);
  assert.deepEqual(themes[theme].failures,[],`${theme} theme contrast failures: ${JSON.stringify(themes[theme].failures)}`);
 }
 assert.notEqual(palettes.dark['--color-page-bg'],palettes.light['--color-page-bg'],'Page background token must change between themes.');
 assert.notEqual(palettes.dark['--color-text-primary'],palettes.light['--color-text-primary'],'Primary text token must change between themes.');
 assert.deepEqual(external,[],'External requests must remain blocked.');
 assert.deepEqual(errors,[],'Page should render without browser errors.');
 console.log(JSON.stringify({ui:'theme-text-contrast',themes,palettes,externalRequestsBlocked:true,browserErrors:errors.length,scope:'visible initial-search text and representative fixture result-card classes; semantic CSS palette tokens, computed solid backgrounds and gradient stop colors'}));
}finally{await browser.close();}
