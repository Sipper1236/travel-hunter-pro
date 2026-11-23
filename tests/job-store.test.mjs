import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createJobStore} from '../lib/job-store.mjs';

test('jobs persist across connections and request keys prevent duplicate work',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'travel-jobs-')),path=join(directory,'jobs.sqlite');
 let first=createJobStore({path});let second;
 try{
   const job=first.submit({origin:'YHZ'},'request_123');first.close();first=null;
   second=createJobStore({path});assert.equal(second.get(job.id).status,'queued');
   assert.equal(second.submit({origin:'YHZ'},'request_123').id,job.id);
   assert.throws(()=>second.submit({origin:'YYZ'},'request_123'),/different input/);
   assert.equal((await stat(path)).mode & 0o777,0o600);
 }finally{first?.close();second?.close();await rm(directory,{recursive:true,force:true});}
});

test('job ownership capabilities are bound to an idempotent job and never authorize another party',()=>{
 const store=createJobStore({path:':memory:'}),owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',other='f26e51cc-1c31-4303-a631-1a99f3902430';
 try{
  const job=store.submit({origin:'YHZ'},'owned_request_123',{ownerToken:owner});
  assert.equal(store.authorize(job.id,owner),true);
  assert.equal(store.authorize(job.id,other),false);
  assert.equal(store.authorize(job.id,undefined),false);
  assert.equal(store.authorize(job.id,'------------------------------------'),false);
  assert.equal(store.submit({origin:'YHZ'},'owned_request_123',{ownerToken:owner}).id,job.id);
  assert.throws(()=>store.submit({origin:'YHZ'},'owned_request_123',{ownerToken:other}),/another job owner/);
 }finally{store.close();}
});

test('completed durable results retain exact Ignav offers for later handoff matching',()=>{
 const store=createJobStore({path:':memory:'});
 try{
   const ownerToken='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',job=store.submit({origin:'YHZ'},'request_123',{ownerToken}),claim=store.claim();
   const offer={ignavId:'fare_12345678',segments:[{flight_number:'123'}]};
   assert.equal(store.finish(job.id,claim.token,{result:{offers:[offer]}}),true);
   assert.deepEqual(store.findFlightOffer(offer.ignavId,ownerToken),offer);
   assert.equal(store.findFlightOffer(offer.ignavId,'f26e51cc-1c31-4303-a631-1a99f3902430'),null);
   assert.equal(store.findFlightOffer('fare_notfound'),null);
 }finally{store.close();}
});

test('provider response cache preserves original results until TTL expiry and rejects unsafe entries',()=>{
 let now=10_000;const store=createJobStore({path:':memory:',now:()=>now}),key='a'.repeat(64),result={observedAt:'2026-11-23T12:00:00.000Z',offers:[{price:400}]};
 try{
  assert.equal(store.getProviderResponse(key),null);
  assert.equal(store.setProviderResponse(key,result,now+5000),true);
  assert.deepEqual(store.getProviderResponse(key),result);
  assert.equal(store.deleteProviderResponse(key),true);
  assert.equal(store.getProviderResponse(key),null);
  assert.equal(store.setProviderResponse(key,result,now+5000),true);
  now+=5000;assert.equal(store.getProviderResponse(key),null);
  assert.equal(store.setProviderResponse('unsafe',result,now+5000),false);
  assert.equal(store.setProviderResponse(key,result,now),false);
  assert.equal(store.setProviderResponse(key,{payload:'x'.repeat(512_001)},now+5000),false);
 }finally{store.close();}
});

