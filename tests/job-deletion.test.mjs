import test from 'node:test';
import assert from 'node:assert/strict';
import {createJobStore} from '../lib/job-store.mjs';

const owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',other='f26e51cc-1c31-4303-a631-1a99f3902430';
test('saved search deletion requires the owner and refuses active or paused jobs',()=>{
 const store=createJobStore({path:':memory:'});
 try{const job=store.submit({travelers:[{birthDate:'1990-01-01'}]},'private_search',{ownerToken:owner});
  assert.equal(store.remove(job.id,other),null);assert.equal(store.remove(job.id,undefined),null);
  assert.throws(()=>store.remove(job.id,owner),/Cancel this search/);store.pause(job.id);assert.throws(()=>store.remove(job.id,owner),/Cancel this search/);
  store.cancel(job.id);assert.deepEqual(store.remove(job.id,owner),{id:job.id,kind:'flight',status:'deleted'});assert.equal(store.get(job.id),null);assert.equal(store.authorize(job.id,owner),false);assert.equal(store.remove(job.id,owner),null);
 }finally{store.close();}
});

test('deleting completed jobs removes input, checkpoint, source observations and seller-offer recovery for every product',()=>{
 for(const kind of ['flight','comparison','calendar','hotel','package']){
  const store=createJobStore({path:':memory:'});
  try{const job=store.submit({birthDate:'1990-01-01'},`delete_${kind}`,{ownerToken:owner,kind}),claim=store.claim();store.checkpoint(job.id,claim.token,{private:'checkpoint'});store.finish(job.id,claim.token,{result:{offers:[{ignavId:'private_fare',segments:[{}]}]}});
   assert.ok(store.get(job.id));assert.equal(store.remove(job.id,owner).status,'deleted');assert.equal(store.get(job.id),null);assert.equal(store.findFlightOffer('private_fare',owner),null);assert.equal(store.finish(job.id,claim.token,{result:{private:'late'}}),false);
  }finally{store.close();}
 }
});

test('browser cancellation cleanup retains its serialization slot until deletion is safe',()=>{
 let now=Date.now();const store=createJobStore({path:':memory:',now:()=>now});
 try{const job=store.submit({},'browser_delete',{kind:'hotel',ownerToken:owner});store.claim();store.cancel(job.id);assert.throws(()=>store.remove(job.id,owner),/cleaning up/);assert.ok(store.get(job.id));now+=17001;assert.equal(store.remove(job.id,owner).status,'deleted');}
 finally{store.close();}
});
