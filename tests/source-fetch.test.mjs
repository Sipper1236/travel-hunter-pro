import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../lib/job-store.mjs';
import {fetchSource} from '../lib/source-fetch.mjs';
import {retryAfter,SourceRequestError,sourceErrorResponse} from '../lib/source-errors.mjs';
import {searchIgnav} from '../lib/ignav.mjs';
import {searchProviders} from '../lib/providers.mjs';
import {searchRegionPair} from '../lib/regions.mjs';

test('Retry-After accepts delay seconds and HTTP dates',()=>{
 const now=Date.parse('2026-10-29T12:00:00Z');
 assert.equal(retryAfter('120',now),now+120000);
 assert.equal(retryAfter('Thu, 29 Oct 2026 12:02:00 GMT',now),now+120000);
 assert.equal(retryAfter('invalid',now),null);
});

test('429 persists a cooldown and a second call sends no network request',async()=>{
 let at=100000,calls=0;const policy=createJobStore({path:':memory:',now:()=>at});
 const options={policy,now:()=>at,fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});}};
 try{
   await assert.rejects(fetchSource('Ignav','https://example.com',{},options),error=>error.sourceStatus==='rate_limited'&&error.retryAt===at+120000);
   await assert.rejects(fetchSource('Ignav','https://example.com',{},options),error=>error.sourceStatus==='rate_limited');assert.equal(calls,1);
 }finally{policy.close();}
});

test('429 with exhausted provider quota honors the documented quota reset over a short Retry-After',async()=>{
 let at=Date.now(),calls=0;const resetAt=Math.ceil((at+28*24*60*60_000)/1000)*1000,policy=createJobStore({path:':memory:',now:()=>at});
 const options={policy,now:()=>at,fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'60','X-RateLimit-Requests-Remaining':'0','X-RateLimit-Requests-Reset':String(resetAt/1000)}});}};
 try{
  await assert.rejects(fetchSource('Expedia via Omkar','https://example.com',{},options),error=>error.sourceStatus==='rate_limited'&&error.retryAt===resetAt);
  await assert.rejects(fetchSource('Expedia via Omkar','https://example.com',{},options),error=>error.sourceStatus==='rate_limited'&&error.retryAt===resetAt);assert.equal(calls,1);
 }finally{policy.close();}
});

test('successful response that consumes the last provider quota unit blocks another worker until reset',async()=>{
 let at=Date.now(),calls=0;const directory=await mkdtemp(join(tmpdir(),'provider-success-quota-')),path=join(directory,'jobs.sqlite'),resetAt=Math.ceil((at+26*24*60*60_000)/1000)*1000,first=createJobStore({path,now:()=>at}),second=createJobStore({path,now:()=>at});
 const fetcher=async()=>{calls++;return Response.json({ok:true},{headers:{'X-RateLimit-Requests-Remaining':'0','X-RateLimit-Requests-Reset':String(resetAt/1000)}});};
 try{
  const response=await fetchSource('Expedia via Omkar','https://example.com',{}, {policy:first,now:()=>at,fetcher});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  await assert.rejects(fetchSource('Expedia via Omkar','https://example.com',{}, {policy:second,now:()=>at,fetcher}),error=>error.sourceStatus==='rate_limited'&&error.retryAt===resetAt);
  assert.equal(calls,1,'a second worker must observe the shared cooldown without another fetch');
 }finally{first.close();second.close();await rm(directory,{recursive:true,force:true});}
});

test('successful response quota inspection accepts numeric deterministic clock overrides',async()=>{
 const response=await fetchSource('Ignav','https://example.com',{}, {now:100000,fetcher:async()=>Response.json({ok:true})});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
});

test('safe requests retry a transient error once with pacing; POST is not replayed by default',async()=>{
 let at=100000,calls=0;const policy=createJobStore({path:':memory:',now:()=>at});
 try{
   const options={policy,now:()=>at,sleep:async ms=>{at+=ms;},fetcher:async()=>++calls===1?new Response('',{status:503}):Response.json({ok:true})};
   assert.equal((await fetchSource('Expedia','https://example.com',{},options)).status,200);assert.equal(calls,2);assert.ok(at>=101000);
   calls=0;await assert.rejects(fetchSource('NDC','https://example.com',{method:'POST'},options),error=>error.httpStatus===503);assert.equal(calls,1);
 }finally{policy.close();}
});

test('exhausted GET 5xx retries create a shared short cooldown',async()=>{
 let at=100000,calls=0,lastAttemptAt=at;const policy=createJobStore({path:':memory:',now:()=>at});
 try{
  const options={policy,now:()=>at,sleep:async ms=>{at+=ms;},fetcher:async()=>{calls++;lastAttemptAt=at;return new Response('',{status:503});}};
  await assert.rejects(fetchSource('Expedia via Omkar','https://example.com',{},options),error=>error.sourceStatus==='temporarily_unavailable'&&error.httpStatus===503&&error.retryAt===lastAttemptAt+30_000);
  assert.equal(calls,2,'a safe GET retries once before opening the cooldown');
  await assert.rejects(fetchSource('Expedia via Omkar','https://example.com',{},options),error=>error.sourceStatus==='temporarily_unavailable'&&error.retryAt===lastAttemptAt+30_000);
  assert.equal(calls,2,'the shared source policy prevents another request during the cooldown');
 }finally{policy.close();}
});

