import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVacationQuery,searchVacation,inspectVacationFlightPanels,vacationFlightPanelBudget,loadVacationResultPages,readVacationPackageApiResponse,selectVacationPackageResponsePages} from '../lib/vacation-search.mjs';
import {openVacationFlightPanel,vacationLocationSelection} from '../lib/vacation-form.mjs';
const query={origin:'YHZ',originLabel:'Halifax Stanfield Intl. Airport (YHZ)',destinationAirport:'BCN',destinationLabel:'Barcelona, Spain',date:'2099-04-15',returnDate:'2099-04-25',adults:1,rooms:1,childrenAges:[]};
test('structured package response reader checks status, JSON type, declared and decoded bytes before parsing',async()=>{
 const response=(body,{status=200,headers={'content-type':'application/json'}}={})=>({status:()=>status,headers:()=>headers,body:async()=>Buffer.from(body)});
 assert.deepEqual(await readVacationPackageApiResponse(response('{"ok":true}',{headers:{'content-type':'application/json; charset=utf-8','content-length':'11'}})),{data:{ok:true},responseBytes:11});
 await assert.rejects(readVacationPackageApiResponse(response('x',{headers:{'content-type':'application/json','content-length':'2000001'}})),/size limit/);
 await assert.rejects(readVacationPackageApiResponse(response('x'.repeat(20),{headers:{'content-type':'application/json'}}),{maxBytes:10}),/size limit/);
 await assert.rejects(readVacationPackageApiResponse(response('{}',{headers:{'content-type':'text/html'}})),/not JSON/);
 await assert.rejects(readVacationPackageApiResponse(response('{')),/malformed JSON/);
 await assert.rejects(readVacationPackageApiResponse(response('{}',{status:429})),error=>error.httpStatus===429&&error.sourceStatus==='rate_limited');
});
test('package inspection covers the bounded visible listing instead of stopping after five cards',()=>{
 assert.equal(vacationFlightPanelBudget(0),0);assert.equal(vacationFlightPanelBudget(5),5);assert.equal(vacationFlightPanelBudget(20),20);assert.equal(vacationFlightPanelBudget(80),20);
 for(const value of [-1,1.5,NaN,'20'])assert.throws(()=>vacationFlightPanelBudget(value),/nonnegative integer/);
});
test('package panel inspector checks every card on a 20-card page and reports exact coverage',async()=>{
 const clicks=[],progress=[];const cards={count:async()=>25,nth:index=>({locator:()=>({count:async()=>1,nth:()=>({isVisible:async()=>true,getAttribute:async name=>name==='aria-controls'?`panel-${index}`:'false',click:async()=>clicks.push(index)})})})};
 assert.deepEqual(await inspectVacationFlightPanels(cards,event=>progress.push(event)),{visibleCards:25,flightPanelsAttempted:20,flightPanelLimit:20});
 assert.deepEqual(clicks,Array.from({length:20},(_,index)=>index));assert.equal(progress.length,21);assert.equal(progress.at(-1).panelsChecked,20);assert.equal(progress.at(-1).panelsPlanned,20);
});
test('package panel inspection respects the selectable forty-card ceiling',async()=>{
 const clicks=[];const cards={count:async()=>45,nth:index=>({locator:()=>({count:async()=>1,nth:()=>({isVisible:async()=>true,getAttribute:async name=>name==='aria-controls'?`panel-${index}`:'false',click:async()=>clicks.push(index)})})})};
 const result=await inspectVacationFlightPanels(cards,()=>{},40);
 assert.equal(result.flightPanelsAttempted,40);assert.equal(result.flightPanelLimit,40);assert.equal(clicks.length,40);
});
test('package result expansion opens only the bounded extra page and reports further results',async()=>{
 let cards=20,clicks=0,waits=0;
 const page={locator:selector=>selector==='.hotel-item'?{count:async()=>cards}:{isVisible:async()=>cards===20,click:async()=>{clicks++;cards=40;}},waitForFunction:async(_fn,prior,options)=>{waits++;assert.equal(prior,20);assert.equal(options.timeout,20000);}};
 const limited=await loadVacationResultPages(page,20);assert.deepEqual(limited,{visibleCards:20,pagesExpanded:0,moreAvailable:true,pageLoadStopped:false,resultLimit:20});assert.equal(clicks,0);
 const expanded=await loadVacationResultPages(page,40);assert.deepEqual(expanded,{visibleCards:40,pagesExpanded:1,moreAvailable:false,pageLoadStopped:false,resultLimit:40});assert.equal(clicks,1);assert.equal(waits,1);
});
test('package result loading stops after its page budget when a provider adds only a small batch',async()=>{
 let cards=12,clicks=0;
 const page={locator:selector=>selector==='.hotel-item'?{count:async()=>cards}:{isVisible:async()=>true,click:async()=>{clicks++;cards++;}},waitForFunction:async()=>{}};
 const result=await loadVacationResultPages(page,40);
 assert.deepEqual(result,{visibleCards:13,pagesExpanded:1,moreAvailable:true,pageLoadStopped:false,resultLimit:40});assert.equal(clicks,1);
 const singlePage=await loadVacationResultPages(page,20);
 assert.deepEqual(singlePage,{visibleCards:13,pagesExpanded:0,moreAvailable:true,pageLoadStopped:false,resultLimit:20});assert.equal(clicks,1);
});
test('structured ACV response selection requires exactly the rendered sequential offsets',()=>{
 const first={offset:0,response:{id:'first'},requestUrl:'https://vacations-api.aircanada.com/packages-search/search?offset=0',observedAt:'2026-11-23T12:00:00Z'};
 const second={offset:20,response:{id:'second'},requestUrl:'https://vacations-api.aircanada.com/packages-search/search?offset=20',observedAt:'2026-11-23T12:00:01Z'};
 assert.deepEqual(selectVacationPackageResponsePages([second,first],[0,20]),[first,second]);
 assert.deepEqual(selectVacationPackageResponsePages([first],[0]),[first]);
 for(const [records,offsets] of [[[first],[0,20]],[[first,first],[0,20]],[[first,second,second],[0,20]],[[second],[20]],[[first],[20]]])assert.throws(()=>selectVacationPackageResponsePages(records,offsets),/ACV|sequential/);
});
test('duplicate flight controls choose one visible matching target and reject ambiguity',async()=>{
 let clicks=0;const link=(visible,target,expanded='false')=>({isVisible:async()=>visible,getAttribute:async name=>name==='aria-controls'?target:expanded,click:async()=>{clicks++;}});
 const card=entries=>({locator:()=>({count:async()=>entries.length,nth:i=>entries[i]})});
 assert.equal(await openVacationFlightPanel(card([link(false,'panel'),link(true,'panel')])),true);assert.equal(clicks,1);
 assert.equal(await openVacationFlightPanel(card([link(true,'panel','true')])),true);assert.equal(clicks,1);
 await assert.rejects(openVacationFlightPanel(card([link(true,'one'),link(true,'two')])),/ambiguous/);assert.equal(clicks,1);
 assert.equal(await openVacationFlightPanel(card([link(false,'panel')])),false);
});
test('package query preserves explicit locations, dates and occupancy',()=>assert.deepEqual(validateVacationQuery(query),query));
test('package maximum-stops setting is validated and preserved',()=>{
 for(const maxStops of [0,1,2])assert.equal(validateVacationQuery({...query,maxStops}).maxStops,maxStops);
 for(const maxStops of [-1,3,1.5,'1'])assert.throws(()=>validateVacationQuery({...query,maxStops}),/maximum of zero, one, or two stops/);
});
test('package result-page budget is bounded to one or two visible pages',()=>{
 assert.equal(validateVacationQuery({...query,maxResults:20}).maxResults,20);
 assert.equal(validateVacationQuery({...query,maxResults:40}).maxResults,40);
 for(const maxResults of [0,19,41,100,'40'])assert.throws(()=>validateVacationQuery({...query,maxResults}),/package result limit/i);
});
test('package widget searches by the selected exact provider labels, not airport codes',()=>{
 assert.deepEqual(vacationLocationSelection(query,'from'),{kind:'from',searchText:query.originLabel,exactLabel:query.originLabel});
 assert.deepEqual(vacationLocationSelection(query,'to'),{kind:'to',searchText:query.destinationLabel,exactLabel:query.destinationLabel});
 assert.throws(()=>vacationLocationSelection({originLabel:'YHZ'},'from'),/exact provider location label/);
});
test('package query accepts exact child ages in one room and fails closed on unsupported occupancy',()=>{
 assert.deepEqual(validateVacationQuery({...query,childrenAges:[8,16]}),{...query,childrenAges:[8,16]});
 for(const change of [{childrenAges:[1]},{childrenAges:[18]},{childrenAges:['8']},{childrenAges:[8],rooms:2},{childrenAges:Array(9).fill(8)},{childrenAges:Array(8).fill(8),adults:2},{infantsOnLap:1},{travelers:[{id:'infant'}],childrenAges:[]},{rooms:2},{adults:0},{date:'2099-02-30'},{returnDate:query.date},{destinationLabel:''},{destinationAirport:'Europe'},{cabin:'business'},{minStars:3},{maxPrice:100.001},{filters:{maxStops:0}}])assert.throws(()=>validateVacationQuery({...query,...change}));
});
test('package query accepts only validated lap infants under two for the whole trip',()=>{
 const infant={seating:'lap',departureAge:1,returnAge:1};
 assert.deepEqual(validateVacationQuery({...query,infants:[infant]}),{...query,childrenAges:[],infants:[infant]});
 for(const change of [
  {infants:[{...infant,departureAge:2}]},{infants:[{...infant,returnAge:2}]},
  {infants:[{...infant,seating:'seat'}]},{infants:[{...infant,departureAge:3}]},
  {infants:[{...infant,birthDate:'2025-04-26'}]},
  {infants:[infant,infant],adults:1},{infants:[infant],rooms:2},
  {infants:[infant],childrenAges:[8],rooms:2},{infants:[infant],adults:1,childrenAges:Array(8).fill(8)}
 ]) assert.throws(()=>validateVacationQuery({...query,...change}));
 assert.equal(validateVacationQuery({...query,infants:[{...infant,departureAge:0,returnAge:0}]}).infants[0].departureAge,0);
});
test('currency evidence must be verified before launching a provider browser',async()=>{
 let launches=0;
 for(const response of [new Response('Unavailable',{status:503}),new Response('Currency terms unavailable'),new Response('x'.repeat(2_000_001))]){
  await assert.rejects(searchVacation(query,{fetcher:async()=>response,launch:async()=>{launches++;throw Error('unexpected launch');}}),/currency terms/);
 }
 assert.equal(launches,0);
});

