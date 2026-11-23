import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createJobStore} from '../lib/job-store.mjs';
import {startSearchWorker} from '../lib/search-worker.mjs';
const waitFor=async predicate=>{const end=Date.now()+2000;while(!predicate()){if(Date.now()>end)throw Error('Worker condition timed out');await new Promise(r=>setTimeout(r,5));}};
class Child extends EventEmitter {send(input){this.input=input;}kill(){this.killed=true;queueMicrotask(()=>this.emit('exit',0));}}

test('worker persists progress and a completed child result',async()=>{
 const store=createJobStore({path:':memory:'}),job=store.submit({origin:'YHZ'},'request_123');let child;
 const worker=startSearchWorker({store,pollMs:5,spawn:()=>child=new Child()});
 try{assert.equal(child.input.input.origin,'YHZ');child.emit('message',{checkpoint:{version:1,pairs:{}},sequence:1});assert.equal(child.input.checkpointAck,1);child.emit('message',{progress:{stage:'searching',pairsChecked:1,pairsPlanned:2}});assert.equal(store.get(job.id).progress.pairsChecked,1);child.emit('message',{result:{offers:[]}});assert.equal(store.get(job.id).status,'complete');assert.equal(child.killed,true);}finally{worker.stop();}
});

test('streaming provider progress records its durable persistence time',()=>{
 let now=Date.parse('2026-11-14T12:00:00.000Z');
 const store=createJobStore({path:':memory:',now:()=>now}),job=store.submit({origin:'YHZ'},'stream_timestamp_123'),claim=store.claim();
 try{
  const progress={stage:'provider_results_streaming',providerResultsReceived:1,flightPreview:{partial:true}};
  assert.equal(store.heartbeat(job.id,claim.token,progress),true);
  assert.equal(store.get(job.id).progress.persistedAt,new Date(now).toISOString());
  assert.equal(store.get(job.id).progress.flightPreview.partial,true);
 }finally{store.close();}
});

test('worker terminates an active child when cancellation revokes its lease',async()=>{
 const store=createJobStore({path:':memory:'}),job=store.submit({},'request_123');let child;
 const worker=startSearchWorker({store,pollMs:5,spawn:()=>child=new Child()});
 try{store.cancel(job.id);await waitFor(()=>child.killed);child.emit('message',{result:{offers:['late result']}});assert.equal(store.get(job.id).status,'cancelled');assert.equal(store.get(job.id).result,null);}finally{worker.stop();}
});

test('a cancelled child that ignores SIGTERM is forcibly stopped so the next job can run',async t=>{
 let now=Date.now();const store=createJobStore({path:':memory:',now:()=>now++}),first=store.submit({},'stuck_first'),second=store.submit({},'stuck_second');
 class StuckChild extends Child {constructor(){super();this.signals=[];}kill(signal){this.signals.push(signal);if(signal==='SIGKILL')queueMicrotask(()=>this.emit('exit',null,signal));return true;}}
 const children=[];const worker=startSearchWorker({store,pollMs:5,spawn:()=>{const child=children.length?new Child():new StuckChild();children.push(child);return child;}});
 try{
  t.mock.timers.enable({apis:['setTimeout']});store.cancel(first.id);children[0].emit('message',{progress:{stage:'late_progress'}});
  assert.deepEqual(children[0].signals,['SIGTERM']);t.mock.timers.tick(15000);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(children[0].signals,['SIGTERM','SIGKILL']);t.mock.timers.reset();await waitFor(()=>children.length===2);
  assert.equal(store.get(first.id).status,'cancelled');children[1].emit('message',{result:{offers:[]}});assert.equal(store.get(second.id).status,'complete');
 }finally{t.mock.timers.reset();worker.stop();}
});

test('a completed child also has bounded shutdown and successful exit clears the forced-kill timer',async t=>{
 const store=createJobStore({path:':memory:'}),job=store.submit({},'complete_child');let child;const signals=[];
 const worker=startSearchWorker({store,pollMs:5,spawn:()=>{child=new Child();child.kill=signal=>{signals.push(signal);queueMicrotask(()=>child.emit('exit',0));return true;};return child;}});
 try{t.mock.timers.enable({apis:['setTimeout']});child.emit('message',{result:{offers:[]}});await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(15000);assert.deepEqual(signals,['SIGTERM']);assert.equal(store.get(job.id).status,'complete');}
 finally{t.mock.timers.reset();worker.stop();}
});

test('hotel worker delivers durable human commands and records the child acknowledgement',async()=>{
 const store=createJobStore({path:':memory:'}),job=store.submit({},'hotel_123',{kind:'hotel'});let child;
 const worker=startSearchWorker({store,pollMs:5,spawn:()=>child=new Child()});
 try{
   child.emit('message',{progress:{stage:'hotel_verification',challenge:{id:'frame',width:100,height:50,capturedAt:Date.now()}}});
   store.interact(job.id,{kind:'click',frameId:'frame',x:10,y:20},'human_123');
   await waitFor(()=>child.input?.interaction?.id==='human_123');
   assert.equal(child.input.interaction.input.frameId,'frame');
   child.emit('message',{interactionResult:{id:'human_123'}});assert.equal(store.get(job.id).interaction.status,'complete');
   child.emit('message',{result:{offers:[]}});assert.equal(store.get(job.id).status,'complete');assert.equal(store.get(job.id).progress.challenge,undefined);
 }finally{worker.stop();}
});
