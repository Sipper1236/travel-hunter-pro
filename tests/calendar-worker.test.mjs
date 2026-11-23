import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../lib/job-store.mjs';
import {startSearchWorker} from '../lib/search-worker.mjs';
import {createRegionCache} from '../lib/region-cache.mjs';
const input={origin:'YHZ',destination:'BCN',start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nights:5,cabin:'business',adults:2,children:2,childrenAges:[10,15],searchLimit:3,filters:{maxStops:0}};
// Forked workers share CPU with Chromium fixtures; allow process startup without relaxing result assertions.
const waitFor=async predicate=>{const end=Date.now()+30000;while(!predicate()){if(Date.now()>end)throw Error('Calendar worker timed out.');await new Promise(r=>setTimeout(r,10));}};
test('calendar worker reuses an exact Ignav response after restart through the persistent job store',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-cache-worker-')),path=join(directory,'jobs.sqlite'),query={origin:'YHZ',destination:'BCN',originAirports:['YHZ'],destinationAirports:['BCN'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],searchLimit:1,filters:{},source:'ignav'};
 const children=[];let store,worker;
 const launch=()=>startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/calendar-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_IGNAV_CALENDAR_GRID:'0',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
 const run=async requestKey=>{const job=store.submit(query,requestKey,{kind:'calendar'});await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));return done.result;};
 try{
  store=createJobStore({path});worker=launch();
  const first=await run('calendar_cache_first');assert.equal(first.dates[0].providerCoverage.find(row=>row.provider==='Ignav')?.cacheStatus,undefined);
  worker.stop();worker=null;await waitFor(()=>children[0].exitCode!==null);store=null;
  store=createJobStore({path});worker=launch();
  const second=await run('calendar_cache_second');
  assert.equal(second.dates[0].providerCoverage.find(row=>row.provider==='Ignav')?.cacheStatus,'hit');
  assert.equal(second.dates[0].offer.observedAt,first.dates[0].offer.observedAt);
 }finally{if(worker){worker.stop();worker=null;store=null;}else store?.close();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
test('actual worker validates Ignav cheapest-dates as fast price-only calendar observations',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'ignav-grid-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker;
 const query={origin:'YHZ',destination:'BCN',originAirports:['YHZ'],destinationAirports:['BCN'],start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nights:5,cabin:'economy',adults:2,children:0,childrenAges:[],searchLimit:2,filters:{},source:'ignav'};
 try{
  const job=store.submit(query,'ignav_grid_worker_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/calendar-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_IGNAV_CALENDAR_GRID:'1',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.dates.map(cell=>[cell.status,cell.date,cell.returnDate,cell.priceObservations[0]?.price]),[['price_only_observed','2099-04-15','2099-04-20',500],['price_only_observed','2099-04-16','2099-04-21',500]]);
  assert.deepEqual(done.result.dates.map(cell=>cell.providerCoverage.find(row=>row.provider==='Ignav')?.wireResponses),[1,0]);
  assert.equal(done.result.coverage.fareRequestsStarted,2);assert.equal(done.result.dates.some(cell=>cell.offer),false);
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
test('actual worker prices native Google regional return/night combinations with the complete teen family',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'google-calendar-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker;
 const zones={YHZ:'America/Halifax',LHR:'Europe/London',BCN:'Europe/Madrid'};
 await createRegionCache({directory:join(directory,'timezones')})('world',async()=>({region:{name:'Airport IANA timezones'},airports:Object.entries(zones).map(([code,timeZone])=>({code,icao:`T${code}`,name:'Fixture airport',timeZone}))}));
 const regional={origin:'Canada',destination:'Europe',originType:'region',destinationType:'region',originAirports:['YHZ'],destinationAirports:['LHR','BCN'],start:'2099-04-15',end:'2099-04-15',source:'google',tripType:'round-trip',nightsMin:5,nightsMax:6,cabin:'economy',adults:2,children:1,childrenAges:[15],searchLimit:4,filters:{maxStops:0}};
 try{
  const job=store.submit(regional,'google_region_calendar_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/google-native-transport.mjs',import.meta.url).href],env:{...process.env,TRAVEL_GOOGLE_ROUND_TRIP:'1',TRAVEL_TIMEZONE_CACHE_DIR:join(directory,'timezones'),TRAVEL_JOB_DB:path},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  const end=Date.now()+60000;while(!['complete','error'].includes(store.get(job.id).status)){if(Date.now()>end)throw Error('Google native worker fixture timed out.');await new Promise(resolve=>setTimeout(resolve,25));}
  const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.query.childrenAges,[15]);
  assert.equal(done.result.coverage.pairQueriesPlanned,4,`Expected two return dates across two airport pairs: ${JSON.stringify(done.result.coverage)}`);
  assert.equal(done.result.coverage.pairQueriesChecked,4,`Expected each planned regional pair to complete: ${JSON.stringify(done.result)}`);
  assert.equal(done.result.coverage.fareRequestsStarted,4,`Expected one provider request per route/date pair: ${JSON.stringify(done.result.coverage)}`);
  assert.equal(done.result.coverage.fullyScanned,true);assert.equal(done.result.dates.length,2);
  for(const cell of done.result.dates){assert.equal(cell.offer.provider,'Google Flights');assert.equal(cell.offer.price,1200);assert.equal(cell.offer.inbound.departureDate,cell.returnDate);assert.equal(cell.offer.timeEvidence.status,'directory_validated');assert.deepEqual(cell.offer.googleParty,{adults:3,children:0,total:3});assert.equal(cell.providerCoverage[0].nativeCoverage.nativeRpcResponses,3);}
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
test('actual calendar runner reuses fresh dates after pause, preserves ages/cabin and stops on refusal',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker,refuse=false;
 try{
  const job=store.submit(input,'calendar_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/calendar-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_IGNAV_CALENDAR_GRID:'0',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'100',CALENDAR_TEST_REFUSAL:refuse?'1':'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>store.get(job.id).progress?.fareRequestsStarted===2);store.pause(job.id);await waitFor(()=>children[0].exitCode!==null);store.resume(job.id);
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.dates.map(d=>[d.price,d.returnDate]),[[500,'2099-04-20'],[500,'2099-04-21']]);assert.deepEqual(done.result.query.childrenAges,[10,15]);assert.ok(done.result.dates.every(d=>d.offer.cabin==='business'));
  assert.equal(done.result.coverage.responsesReused,1);assert.equal(done.result.coverage.interruptedRequests,1);assert.equal(done.result.coverage.fareRequestsStarted,3);
  // Use a distinct exact query so the fresh response cached by the prior job
  // cannot mask the fixture's provider refusal path.
  refuse=true;const refused=store.submit({...input,filters:{maxStops:1}},'calendar_456',{kind:'calendar'});await waitFor(()=>store.get(refused.id).status==='complete');const result=store.get(refused.id).result;
  assert.equal(result.status,'source_unavailable');assert.equal(result.dates[0].price,500);assert.equal(result.dates[1].status,'not_scanned');assert.equal(result.stopped.source.status,'rate_limited');assert.ok(result.stopped.source.retryAt);assert.equal(result.coverage.fullyScanned,false);
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
test('durable calendar runner searches each resolved regional airport pair and returns the exact winning route',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-region-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker;
 const regional={origin:'Atlantic Canada',destination:'Southern California',originType:'region',destinationType:'region',originAirports:['YHZ','YUL'],destinationAirports:['LAX','SNA'],start:'2099-04-15',end:'2099-04-15',tripType:'one-way',nights:null,cabin:'economy',adults:1,children:0,childrenAges:[],searchLimit:4,filters:{}};
 try{
  const job=store.submit(regional,'calendar_region_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/calendar-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_IGNAV_CALENDAR_GRID:'0',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.query.originAirports,['YHZ','YUL']);assert.deepEqual(done.result.query.destinationAirports,['LAX','SNA']);assert.equal(done.result.coverage.pairQueriesPlanned,4);assert.equal(done.result.coverage.pairQueriesChecked,4);assert.equal(done.result.coverage.fullyScanned,true);
  assert.equal(done.result.dates[0].offer.from,'YHZ');assert.equal(done.result.dates[0].offer.to,'LAX');assert.equal(done.result.dates[0].route.origin,'YHZ');assert.equal(done.result.dates[0].route.destination,'LAX');
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});

test('durable calendar runner preserves independent departure and return ranges',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-region-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker;
 const regional={origin:'Atlantic Canada',destination:'Southern California',originType:'region',destinationType:'region',originAirports:['YHZ'],destinationAirports:['LAX'],start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nights:null,returnStart:'2099-04-20',returnEnd:'2099-04-21',cabin:'economy',adults:1,children:0,childrenAges:[],searchLimit:4,filters:{}};
 try{
  const job=store.submit(regional,'calendar_region_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/calendar-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_IGNAV_CALENDAR_GRID:'0',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.dates.map(row=>[row.date,row.returnDate]),[['2099-04-15','2099-04-20'],['2099-04-15','2099-04-21'],['2099-04-16','2099-04-20'],['2099-04-16','2099-04-21']]);assert.ok(done.result.dates.every(row=>row.offer?.inbound.departureDate===row.returnDate));assert.equal(done.result.coverage.pairQueriesPlanned,4);assert.equal(done.result.coverage.pairQueriesChecked,4);assert.equal(done.result.coverage.fullyScanned,true);
  assert.equal(done.result.dates[0].offer.from,'YHZ');assert.equal(done.result.dates[0].offer.to,'LAX');assert.equal(done.result.dates[0].route.origin,'YHZ');assert.equal(done.result.dates[0].route.destination,'LAX');
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});

test('durable calendar runner prices regional night ranges in the actual worker',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-region-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker;
 const regional={origin:'Atlantic Canada',destination:'Southern California',originType:'region',destinationType:'region',originAirports:['YHZ'],destinationAirports:['LAX'],start:'2099-04-15',end:'2099-04-16',tripType:'round-trip',nights:null,nightsMin:5,nightsMax:6,cabin:'economy',adults:1,children:0,childrenAges:[],searchLimit:4,filters:{}};
 try{
  const job=store.submit(regional,'calendar_region_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/calendar-transport.mjs',import.meta.url).href],env:{...process.env,IGNAV_API_KEY:'test-only-no-real-key',TRAVEL_IGNAV_CALENDAR_GRID:'0',TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.dates.map(row=>[row.date,row.returnDate]),[['2099-04-15','2099-04-20'],['2099-04-15','2099-04-21'],['2099-04-16','2099-04-21'],['2099-04-16','2099-04-22']]);assert.ok(done.result.dates.every(row=>row.offer?.inbound.departureDate===row.returnDate));assert.equal(done.result.coverage.pairQueriesPlanned,4);assert.equal(done.result.coverage.pairQueriesChecked,4);assert.equal(done.result.coverage.fullyScanned,true);
  assert.equal(done.result.dates[0].offer.from,'YHZ');assert.equal(done.result.dates[0].offer.to,'LAX');assert.equal(done.result.dates[0].route.origin,'YHZ');assert.equal(done.result.dates[0].route.destination,'LAX');
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});

test('durable calendar runner prices timezone-validated Skyscanner regional returns',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-region-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker;
 const regional={origin:'Canada',destination:'Europe',originType:'region',destinationType:'region',originAirports:['YHZ'],destinationAirports:['BCN'],start:'2099-04-15',end:'2099-04-16',source:'skyscanner',tripType:'round-trip',nights:null,nightsMin:5,nightsMax:6,cabin:'economy',adults:1,children:0,childrenAges:[],searchLimit:4,filters:{}};
 try{
  const job=store.submit(regional,'calendar_region_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/skyscanner-calendar-transport.mjs',import.meta.url).href],env:{...process.env,SKYSCANNER_API_KEY:'test-only-no-real-key',TRAVEL_TIMEZONE_CACHE_DIR:join(directory,'timezones'),TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.dates.map(row=>[row.date,row.returnDate]),[['2099-04-15','2099-04-20'],['2099-04-15','2099-04-21'],['2099-04-16','2099-04-21'],['2099-04-16','2099-04-22']]);assert.ok(done.result.dates.every(row=>row.offer?.inbound.departureDate===row.returnDate));assert.equal(done.result.coverage.pairQueriesPlanned,4);assert.equal(done.result.coverage.pairQueriesChecked,4);assert.equal(done.result.coverage.fullyScanned,true);
  assert.equal(done.result.dates[0].offer.timeEvidence.status,'directory_validated');assert.equal(done.result.dates[0].offer.from,'YHZ');assert.equal(done.result.dates[0].offer.to,'BCN');assert.equal(done.result.dates[0].route.origin,'YHZ');assert.equal(done.result.dates[0].route.destination,'BCN');
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});

test('durable calendar runner prices identified Skyscanner families without identity leakage',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'calendar-region-worker-')),path=join(directory,'jobs.sqlite'),store=createJobStore({path}),children=[];let worker;
 const regional={origin:'Canada',destination:'Europe',originType:'region',destinationType:'region',originAirports:['YHZ'],destinationAirports:['BCN'],start:'2099-04-15',end:'2099-04-16',source:'skyscanner',tripType:'round-trip',nights:null,nightsMin:5,nightsMax:6,cabin:'economy',travelers:[{id:'adult',birthDate:'2060-01-01'},{id:'child',birthDate:'2089-05-01',guardianId:'adult'}],searchLimit:4,filters:{}};
 try{
  const job=store.submit(regional,'calendar_region_123',{kind:'calendar'});
  worker=startSearchWorker({store,pollMs:10,spawn:()=>{const child=fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{execArgv:['--import',new URL('./fixtures/skyscanner-calendar-transport.mjs',import.meta.url).href],env:{...process.env,SKYS_TEST_FAMILY:'1',SKYSCANNER_API_KEY:'test-only-no-real-key',TRAVEL_TIMEZONE_CACHE_DIR:join(directory,'timezones'),TRAVEL_JOB_DB:path,TRAVEL_SOURCE_GAP_MS:'0'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);return child;}});
  await waitFor(()=>['complete','error'].includes(store.get(job.id).status));const done=store.get(job.id);assert.equal(done.status,'complete',JSON.stringify(done.error));
  assert.deepEqual(done.result.dates.map(row=>[row.date,row.returnDate]),[['2099-04-15','2099-04-20'],['2099-04-15','2099-04-21'],['2099-04-16','2099-04-21'],['2099-04-16','2099-04-22']]);assert.ok(done.result.dates.every(row=>row.offer?.inbound.departureDate===row.returnDate));assert.equal(done.result.coverage.pairQueriesPlanned,4);assert.equal(done.result.coverage.pairQueriesChecked,4);assert.equal(done.result.coverage.fullyScanned,true);
  assert.equal(done.result.dates[0].offer.timeEvidence.status,'directory_validated');assert.equal(done.result.dates[0].offer.from,'YHZ');assert.equal(done.result.dates[0].offer.to,'BCN');assert.equal(done.result.dates[0].route.origin,'YHZ');assert.equal(done.result.dates[0].route.destination,'BCN');
 }finally{worker?.stop();for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});
