import test from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST} from '../app/api/health/route.js';
import {createJobStore} from '../lib/job-store.mjs';

const request=({host='127.0.0.1:3000',origin='http://127.0.0.1:3000'}={})=>new Request('http://127.0.0.1:3000/api/health',{headers:{host,...(origin?{origin}:{})}});

test('local health endpoint reports aggregate queue and worker status without job data',async()=>{
 const store=createJobStore({path:':memory:'}),prior=globalThis.__travelFlightJobStore;
 globalThis.__travelFlightJobStore=store;
 try{
  const idle=await (await GET(request())).json();
  assert.equal(idle.status,'degraded');assert.equal(idle.queueDepth,0);assert.equal(idle.workerAvailable,false);
  store.submit({privateInput:'must not appear'},'health_request_1',{kind:'package'});
  const response=await GET(request()),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.status,'degraded');assert.equal(body.queueDepth,1);assert.equal(body.workerAvailable,false);assert.equal(body.queue['package.queued'],1);assert.equal(body.expiredLeases,0);assert.equal(JSON.stringify(body).includes('privateInput'),false);
  store.workerHeartbeat('worker-test','package');
  const healthy=await (await GET(request())).json();assert.equal(healthy.status,'ok');assert.equal(healthy.workerAvailable,true);assert.equal(healthy.workers.records[0].activeKind,'package');
 }finally{store.close();if(prior===undefined)delete globalThis.__travelFlightJobStore;else globalThis.__travelFlightJobStore=prior;}
});

test('local health endpoint rejects absent, remote or cross-origin callers',async()=>{
 for(const headers of [{origin:null},{host:'travel.example',origin:'http://travel.example'},{origin:'http://localhost:3000'}])assert.equal((await GET(request(headers))).status,403);
});

test('same-origin POST health supports browser clients without changing job state',async()=>{
 const store=createJobStore({path:':memory:'}),prior=globalThis.__travelFlightJobStore;globalThis.__travelFlightJobStore=store;
 try{
  const before=store.operationalSnapshot();
  const response=await POST(new Request('http://127.0.0.1:3000/api/health',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:'{}'})),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.status,'degraded');assert.equal(body.workerAvailable,false);assert.deepEqual(body.queue,{});assert.deepEqual(store.operationalSnapshot().queue,before.queue);
  store.workerHeartbeat('browser-health-worker','flight');
  const healthy=await (await POST(new Request('http://127.0.0.1:3000/api/health',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:'{}'}))).json();
  assert.equal(healthy.status,'ok');assert.equal(healthy.workerAvailable,true);
 }finally{store.close();if(prior===undefined)delete globalThis.__travelFlightJobStore;else globalThis.__travelFlightJobStore=prior;}
});