test('package widget operations stop during a shared source cooldown before browser launch',async()=>{
 let launches=0;
 const policy={reserveSource:()=>({blockedUntil:Date.now()+60000,status:'rate_limited'}),deferSource(){}};
 await assert.rejects(searchVacation(query,{policy,fetcher:async()=>new Response('All prices are in Canadian currency, unless otherwise indicated'),launch:async()=>{launches++;throw Error('must not launch');}}),error=>error.sourceStatus==='rate_limited'&&error.retryAt>Date.now());
 assert.equal(launches,0);
});

test('package browser authorization and rate refusals persist cooldowns and close the browser',async()=>{
 const deferred=[];let responseListener,closes=0;
 const policy={reserveSource:()=>({waitMs:0}),deferSource:(...args)=>deferred.push(args)};
 const browser={newPage:async()=>({setDefaultTimeout(){},on:(event,listener)=>{if(event==='response')responseListener=listener;},goto:async()=>{responseListener({url:()=> 'https://vacations-api.aircanada.com/packages/search',status:()=>429,headers:()=>({'retry-after':'20'})});throw Error('Browser closed');}}),close:async()=>{closes++;}};
 await assert.rejects(searchVacation(query,{policy,fetcher:async()=>new Response('All prices are in Canadian currency, unless otherwise indicated'),launch:async()=>browser}),error=>error.sourceStatus==='rate_limited'&&error.retryAt>Date.now());
 assert.equal(deferred.length,1);assert.equal(deferred[0][0],'Air Canada Vacations');assert.equal(deferred[0][2],'rate_limited');assert.ok(closes>=1);
});
test('package search stops on a security challenge before form use and persists a cooldown',async()=>{
 const deferred=[];let closes=0,fieldWaits=0;
 const page={setDefaultTimeout(){},on(){},goto:async()=>{},title:async()=>'Security verification',locator:selector=>selector==='body'?{innerText:async()=>'Please verify that you are human before continuing.'}:selector.includes('iframe')?{count:async()=>0}:{waitFor:async()=>{fieldWaits++;},count:async()=>1}};
 const browser={newPage:async()=>page,close:async()=>{closes++;}};
 const policy={reserveSource:()=>({waitMs:0}),deferSource:(...args)=>deferred.push(args)};
 await assert.rejects(searchVacation(query,{policy,fetcher:async()=>new Response('All prices are in Canadian currency, unless otherwise indicated'),launch:async()=>browser}),error=>error.sourceStatus==='blocked'&&error.providerCode==='access_challenge'&&error.retryAt>Date.now());
 assert.equal(deferred.length,1);assert.deepEqual([deferred[0][0],deferred[0][2]],['Air Canada Vacations','blocked']);assert.ok(deferred[0][1]>Date.now());assert.equal(fieldWaits,0);assert.ok(closes>=1);
});
test('temporary safe currency-terms GET failures retry once, while rate limits do not retry',async()=>{
 let calls=0,launches=0;
 const browser={newPage:async()=>({setDefaultTimeout(){},goto:async()=>{throw Error('Provider navigation failed');},on(){},locator:()=>({waitFor:async()=>{},count:async()=>0})}),close:async()=>{}};
 await assert.rejects(searchVacation(query,{fetcher:async()=>{if(++calls===1)throw TypeError('fetch failed');return new Response('All prices are in Canadian currency, unless otherwise indicated');},launch:async()=>{launches++;return browser;}}),/Provider navigation failed/);
 assert.equal(calls,2);assert.equal(launches,1);
 calls=0;launches=0;
 await assert.rejects(searchVacation(query,{fetcher:async()=>{calls++;return new Response('rate limited',{status:429});},launch:async()=>{launches++;return browser;}}),/currency terms.*429/);
 assert.equal(calls,1);assert.equal(launches,0);
});
test('navigation failure closes browser and releases the single-search lock',async()=>{
 let closes=0;
 const options={fetcher:async()=>new Response('All prices are in Canadian currency, unless otherwise indicated'),launch:async()=>({newPage:async()=>({setDefaultTimeout(){},goto:async()=>{throw Error('Provider navigation failed');},on(){},locator:()=>({waitFor:async()=>{},count:async()=>0})}),close:async()=>{closes++;}})};
 await assert.rejects(searchVacation(query,options),/Provider navigation failed/);
 await assert.rejects(searchVacation(query,options),/Provider navigation failed/);
 assert.equal(closes,2);
});

test('cancelling a package job closes its actual browser and releases the adapter lock',async()=>{
 let entered,failNavigation,closes=0;const loading=new Promise(resolve=>entered=resolve),controller=new AbortController(),progress=[];
 const browser={newPage:async()=>({setDefaultTimeout(){},on(){},goto:async()=>{entered();return new Promise((_resolve,reject)=>failNavigation=reject);}}),close:async()=>{closes++;failNavigation?.(Error('Browser closed'));}};
 const search=searchVacation(query,{signal:controller.signal,onProgress:event=>progress.push(event.stage),fetcher:async()=>new Response('All prices are in Canadian currency, unless otherwise indicated'),launch:async()=>browser});
 await loading;controller.abort();await assert.rejects(search,/Browser closed/);assert.ok(closes>=1);assert.ok(progress.includes('loading_package_provider'));
 let fetches=0;await assert.rejects(searchVacation(query,{signal:controller.signal,fetcher:async()=>{fetches++;}}),/abort/i);assert.equal(fetches,0);
});
