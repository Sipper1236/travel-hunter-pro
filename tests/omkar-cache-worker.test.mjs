import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../lib/job-store.mjs';
import {startSearchWorker} from '../lib/search-worker.mjs';

const waitFor=async predicate=>{const end=Date.now()+20_000;while(!predicate()){if(Date.now()>end)throw Error('Omkar fixture worker timed out.');await new Promise(resolve=>setTimeout(resolve,10));}};

test('separate flight-job child processes reuse a validated Omkar response from the durable job store',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'omkar-cache-worker-')),path=join(directory,'jobs.sqlite'),requestLog=join(directory,'provider-requests.log');
 const query={origin:'YHZ',destination:'BCN',originType:'place',destinationType:'place',date:'2099-04-15',tripType:'one-way',source:'omkar-expedia',cabin:'economy',adults:1,children:0,childrenAges:[],filters:{}};
 const children=[];let store=createJobStore({path}),worker;
 try{
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{
   const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/omkar-cache-transport.mjs',import.meta.url).href],env:{...process.env,OMKAR_API_KEY:'test-only-no-real-key',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0',TRAVEL_OMKAR_TEST_REQUEST_LOG:requestLog},stdio:['ignore','ignore','ignore','ipc']});
   children.push(child);return child;
  }});
  const run=async key=>{const job=store.submit(query,key,{kind:'flight'});await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));return done.result;};
  const first=await run('omkar_cache_worker_first');assert.equal(first.offers.length,1);assert.equal(first.sources.find(row=>row.provider==='Expedia via Omkar')?.cacheStatus,undefined);
  worker.stop();worker=null;await waitFor(()=>children[0].exitCode!==null);store=null;
  store=createJobStore({path});worker=startSearchWorker({store,pollMs:10,spawn:()=>{
   const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/omkar-cache-transport.mjs',import.meta.url).href],env:{...process.env,OMKAR_API_KEY:'test-only-no-real-key',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0',TRAVEL_OMKAR_TEST_REQUEST_LOG:requestLog},stdio:['ignore','ignore','ignore','ipc']});
   children.push(child);return child;
  }});
  const second=await run('omkar_cache_worker_second');
  assert.equal(second.offers.length,1);assert.equal(second.offers[0].observedAt,first.offers[0].observedAt);
  assert.equal(second.sources.find(row=>row.provider==='Expedia via Omkar')?.cacheStatus,'hit');
  assert.equal((await readFile(requestLog,'utf8')).trim().split('\n').length,1,'the second child must not send another provider request');
 }finally{
  if(worker){worker.stop();worker=null;store=null;}else store?.close();
  for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');
  await rm(directory,{recursive:true,force:true});
 }
});
