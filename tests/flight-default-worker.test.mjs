import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../lib/job-store.mjs';
import {startSearchWorker} from '../lib/search-worker.mjs';

test('ordinary flight jobs price the whole party once and never search compositions or ticket blocks',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'flight-default-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),requests=[],children=[];let worker;
 try{
  const input={origin:'YHZ',destination:'BCN',originType:'place',destinationType:'place',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:2,children:0,childrenAges:[],source:'ignav',filters:{}};
  const job=store.submit(input,'default_flight_123',{kind:'flight'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{
   const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/flight-default-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'100'},stdio:['ignore','ignore','ignore','ipc']});
   child.on('message',message=>{if(message.auditProviderRequest)requests.push(message.auditProviderRequest);});children.push(child);return child;
  }});
  const deadline=Date.now()+10000;
  while(!['complete','error'].includes(store.get(job.id).status)){if(Date.now()>deadline)throw Error('Default flight worker did not finish.');await new Promise(resolve=>setTimeout(resolve,10));}
  const finished=store.get(job.id);assert.equal(finished.status,'complete',JSON.stringify(finished.error));assert.equal(finished.result.offers.length,1);
  assert.deepEqual(requests.map(request=>({url:request.url,origin:request.body.origin,destination:request.body.destination,adults:request.body.adults,children:request.body.children})),[{url:'https://ignav.com/api/fares/one-way',origin:'YHZ',destination:'BCN',adults:2,children:0}]);
  assert.equal(finished.result.query.adults,2);
 }finally{worker?.stop();if(!worker)store.close();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
