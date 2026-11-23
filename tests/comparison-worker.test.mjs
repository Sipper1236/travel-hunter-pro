import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../lib/job-store.mjs';
import {startSearchWorker} from '../lib/search-worker.mjs';
import {itineraryKey} from '../lib/ignav.mjs';
const leg=(from,to,n,depart,arrive)=>({marketing_carrier_code:'AC',flight_number:n,departure_airport:from,arrival_airport:to,departure_time_utc:depart,arrival_time_utc:arrive,departure_time_local:depart.slice(0,19),arrival_time_local:arrive.slice(0,19)});
const legs=[leg('YHZ','YUL','100','2099-04-15T08:00:00Z','2099-04-15T09:00:00Z'),leg('YUL','BCN','200','2099-04-15T13:00:00Z','2099-04-15T21:00:00Z')];
const input={mode:'segments',origin:'YHZ',destination:'BCN',date:'2099-04-15',itineraryKey:itineraryKey({outbound:{segments:legs}}),adults:1,children:0,childrenAges:[],cabin:'economy',searchLimit:4};
const waitFor=async predicate=>{const end=Date.now()+8000;while(!predicate()){if(Date.now()>end)throw Error('Comparison worker condition timed out.');await new Promise(r=>setTimeout(r,10));}};

test('actual comparison runner aborts on pause, restores acknowledged quotes and persists the bounded result',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'comparison-worker-')),path=join(directory,'jobs.sqlite');
 const store=createJobStore({path}),children=[];let worker,refuse=false;
 try{
   const job=store.submit(input,'comparison_123',{kind:'comparison'});
   worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/comparison-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'100',COMPARISON_TEST_REFUSAL:refuse?'1':'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
   await waitFor(()=>store.get(job.id).progress?.fareRequestsStarted===2);
   assert.equal(store.pause(job.id).status,'paused');
   await waitFor(()=>children[0].exitCode!==null);assert.equal(store.get(job.id).result,null);
   const snapshot=store.get(job.id);assert.equal(snapshot.input.searchLimit,4);
   store.resume(job.id);
   await waitFor(()=>['complete','error'].includes(store.get(job.id).status));
   const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));assert.equal(done.result.plans[0].price,350);
   assert.equal(done.result.coverage.fareRequestsStarted,4);assert.equal(done.result.coverage.responsesReused,1);assert.equal(done.result.coverage.interruptedRequests,1);assert.equal(done.attempts,2);
   const other=store.submit({...input,searchLimit:25},'comparison_456',{kind:'comparison'});
   await waitFor(()=>store.get(other.id).progress?.fareRequestsStarted===2);
   store.cancel(other.id);await waitFor(()=>children.at(-1).exitCode!==null);
   assert.equal(store.get(other.id).status,'cancelled');assert.equal(store.get(other.id).result,null);
   refuse=true;const limited=store.submit(input,'comparison_789',{kind:'comparison'});
   await waitFor(()=>store.get(limited.id).status==='error');
   assert.equal(store.get(limited.id).error.sourceStatus,'rate_limited');assert.equal(store.get(limited.id).error.httpStatus,429);assert.ok(Date.parse(store.get(limited.id).error.retryAt)>Date.now());assert.match(store.get(limited.id).error.error,/Retry after/);
 }finally{
   worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');
   await rm(directory,{recursive:true,force:true});
 }
});

test('actual comparison runner keeps identified minors with guardians in every quoted group',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'identified-comparison-')),path=join(directory,'jobs.sqlite');
 const store=createJobStore({path}),children=[];let worker;
 try{
  const travelers=[{id:'parent',birthDate:'2070-01-01'},{id:'other',birthDate:'2071-01-01'},{id:'child',birthDate:'2090-01-01',guardianId:'parent'}];
  const job=store.submit({mode:'party',origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',cabin:'economy',travelers},'identified_123',{kind:'comparison'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/comparison-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'100'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));
  const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.equal(done.result.coverage.fareRequestsStarted,5);
  assert.ok(done.result.searches.every(s=>!s.travelerIds.includes('child')||s.travelerIds.includes('parent')));
  assert.deepEqual(done.result.plans[0].tickets[0].travelerIds,['parent','other','child']);
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
