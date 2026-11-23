import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVacationSuggestions,lookupVacationSuggestions,matchesVacationSuggestionUrl,readVacationSuggestionResponse} from '../lib/vacation-suggestions.mjs';
import {selectVacationLocation,typeVacationLocation} from '../lib/vacation-form.mjs';
import {POST} from '../app/api/packages/locations/route.js';

test('only matching provider suggestions become selectable labels',()=>{
 const body={term:'YHZ',suggestions:[{group:'AIRPORT_GROUP',entities:[{name:'Halifax Stanfield Intl. Airport (YHZ)',code:'YHZ',type:'AIRPORTGROUP'},{name:'Invalid',code:'bad',type:''}]}]};
 assert.deepEqual(normalizeVacationSuggestions(body,'yhz').items,[{label:'Halifax Stanfield Intl. Airport (YHZ)',type:'AIRPORTGROUP',code:'YHZ'}]);
 assert.throws(()=>normalizeVacationSuggestions({...body,term:'YUL'},'YHZ'),/did not match/);
 assert.equal(matchesVacationSuggestionUrl('https://vacations-api.aircanada.com/geo-insight/suggestions?query=Barcelona','to','Barcelona'),true);
 assert.equal(matchesVacationSuggestionUrl('https://vacations-api.aircanada.com/geo-insight/suggestions?query=Barcelona&journeyType=origin','to','Barcelona'),false);
 assert.equal(matchesVacationSuggestionUrl('https://elsewhere.example/geo-insight/suggestions?query=Barcelona','to','Barcelona'),false);
});
test('ACV structured suggestions enforce the decoded response byte limit before JSON parsing',async()=>{
 const value=JSON.stringify({term:'YHZ',suggestions:[{entities:[{name:'Halifax Stanfield Intl. Airport (YHZ)',type:'AIRPORTGROUP',code:'YHZ'}]}]});
 const exact=await readVacationSuggestionResponse({headers:()=>({'content-length':String(Buffer.byteLength(value))}),body:async()=>Buffer.from(value)},'YHZ',{maxBytes:Buffer.byteLength(value)});
 assert.equal(exact.items[0].code,'YHZ');
 let bodyReads=0;
 await assert.rejects(readVacationSuggestionResponse({headers:()=>({'content-length':'1001'}),body:async()=>{bodyReads++;return Buffer.from('x');}},'YHZ',{maxBytes:1000}),/size limit/);
 assert.equal(bodyReads,0);
 await assert.rejects(readVacationSuggestionResponse({headers:()=>({}),body:async()=>Buffer.alloc(1001)},'YHZ',{maxBytes:1000}),/size limit/);
 await assert.rejects(readVacationSuggestionResponse({headers:()=>({}),body:async()=>Buffer.from('{')},'YHZ'),/valid JSON/);
});
test('lookup reads the widget response and closes browser; provider refusals do not create choices',async()=>{
 let closes=0;const field={waitFor:async()=>{},click:async()=>{},press:async()=>{},pressSequentially:async()=>{},inputValue:async()=>'YHZ'};
 const makeLaunch=status=>async()=>({close:async()=>{closes++;},newPage:async()=>({goto:async()=>{},locator:()=>field,getByRole:()=>({isVisible:async()=>false}),waitForResponse:async()=>({ok:()=>status===200,status:()=>status,headers:()=>({}),body:async()=>Buffer.from(JSON.stringify({term:'YHZ',suggestions:[{entities:[{name:'Halifax Airport',type:'AIRPORTGROUP',code:'YHZ'}]}]}))})})});
 const result=await lookupVacationSuggestions({kind:'from',term:'YHZ'},{launch:makeLaunch(200),policy:null,cache:new Map()});assert.equal(result.items[0].code,'YHZ');
 await assert.rejects(lookupVacationSuggestions({kind:'from',term:'YHZ'},{launch:makeLaunch(401),policy:null,cache:new Map()}),/temporarily unavailable/);assert.equal(closes,2);
 await assert.rejects(lookupVacationSuggestions({kind:'to',term:'Barcelona'},{launch:makeLaunch(200),policy:null,cache:new Map()}),/Select a provider origin/);
});
test('exact ACV autocomplete repeats use a bounded five-minute cache with original observation time',async()=>{
 const cache=new Map(),body=JSON.stringify({term:'YHZ',suggestions:[{entities:[{name:'Halifax Airport',type:'AIRPORTGROUP',code:'YHZ'}]}]});let calls=0,at=1_800_000_000_000;
 const launch=async()=>{calls++;return {close:async()=>{},newPage:async()=>({goto:async()=>{},locator:()=>({waitFor:async()=>{},click:async()=>{},press:async()=>{},pressSequentially:async()=>{},inputValue:async()=>'YHZ'}),getByRole:()=>({isVisible:async()=>false}),waitForResponse:async()=>({ok:()=>true,headers:()=>({}),body:async()=>Buffer.from(body)})})};};
 const input={kind:'from',term:'YHZ'},options={launch,policy:null,cache,now:()=>at};
 const first=await lookupVacationSuggestions(input,options),second=await lookupVacationSuggestions(input,options);
 assert.equal(calls,1);assert.equal(first.cached,false);assert.equal(second.cached,true);assert.equal(second.observedAt,first.observedAt);assert.deepEqual(second.items,first.items);assert.equal(second.cacheExpiresAt,new Date(at+5*60_000).toISOString());
 at+=5*60_000;
 const refreshed=await lookupVacationSuggestions(input,options);assert.equal(calls,2);assert.equal(refreshed.cached,false);
});
test('ACV autocomplete cache evicts old queries after one hundred entries',async()=>{
 const cache=new Map(),bodyFor=term=>JSON.stringify({term,suggestions:[{entities:[{name:`Location ${term}`,type:'CITY'}]}]});let calls=0;
 for(let index=0;index<100;index++){
  const term=`q${String(index).padStart(2,'0')}`;
  const requestLaunch=async()=>{calls++;return {close:async()=>{},newPage:async()=>({goto:async()=>{},locator:()=>({waitFor:async()=>{},click:async()=>{},press:async()=>{},pressSequentially:async()=>{},inputValue:async()=>term}),getByRole:()=>({isVisible:async()=>false}),waitForResponse:async()=>({ok:()=>true,headers:()=>({}),body:async()=>Buffer.from(bodyFor(term))})})};};
  await lookupVacationSuggestions({kind:'from',term},{launch:requestLaunch,policy:null,cache});
 }
 assert.equal(cache.size,100);assert.equal(calls,100);
 const overflowLaunch=async()=>{calls++;return {close:async()=>{},newPage:async()=>({goto:async()=>{},locator:()=>({waitFor:async()=>{},click:async()=>{},press:async()=>{},pressSequentially:async()=>{},inputValue:async()=> 'q100'}),getByRole:()=>({isVisible:async()=>false}),waitForResponse:async()=>({ok:()=>true,headers:()=>({}),body:async()=>Buffer.from(bodyFor('q100'))})})};};
 await lookupVacationSuggestions({kind:'from',term:'q100'},{launch:overflowLaunch,policy:null,cache});
 assert.equal(calls,101);assert.equal(cache.size,100);
 const refreshLaunch=async()=>{calls++;return {close:async()=>{},newPage:async()=>({goto:async()=>{},locator:()=>({waitFor:async()=>{},click:async()=>{},press:async()=>{},pressSequentially:async()=>{},inputValue:async()=> 'q00'}),getByRole:()=>({isVisible:async()=>false}),waitForResponse:async()=>({ok:()=>true,headers:()=>({}),body:async()=>Buffer.from(bodyFor('q00'))})})};};
 await lookupVacationSuggestions({kind:'from',term:'q00'},{launch:refreshLaunch,policy:null,cache});
 assert.equal(calls,102);assert.equal(cache.size,100);
});
test('location endpoint rejects nonlocal requests before browser launch',async()=>{
 const response=await POST(new Request('http://example.com/api/packages/locations',{method:'POST',body:'{}'}));assert.equal(response.status,403);
});

