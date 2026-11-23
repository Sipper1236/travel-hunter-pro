import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createJobStore} from '../lib/job-store.mjs';
import {startSearchWorker} from '../lib/search-worker.mjs';
test('actual hotel worker executes the official API Anything source and persists source/age evidence',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'official-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path});let worker,child;
 try{
  const input={city:'Example',checkin:'2099-04-15',checkout:'2099-04-20',adults:1,adultAges:[35],childrenAges:[10],rooms:1,minStars:4,hotelSource:'official',officialUrl:'https://hotel.example.com/'};
  const job=store.submit(input,'official_test_123',{kind:'hotel'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/official-hotel-transport.mjs',import.meta.url).href],env:{...process.env,TRAVEL_JOB_DB:path,TRAVEL_API_ANYTHING_HOME:join(directory,'api-anything'),TRAVEL_SOURCE_GAP_MS:'100'},stdio:['ignore','ignore','ignore','ipc']})});
  const end=Date.now()+12000;let done;do{done=store.get(job.id);if(['complete','error'].includes(done.status))break;await new Promise(r=>setTimeout(r,10));}while(Date.now()<end);
  assert.equal(done.status,'complete',JSON.stringify(done.error));assert.equal(done.result.offers.length,1,JSON.stringify(done.result.sourceResults));const hotel=done.result.offers[0];
  assert.equal(hotel.priceText,'CAD 450.00');assert.deepEqual(hotel.stay.adultAges,[35]);assert.deepEqual(hotel.stay.childrenAges,[10]);assert.equal(hotel.locationEvidence.cityId,'Q123');assert.equal(hotel.officialEvidence.propertyKey,'reservit:58:123');assert.equal(done.input.hotelSource,'official');
 }finally{worker?.stop();if(child&&child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
