import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {POST as calendar} from '../app/api/search/calendar/route.js';
import {POST as jobs} from '../app/api/search/jobs/route.js';
const input={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nights:5,adults:2,children:1,childrenAges:[10],cabin:'business',filters:{maxStops:0}};
const ownerToken='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';
const request=(body,headers={})=>new Request('http://127.0.0.1:3000/api/search/calendar',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json',...headers},body:JSON.stringify({ownerToken,...body})});
test('calendar enqueues validated exact queries, deduplicates and supports durable controls without requesting prices',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-api-')),previous=process.env.TRAVEL_JOB_DB;process.env.TRAVEL_JOB_DB=join(directory,'jobs.sqlite');
 try{
  const response=await calendar(request({...input,untrusted:{price:1}},{'Idempotency-Key':'calendar_request_123'}));assert.equal(response.status,202);assert.equal(response.headers.get('cache-control'),'no-store');
  const first=await response.json();assert.equal(first.kind,'calendar');assert.equal(first.status,'queued');assert.equal(first.input.untrusted,undefined);assert.deepEqual(first.input.childrenAges,[10]);assert.equal(first.result,null);
  const same=await calendar(request(input,{'Idempotency-Key':'calendar_request_123'}));assert.equal((await same.json()).id,first.id);
  const collision=await calendar(request({...input,nights:6},{'Idempotency-Key':'calendar_request_123'}));assert.equal(collision.status,400);
  for(const [action,status] of [['pause','paused'],['resume','queued'],['cancel','cancelled'],['status','cancelled']]){const r=await jobs(request({action,id:first.id}));assert.equal(r.status,200);assert.equal((await r.json()).status,status);}
  const generic=await jobs(request({action:'start',kind:'calendar',input,requestKey:'calendar_generic_123'}));assert.equal(generic.status,202);assert.equal((await generic.json()).kind,'calendar');
   const skyscanner=await calendar(request({...input,source:'skyscanner',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',searchLimit:1},{'Idempotency-Key':'calendar_skyscanner_123'}));assert.equal(skyscanner.status,202);assert.equal((await skyscanner.json()).input.source,'skyscanner');
   const all=await calendar(request({...input,source:'all',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',searchLimit:7},{'Idempotency-Key':'calendar_all_123'}));assert.equal(all.status,202);assert.equal((await all.json()).input.source,'all');
  const originAirports=Array.from({length:20},(_,i)=>`A${String.fromCharCode(65+i)}A`),destinationAirports=Array.from({length:20},(_,i)=>`B${String.fromCharCode(65+i)}B`);
  const expanded=await calendar(request({origin:'Large region',originType:'region',originAirports,destination:'Other region',destinationType:'region',destinationAirports,airportLimit:20,start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],cabin:'economy',source:'ignav',searchLimit:250},{'Idempotency-Key':'calendar_twenty_airports_123'}));
  assert.equal(expanded.status,202,JSON.stringify(await expanded.clone().json()));const expandedJob=await expanded.json();assert.equal(expandedJob.input.airportLimit,20);assert.equal(expandedJob.input.routePairs.length,400);await jobs(request({action:'cancel',id:expandedJob.id}));
   const region=await calendar(request({...input,origin:'Europe',originType:'region',originAirports:[]},{'Idempotency-Key':'calendar_region_unresolved_123'}));assert.equal(region.status,202);assert.deepEqual((await region.json()).input.originAirports,[]);
  const regional=await calendar(request({...input,origin:'Atlantic Canada',destination:'Southern California',originAirports:['YHZ','YUL'],destinationAirports:['LAX','SNA'],originType:'region',destinationType:'region',searchLimit:62},{'Idempotency-Key':'calendar_region_123'}));assert.equal(regional.status,202);const regionalJob=await regional.json();assert.equal(regionalJob.input.routePairs.length,4);assert.equal(regionalJob.input.originType,'region');
  assert.equal((await calendar(request({...input,childrenAges:[]}))).status,400);assert.equal((await calendar(request({...input,searchLimit:1}))).status,400);
  const overLimitOrigin=await calendar(request({...input,origin:'Origin region',originType:'region',originAirports:['YHZ','YUL'],destination:'LHR',destinationType:'place',destinationAirports:['LHR'],airportLimit:1,source:'ignav',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],searchLimit:1},{'Idempotency-Key':'calendar_airport_origin_limit_123'}));assert.equal(overLimitOrigin.status,400);assert.match((await overLimitOrigin.json()).error,/no more than 1 airport candidates/);
  const overLimitDestination=await calendar(request({...input,origin:'YHZ',originType:'place',originAirports:['YHZ'],destination:'Destination region',destinationType:'region',destinationAirports:['LHR','LGW'],airportLimit:1,source:'ignav',start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,adults:1,children:0,childrenAges:[],searchLimit:1},{'Idempotency-Key':'calendar_airport_destination_limit_123'}));assert.equal(overLimitDestination.status,400);assert.match((await overLimitDestination.json()).error,/no more than 1 airport candidates/);
  assert.equal((await calendar(request({...input,adults:undefined}))).status,400);assert.equal((await calendar(request(input,{origin:'https://external.example'}))).status,403);
  assert.equal((await calendar(request({...input,large:'x'.repeat(13000)}))).status,413);
 }finally{globalThis.__travelFlightJobStore?.close();delete globalThis.__travelFlightJobStore;if(previous===undefined)delete process.env.TRAVEL_JOB_DB;else process.env.TRAVEL_JOB_DB=previous;await rm(directory,{recursive:true,force:true});}
});