test('suggestion failures distinguish missing responses from provider refusals and close the browser',async()=>{
 for(const status of [null,401,429]){
  let closed=0;
  const field={waitFor:async()=>{},click:async()=>{},press:async()=>{},pressSequentially:async()=>{},inputValue:async()=>'YHZ'};
  const launch=async()=>({close:async()=>{closed++;},newPage:async()=>({goto:async()=>{},locator:()=>field,getByRole:()=>({isVisible:async()=>false}),waitForResponse:async()=>{if(status===null)throw Object.assign(Error('timeout'),{name:'TimeoutError'});return {ok:()=>false,status:()=>status};}})});
  await assert.rejects(lookupVacationSuggestions({kind:'from',term:'YHZ'},{launch,policy:null,cache:new Map()}),error=>{
   assert.equal(error.code,status===null?'provider_suggestion_timeout':'provider_suggestion_refused');
   assert.equal(error.providerStatus,status??undefined);
   return true;
  });
  assert.equal(closed,1);
 }
});

test('widget suggestion calls use shared pacing and persist auth/rate refusals without launching again',async()=>{
 const slots=[],deferred=[];let launches=0;
 const policy={reserveSource:(provider,gapMs)=>{slots.push({provider,gapMs});return {waitMs:0};},deferSource:(...args)=>deferred.push(args)};
 const field={waitFor:async()=>{},click:async()=>{},press:async()=>{},pressSequentially:async()=>{},inputValue:async()=>'YHZ'};
 const launch=async()=>{launches++;return {close:async()=>{},newPage:async()=>({goto:async()=>{},locator:()=>field,getByRole:()=>({isVisible:async()=>false}),waitForResponse:async()=>({ok:()=>false,status:()=>429,headers:()=>({'retry-after':'10'})})})};};
 const cache=new Map();await assert.rejects(lookupVacationSuggestions({kind:'from',term:'YHZ'},{launch,policy,cache}),error=>error.sourceStatus==='rate_limited'&&error.retryAt>Date.now());
 assert.deepEqual(slots,[{provider:'Air Canada Vacations',gapMs:1000}]);assert.equal(deferred.length,1);assert.equal(deferred[0][0],'Air Canada Vacations');assert.equal(deferred[0][2],'rate_limited');assert.equal(launches,1);
 const blocked={reserveSource:()=>({blockedUntil:Date.now()+60000,status:'rate_limited'})};
 await assert.rejects(lookupVacationSuggestions({kind:'from',term:'YHZ'},{launch,policy:blocked,cache}),error=>error.sourceStatus==='rate_limited');assert.equal(launches,1);
});