test('access denial and long service Retry-After never retry automatically',async()=>{
 for(const status of [401,403,503]){
   let calls=0;await assert.rejects(fetchSource('Source','https://example.com',{}, {fetcher:async()=>{calls++;return new Response('',{status,headers:{'Retry-After':'600'}});}}),error=>Boolean(error.retryAt));assert.equal(calls,1);
 }
});

test('pacing and cooldown state is shared between independent database connections',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'source-policy-')),path=join(directory,'jobs.sqlite'),now=()=>100000;
 const first=createJobStore({path,now}),second=createJobStore({path,now});
 try{assert.equal(first.reserveSource('Ignav',1000).waitMs,0);assert.equal(second.reserveSource('Ignav',1000).waitMs,1000);first.deferSource('Ignav',200000,'rate_limited');assert.equal(second.reserveSource('Ignav',1000).blockedUntil,200000);assert.equal(second.reserveSource('Expedia',1000).waitMs,0);}finally{first.close();second.close();await rm(directory,{recursive:true,force:true});}
});

test('real adapter HTTP rate limit stops a regional scan after the first pair',async()=>{
 let calls=0;const result=await searchRegionPair({origin:'Example',destination:'Other',date:'2099-04-15',adults:1,children:0,childrenAges:[],cabin:'economy',source:'ignav'},async name=>({region:{name},airports:name==='Example'?[{code:'AAA'},{code:'BBB'}]:[{code:'CCC'}],method:'test'}),input=>searchProviders(input,{searchIgnav:query=>searchIgnav(query,{apiKey:'test',fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});}})}));
 assert.equal(calls,1);assert.equal(result.coverage.stoppedBySource,true);assert.equal(result.coverage.checked[0].sources[0].status,'rate_limited');assert.ok(result.coverage.checked[0].sources[0].retryAt);
});

test('API error responses retain rate status and a usable retry time',async()=>{
 const retryAt=Date.now()+60000,response=sourceErrorResponse(new SourceRequestError('Source limit reached.',{status:'rate_limited',httpStatus:429,retryAt}));
 assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>=59);const data=await response.json();assert.equal(data.retryAt,new Date(retryAt).toISOString());assert.match(data.error,/Retry after/);
});

test('SQLite busy errors are temporary service failures with a safe retry hint',async()=>{
 for(const error of [Object.assign(new Error('database is locked'),{code:'ERR_SQLITE_ERROR',errcode:5}),new Error('database table is locked'),new Error('database is busy')]){
  const response=sourceErrorResponse(error),data=await response.json();
  assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'1');
  assert.equal(data.sourceStatus,'temporarily_unavailable');assert.match(data.error,/job store is busy/i);assert.doesNotMatch(data.error,/database .*locked/i);
 }
});

test('Ignav retries only its documented 424 error with bounded backoff',async()=>{
 let calls=0;const waits=[];
 const options={retryIgnav424:true,fetcher:async()=>++calls<3?Response.json({error:{code:'unable_to_complete_request'}},{status:424}):Response.json({ok:true}),sleep:async ms=>waits.push(ms),random:()=>0};
 assert.equal((await fetchSource('Ignav','https://ignav.com/api/fares/round-trip',{method:'POST'}, {...options,retrySafe:true})).status,200);
 assert.equal(calls,3);assert.deepEqual(waits,[1000,3000]);
 calls=0;await assert.rejects(fetchSource('Ignav','https://example.com',{}, {...options,fetcher:async()=>{calls++;return Response.json({error:{code:'unsupported_search',message:'Private upstream detail'}},{status:424});}}),e=>e.httpStatus===424&&e.sourceStatus==='unsupported_trip'&&e.providerCode==='unsupported_search'&&!e.message.includes('Private'));assert.equal(calls,1);
});

test('unknown Ignav error codes never become retriable or leak upstream content',async()=>{
 let calls=0;await assert.rejects(fetchSource('Ignav','https://example.com',{}, {retryIgnav424:true,fetcher:async()=>{calls++;return Response.json({error:{code:'private-unrecognized-code',message:'secret'}},{status:424});}}),e=>e.sourceStatus==='error'&&e.providerCode===undefined&&!e.message.includes('secret'));assert.equal(calls,1);
});

test('Ignav exhausted 424 retries are temporary failures and cancellation stops backoff',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({code:'unable_to_complete_request'},{status:424});};
 await assert.rejects(fetchSource('Ignav','https://example.com',{}, {retryIgnav424:true,fetcher,sleep:async()=>{},random:()=>0}),e=>e.sourceStatus==='temporarily_unavailable'&&e.httpStatus===424);assert.equal(calls,3);
 const controller=new AbortController();calls=0;
 await assert.rejects(fetchSource('Ignav','https://example.com',{signal:controller.signal},{retryIgnav424:true,fetcher,sleep:async()=>controller.abort(),random:()=>0}),e=>e.name==='AbortError');assert.equal(calls,1);
});