test('provider response cache survives worker connections and keeps only the newest one hundred entries',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'travel-provider-cache-')),path=join(directory,'jobs.sqlite');let store=createJobStore({path});
 try{
  const first='0'.repeat(64),last=(100).toString(16).padStart(64,'0');
  const base=Date.now();
  for(let i=0;i<101;i++)assert.equal(store.setProviderResponse(i.toString(16).padStart(64,'0'),{n:i},base+i+60_000,base+i),true);
  store.close();store=createJobStore({path});
  assert.equal(store.getProviderResponse(first),null,'oldest cache entry should be evicted');
  assert.deepEqual(store.getProviderResponse(last),{n:100},'cache entries must persist across store connections');
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('expired worker leases use persisted exponential backoff and fence old workers',()=>{
 let now=1000;const store=createJobStore({path:':memory:',now:()=>now,leaseMs:10});
 try{
   const job=store.submit({origin:'YHZ'},'request_123'),first=store.claim();assert.equal(store.claim(),null);
   now+=11;assert.equal(store.claim(),null,'first crash schedules a one-second delay');assert.equal(store.get(job.id).status,'queued');assert.equal(store.get(job.id).retryAt,new Date(now+1000).toISOString(),'the owner can see when recovery may retry');
   now+=999;assert.equal(store.claim(),null,'the recovery delay survives polls');
   now++;const second=store.claim();assert.equal(second.id,first.id);assert.notEqual(second.token,first.token);
   assert.equal(store.finish(first.id,first.token,{result:{offers:['stale worker']}}),false);
   now+=11;assert.equal(store.claim(),null,'second crash schedules a two-second delay');
   now+=1999;assert.equal(store.claim(),null);
   now++;const third=store.claim();assert.equal(third.id,first.id);assert.notEqual(third.token,second.token);
   assert.equal(store.finish(second.id,second.token,{result:{offers:['stale worker']}}),false);
   assert.equal(store.finish(third.id,third.token,{result:{offers:[]}}),true);assert.equal(store.get(first.id).attempts,3);assert.equal(store.get(first.id).retryAt,undefined);
 }finally{store.close();}
});

test('scheduled worker recovery delay survives a durable job-store restart',async()=>{
 let now=5000;const directory=await mkdtemp(join(tmpdir(),'travel-worker-backoff-')),path=join(directory,'jobs.sqlite'),options={path,now:()=>now,leaseMs:10};
 let store=createJobStore(options);
 try{
  const job=store.submit({},'backoff_restart_1'),first=store.claim();now+=11;
  assert.equal(store.claim(),null,'expired lease should be re-queued with a recovery delay');
  store.close();store=createJobStore(options);
  assert.equal(store.get(job.id).status,'queued');assert.equal(store.claim(),null,'restart should preserve the scheduled time');
  now+=1000;const recovered=store.claim();assert.equal(recovered.id,job.id);assert.notEqual(recovered.token,first.token);
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('cancelled jobs cannot be claimed or overwritten by late worker messages',()=>{
 const store=createJobStore({path:':memory:'});
 try{const queued=store.submit({},'request_123');store.cancel(queued.id);assert.equal(store.claim(),null);const running=store.submit({},'request_456'),claim=store.claim();store.cancel(running.id);assert.equal(store.heartbeat(claim.id,claim.token),false);assert.equal(store.finish(claim.id,claim.token,{result:{offers:[]}}),false);assert.equal(store.get(claim.id).status,'cancelled');}finally{store.close();}
});

test('execution deadline and bounded worker recovery become terminal errors',()=>{
 let now=1000;const store=createJobStore({path:':memory:',now:()=>now,leaseMs:10});
 try{
  const job=store.submit({},'request_123');let claim=store.claim();
  now+=11;assert.equal(store.claim(),null);now+=1000;claim=store.claim();assert.ok(claim);
  now+=11;assert.equal(store.claim(),null);now+=2000;claim=store.claim();assert.ok(claim);
  now+=11;assert.equal(store.claim(),null);assert.equal(store.get(job.id).status,'error');
  const next=store.submit({},'request_456');claim=store.claim();now+=16*60000;assert.equal(store.heartbeat(claim.id,claim.token),false);assert.equal(store.get(next.id).status,'error');
 }finally{store.close();}
});

test('expired queued jobs release capacity even when no worker is running',()=>{
 let now=1000;const store=createJobStore({path:':memory:',now:()=>now,maxActive:1});
 try{const first=store.submit({},'request_123');assert.throws(()=>store.submit({},'request_456'),/queue is full/);now+=16*60000;assert.equal(store.submit({},'request_456').status,'queued');assert.equal(store.get(first.id).status,'error');}finally{store.close();}
});

test('one owner cannot occupy the full shared queue and completed work releases owner capacity',()=>{
 let now=1000;const store=createJobStore({path:':memory:',maxActive:4,maxActivePerOwner:2,now:()=>now});
 const owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',other='f26e51cc-1c31-4303-a631-1a99f3902430';
 try{
  const first=store.submit({},'owner_a_001',{ownerToken:owner});now+=1;const second=store.submit({},'owner_a_002',{ownerToken:owner});now+=1;
  assert.equal(store.submit({},'owner_a_001',{ownerToken:owner}).id,first.id,'idempotent retries do not consume another slot');
  let limited;try{store.submit({},'owner_a_003',{ownerToken:owner});}catch(error){limited=error;}
  assert.match(limited?.message??'unknown error',/at most 2 active searches/);
  assert.equal(limited.status,429);
  const otherJob=store.submit({},'owner_b_001',{ownerToken:other});
  assert.equal(otherJob.status,'queued','another owner can use the shared queue capacity');
  const claim=store.claim();assert.equal(claim.id,first.id);assert.equal(store.finish(first.id,claim.token,{result:{offers:[]}}),true);
  assert.equal(store.submit({},'owner_a_003',{ownerToken:owner}).status,'queued','a completed job frees its owner slot');
  assert.ok(second.id);
 }finally{store.close();}
});

test('durable submission windows bound repeated starts per owner and across the service',()=>{
 let now=1000;const store=createJobStore({path:':memory:',now:()=>now,maxActive:20,maxActivePerOwner:20,maxStartsPerWindow:3,maxStartsPerOwnerPerWindow:2,startWindowMs:60000});
 const owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',other='f26e51cc-1c31-4303-a631-1a99f3902430';
 const rejected=operation=>{let result;try{operation();}catch(error){result=error;}return result;};
 try{
  const first=store.submit({},'window_owner_a_001',{ownerToken:owner});
  store.submit({},'window_owner_a_002',{ownerToken:owner});
  assert.equal(store.submit({},'window_owner_a_001',{ownerToken:owner}).id,first.id,'idempotent retries do not consume a start slot');
  const ownerLimited=rejected(()=>store.submit({},'window_owner_a_003',{ownerToken:owner}));
  assert.equal(ownerLimited?.status,429);
  assert.equal(ownerLimited?.retryAfterSeconds,60);
  store.submit({},'window_owner_b_001',{ownerToken:other});
  const globalLimited=rejected(()=>store.submit({},'window_owner_b_002',{ownerToken:other}));
  assert.equal(globalLimited?.status,429,'new owner tokens cannot evade the service-wide window');
  now+=60000;
  assert.equal(store.submit({},'window_owner_a_003',{ownerToken:owner}).status,'queued','starts become available when the rolling window expires');
 }finally{store.close();}
});

test('rolling start limits survive a job-store restart',async()=>{
 let now=1000;const directory=await mkdtemp(join(tmpdir(),'travel-rate-limit-')),path=join(directory,'jobs.sqlite');
 const options={path,now:()=>now,maxStartsPerWindow:4,maxStartsPerOwnerPerWindow:1,startWindowMs:60000};
 let store=createJobStore(options);const owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';
 try{
  store.submit({},'durable_start_001',{ownerToken:owner});store.close();store=null;
  store=createJobStore(options);
  let limited;try{store.submit({},'durable_start_002',{ownerToken:owner});}catch(error){limited=error;}
  assert.equal(limited?.status,429,'a restarted application retains recent submission events');
  now+=60000;
  assert.equal(store.submit({},'durable_start_002',{ownerToken:owner}).status,'queued');
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});

test('terminal traveler search data expires after 24 hours without requiring a new submission',()=>{
 let now=1000;const store=createJobStore({path:':memory:',now:()=>now});
 try{
  const owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';
  const job=store.submit({travelers:[{id:'child',birthDate:'2090-01-02'}]},'retention_123',{ownerToken:owner}),claim=store.claim();
  assert.equal(store.finish(job.id,claim.token,{result:{observedAt:'2099-01-01T00:00:00.000Z',offers:[]}}),true);
  now+=24*60*60*1000-1;assert.equal(store.get(job.id).status,'complete');
  now+=1;assert.equal(store.get(job.id),null,'Terminal input and result should be removed when its 24-hour retention expires.');
 }finally{store.close();}
});

test('polling a live job does not force a global terminal-job retention sweep',async()=>{
 let now=1000;const directory=await mkdtemp(join(tmpdir(),'travel-job-poll-retention-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path,now:()=>now});
 const database=new DatabaseSync(path);
 try{
  const old=store.submit({},'poll_retention_old_1'),oldClaim=store.claim();
  assert.equal(store.finish(old.id,oldClaim.token,{result:{offers:[]}}),true);
  const recent=store.submit({},'poll_retention_recent_1'),recentClaim=store.claim();
  assert.equal(store.finish(recent.id,recentClaim.token,{result:{offers:[]}}),true);
  database.prepare('UPDATE flight_jobs SET updated=? WHERE id=?').run(now-24*60*60*1000-1,old.id);
  assert.equal(store.get(recent.id).status,'complete');
  assert.equal(database.prepare('SELECT count(*) AS count FROM flight_jobs WHERE id=?').get(old.id).count,1,'an unrelated expired row remains until the throttled retention sweep');
  assert.equal(store.get(old.id),null,'the requested expired job is still deleted immediately');
 }finally{database.close();store.close();await rm(directory,{recursive:true,force:true});}
});

test('idle worker heartbeats sweep expired terminal search data',()=>{
 let now=1000;const store=createJobStore({path:':memory:',now:()=>now});
 try{
  const job=store.submit({travelers:[{id:'adult',birthDate:'2070-01-02'}]},'retention_worker_123'),claim=store.claim();
  assert.equal(store.finish(job.id,claim.token,{result:{offers:[]}}),true);
  now+=24*60*60*1000;
  assert.equal(store.workerHeartbeat('retention-worker',null),1);
  assert.equal(store.get(job.id),null);
 }finally{store.close();}
});

test('pause fences writes and resume retains checkpoints without consuming crash recovery budget',()=>{
 const store=createJobStore({path:':memory:'});
 try{
   const job=store.submit({},'request_123');let claim=store.claim();
   assert.equal(store.checkpoint(job.id,claim.token,{version:1,pairs:{'YHZ:YUL':{result:{offers:[]}}}}),true);
   for(let i=0;i<5;i++){
     assert.equal(store.pause(job.id).status,'paused');assert.equal(store.claim(),null);
     assert.equal(store.checkpoint(job.id,claim.token,{pairs:{}}),false);
     assert.equal(store.resume(job.id).status,'queued');claim=store.claim();assert.ok(claim.checkpoint.pairs['YHZ:YUL']);
   }
   assert.equal(store.finish(job.id,claim.token,{result:{offers:[]}}),true);
 }finally{store.close();}
});

test('package jobs are isolated by kind, serialized, and never replayed after losing a browser lease',()=>{
 let at=1000;const store=createJobStore({path:':memory:',now:()=>at,leaseMs:100});
 try{
   const first=store.submit({},'package_123',{kind:'package'});at++;
   const second=store.submit({},'package_456',{kind:'package'});at++;
   const flight=store.submit({},'flight_123');
   assert.throws(()=>store.submit({},'package_123'),/different input/);
   assert.throws(()=>store.pause(first.id),/cancellation/);
   const packageClaim=store.claim();assert.equal(packageClaim.id,first.id);assert.equal(packageClaim.kind,'package');
   const flightClaim=store.claim();assert.equal(flightClaim.id,flight.id);store.finish(flightClaim.id,flightClaim.token,{result:{offers:[]}});
   assert.equal(store.claim(),null);at+=101;
   assert.equal(store.get(first.id).status,'error');assert.equal(store.claim().id,second.id);assert.match(store.get(first.id).error.error,/browser session was lost/);
 }finally{store.close();}
});

test('cancelled package browser cleanup holds the cross-worker slot briefly',()=>{
 let at=1000;const store=createJobStore({path:':memory:',now:()=>at});
 try{const first=store.submit({},'package_123',{kind:'package'});at++;const next=store.submit({},'package_456',{kind:'package'});store.claim();store.cancel(first.id);assert.equal(store.claim(),null);at+=17001;assert.equal(store.claim().id,next.id);}finally{store.close();}
});

test('hotel human inputs are bounded, deduplicated, delivered once and fenced on cancellation',()=>{
 let at=1000;const store=createJobStore({path:':memory:',now:()=>at});
 try{
   const job=store.submit({},'hotel_123',{kind:'hotel'}),claim=store.claim();
   store.heartbeat(job.id,claim.token,{challenge:{id:'frame-1',width:100,height:50,capturedAt:at,image:'private challenge crop'}});
   assert.throws(()=>store.interact(job.id,{kind:'click',frameId:'old',x:1,y:1},'input_bad'),/changed/);
   assert.throws(()=>store.interact(job.id,{kind:'click',frameId:'frame-1',x:101,y:1},'input_bad'),/outside/);
   const click={kind:'click',frameId:'frame-1',x:10,y:20};
   assert.equal(store.interact(job.id,click,'input_123').interaction.status,'pending');
   assert.equal(store.takeInteraction(job.id,'wrong-token'),null);
   const command=store.takeInteraction(job.id,claim.token);assert.deepEqual(command.input,click);
   assert.equal(store.interact(job.id,{y:20,x:10,frameId:'frame-1',kind:'click'},'input_123').interaction.status,'inflight');
   assert.equal(store.takeInteraction(job.id,claim.token),null);
   assert.equal(store.finishInteraction(job.id,claim.token,command.id),true);
   at+=16000;assert.throws(()=>store.interact(job.id,click,'input_stale'),/changed/);
   store.interact(job.id,{kind:'refresh'},'input_refresh');store.cancel(job.id);
   assert.equal(store.get(job.id).progress.challenge,undefined);assert.equal(store.get(job.id).interaction.status,'error');
   assert.equal(store.takeInteraction(job.id,claim.token),null);assert.equal(store.finishInteraction(job.id,claim.token,command.id),false);
 }finally{store.close();}
});
test('comparison jobs retain input and budget checkpoints through pause and lease recovery',()=>{
 let at=1000;const store=createJobStore({path:':memory:',now:()=>at,leaseMs:100});
 try{
   const input={mode:'segments',searchLimit:25},job=store.submit(input,'comparison_123',{kind:'comparison'}),first=store.claim();
   assert.deepEqual(store.get(job.id).input,input);assert.equal(first.kind,'comparison');
   assert.equal(store.checkpoint(job.id,first.token,{started:2,pending:'ticket',responses:[]}),true);
   assert.equal(store.pause(job.id).status,'paused');assert.equal(store.heartbeat(job.id,first.token),false);
   store.resume(job.id);const second=store.claim();assert.equal(second.checkpoint.started,2);assert.equal(second.checkpoint.pending,'ticket');
   at+=101;assert.equal(store.claim(),null);at+=1000;const recovered=store.claim();assert.equal(recovered.id,job.id);assert.equal(recovered.checkpoint.started,2);
   assert.equal(store.finish(job.id,second.token,{result:{plans:['stale']}}),false);
   assert.equal(store.finish(job.id,recovered.token,{result:{plans:[]}}),true);
 }finally{store.close();}
});