test('provider location selection replaces selected text without triggering empty-field default restoration',async()=>{
 const calls=[];
 const field={waitFor:async()=>{},click:async()=>calls.push('click'),fill:async()=>{throw Error('fill resets the provider autocomplete');},press:async key=>{if(key==='Backspace')throw Error('Empty input restores the provider default');calls.push(key);},pressSequentially:async text=>calls.push(`type:${text}`),inputValue:async()=>calls.includes('select')?'Halifax Stanfield Intl. Airport (YHZ)':'YHZ'};
 const selection={waitFor:async()=>{},count:async()=>1,click:async()=>calls.push('select')};
 const list={getByText:(label,options)=>{assert.equal(label,'Halifax Stanfield Intl. Airport (YHZ)');assert.deepEqual(options,{exact:true});return selection;}};
 const page={locator:selector=>selector==='#flight_hotel_tab-from-input'?field:list};
 const result=await selectVacationLocation(page,{kind:'from',searchText:'YHZ',exactLabel:'Halifax Stanfield Intl. Airport (YHZ)'});
 assert.deepEqual(calls,['click','Control+A','type:YHZ','select']);
 assert.equal(result.value,'Halifax Stanfield Intl. Airport (YHZ)');
});

 test('location typing retries an overwritten default once and refuses persistent corruption',async()=>{
  for(const persistent of [false,true]){
   let attempts=0;const field={click:async()=>{},press:async()=>{},pressSequentially:async()=>{attempts++;},inputValue:async()=>persistent||attempts===1?'Toronto Pearson Intl. Airport (YYZ)':'YHZ'};
   if(persistent)await assert.rejects(typeVacationLocation(field,'YHZ'),/changed the location text/);else await typeVacationLocation(field,'YHZ');
   assert.equal(attempts,2);
  }
 });
