import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {POST as jobs} from '../app/api/search/jobs/route.js';
import {POST as segments} from '../app/api/search/separate-tickets/route.js';
import {POST as party} from '../app/api/search/optimize/route.js';
const query={origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',adults:2,children:0,childrenAges:[],itineraryKey:'observed-flights'};
const ownerToken='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';
const request=(body,headers={})=>new Request('http://127.0.0.1:3000/api/search/jobs',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json',...headers},body:JSON.stringify({ownerToken,...body})});

test('comparison APIs enqueue once, expose durable controls and reject invalid queries before work',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'comparison-api-')),previous=process.env.TRAVEL_JOB_DB;process.env.TRAVEL_JOB_DB=join(directory,'jobs.sqlite');
 try{
   const routePairs=[{origin:'YHZ',destination:'BCN'},{origin:'YUL',destination:'MAD'}];
   const first=await segments(request({...query,routePairs,clientEvidence:'untrusted'},{'Idempotency-Key':'segment_request_123'}));assert.equal(first.status,202);assert.equal(first.headers.get('cache-control'),'no-store');
   const job=await first.json();assert.equal(job.kind,'comparison');assert.equal(job.input.mode,'segments');assert.equal(job.input.clientEvidence,undefined);assert.deepEqual(job.input.routePairs,routePairs);assert.equal(job.result,null);
   const same=await segments(request({...query,routePairs,clientEvidence:'different ignored value'},{'Idempotency-Key':'segment_request_123'}));assert.equal((await same.json()).id,job.id);
   const split=await party(request(query,{'Idempotency-Key':'party_request_123'}));assert.equal(split.status,202);assert.equal((await split.json()).input.mode,'party');
   const collision=await party(request(query,{'Idempotency-Key':'segment_request_123'}));assert.equal(collision.status,400);
   const queued=await jobs(request({action:'start',kind:'comparison',input:{...query,mode:'party'},requestKey:'generic_request_123'}));assert.equal(queued.status,202);const id=(await queued.json()).id;
   for(const [action,status] of [['pause','paused'],['resume','queued'],['cancel','cancelled'],['status','cancelled']]){const response=await jobs(request({action,id}));assert.equal(response.status,200);assert.equal((await response.json()).status,status);}
   assert.equal((await jobs(request({action:'start',kind:'comparison',input:{...query,mode:'other'},requestKey:'invalid_request_123'}))).status,400);
   assert.equal((await segments(request({...query,date:'2099-02-30'}))).status,400);
   assert.equal((await segments(request({...query,children:1,childrenAges:[10]}))).status,400);
   assert.equal((await segments(request(query,{origin:'https://external.example'}))).status,403);
   assert.equal((await segments(request({...query,large:'x'.repeat(25000)}))).status,413);
 }finally{
   globalThis.__travelFlightJobStore?.close();delete globalThis.__travelFlightJobStore;
   if(previous===undefined)delete process.env.TRAVEL_JOB_DB;else process.env.TRAVEL_JOB_DB=previous;
   await rm(directory,{recursive:true,force:true});
 }
});

test('job API accepts the full 20-by-20 regional comparison candidate set within a bounded payload',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'comparison-wide-api-')),previous=process.env.TRAVEL_JOB_DB;process.env.TRAVEL_JOB_DB=join(directory,'jobs.sqlite');
 try{
  const codes=prefix=>Array.from({length:20},(_,i)=>`${prefix}${String.fromCharCode(65+i)}A`);
  const routePairs=codes('A').flatMap(origin=>codes('B').map(destination=>({origin,destination})));
  const response=await jobs(request({action:'start',kind:'comparison',requestKey:'regional_400_pairs',input:{mode:'segments',origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],itineraryKey:'observed-itinerary',routePairs,routeSearchLimit:20}}));
  assert.equal(response.status,202);
  assert.equal((await response.json()).input.routePairs.length,400);
 }finally{
  globalThis.__travelFlightJobStore?.close();delete globalThis.__travelFlightJobStore;
  if(previous===undefined)delete process.env.TRAVEL_JOB_DB;else process.env.TRAVEL_JOB_DB=previous;
  await rm(directory,{recursive:true,force:true});
 }
});
