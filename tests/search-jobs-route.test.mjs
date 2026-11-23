import test from 'node:test';
import assert from 'node:assert/strict';

test('flight job rejects ambiguous age-11 round trips before queueing',async()=>{
 process.env.TRAVEL_JOB_DB=':memory:';
 const [{getJobStore},{POST}]=await Promise.all([
  import('../lib/job-store.mjs'),
  import('../app/api/search/jobs/route.js'),
 ]);
 const store=getJobStore();
 const requestFor=(age,matrixOptions={maxExtraLegsRelativeToMinimum:1,allowAirportChanges:true})=>new Request('http://127.0.0.1/api/search/jobs',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({action:'start',kind:'flight',requestKey:`request_${age}`,ownerToken:'9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',input:{origin:'YHZ',destination:'YYZ',date:'2099-04-15',tripType:'round-trip',returnDate:'2099-04-25',cabin:'economy',adults:1,children:1,childrenAges:[age],matrixOptions,filters:{}}})});
 try{
  const ambiguous=await POST(requestFor(11)),error=await ambiguous.json();
  assert.equal(ambiguous.status,400);
  assert.match(error.error,/date of birth.*both travel dates/i);
  const accepted=await POST(requestFor(10));
  assert.equal(accepted.status,202);
  const invalidMatrix=await POST(requestFor(9,{maxExtraLegsRelativeToMinimum:6,allowAirportChanges:false}));
  assert.equal(invalidMatrix.status,400,'Server validation must reject an unsupported Matrix route setting before queueing.');
  const unsafeHotel=new Request('http://127.0.0.1/api/search/jobs',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({action:'start',kind:'hotel',requestKey:'hotel_multi_child',ownerToken:'9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',input:{city:'Example',checkin:'2099-04-15',checkout:'2099-04-20',adults:2,rooms:2,childrenAges:[7],minStars:4,hotelSource:'booking'}})});
  const rejected=await POST(unsafeHotel),hotelError=await rejected.json();
  assert.equal(rejected.status,400);
  assert.match(hotelError.error,/exact room allocations/i);
  const adultOnlyMultiRoom=new Request('http://127.0.0.1/api/search/jobs',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({action:'start',kind:'hotel',requestKey:'hotel_multi_adult_no_assignment',ownerToken:'9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',input:{city:'Example',checkin:'2099-04-15',checkout:'2099-04-20',adults:2,adultAges:[35,39],rooms:2,childrenAges:[],minStars:4,hotelSource:'booking'}})});
  const missingAssignments=await POST(adultOnlyMultiRoom),assignmentError=await missingAssignments.json();
  assert.equal(missingAssignments.status,400);
  assert.match(assignmentError.error,/exact room allocations/i);
 }finally{store.close();delete process.env.TRAVEL_JOB_DB;}
});

test('search job status and control actions require the capability that created the job',async()=>{
 process.env.TRAVEL_JOB_DB=':memory:';
 delete globalThis.__travelFlightJobStore;
 const [{getJobStore},{POST}]=await Promise.all([
  import('../lib/job-store.mjs'),
  import('../app/api/search/jobs/route.js'),
 ]);
 const store=getJobStore(),ownerToken='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';
 const request=(body)=>new Request('http://127.0.0.1/api/search/jobs',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify(body)});
 const input={origin:'YHZ',destination:'YYZ',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],filters:{}};
 try{
  const started=await POST(request({action:'start',kind:'flight',requestKey:'owned_job_123',ownerToken,input}));
  assert.equal(started.status,202);
  const job=await started.json();
  assert.equal((await POST(request({action:'status',id:job.id}))).status,404,'bare UUID must not grant job access');
  assert.equal((await POST(request({action:'cancel',id:job.id,ownerToken:'f26e51cc-1c31-4303-a631-1a99f3902430'}))).status,404,'another owner cannot control the job');
  const own=await POST(request({action:'status',id:job.id,ownerToken}));
  assert.equal(own.status,200);
  assert.equal((await own.json()).id,job.id);
  assert.equal((await POST(request({action:'cancel',id:job.id,ownerToken}))).status,200);
  assert.equal((await POST(request({action:'status',id:job.id,ownerToken})).then(r=>r.json())).status,'cancelled');
 }finally{store.close();delete globalThis.__travelFlightJobStore;delete process.env.TRAVEL_JOB_DB;}
});

test('search job API returns 429 when one owner reaches the durable active-job limit',async()=>{
 process.env.TRAVEL_JOB_DB=':memory:';
 delete globalThis.__travelFlightJobStore;
 const [{getJobStore},{POST}]=await Promise.all([import('../lib/job-store.mjs'),import('../app/api/search/jobs/route.js')]);
 const store=getJobStore(),ownerToken='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',otherOwner='f26e51cc-1c31-4303-a631-1a99f3902430';
 const input={origin:'YHZ',destination:'YYZ',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],filters:{}};
 const request=(owner,key)=>new Request('http://127.0.0.1/api/search/jobs',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({action:'start',kind:'flight',requestKey:key,ownerToken:owner,input})});
 try{
  for(let i=0;i<5;i++)assert.equal((await POST(request(ownerToken,`owner_limit_${i}`))).status,202);
  const limited=await POST(request(ownerToken,'owner_limit_5'));
  assert.equal(limited.status,429);
  assert.match((await limited.json()).error,/at most 5 active searches/);
  assert.equal((await POST(request(otherOwner,'other_owner_limit_0'))).status,202,'the owner limit is independent for each browser capability');
 }finally{store.close();delete globalThis.__travelFlightJobStore;delete process.env.TRAVEL_JOB_DB;}
});

test('search job API includes Retry-After for durable rolling-window limits',async()=>{
 delete globalThis.__travelFlightJobStore;
 const [{createJobStore},{POST}]=await Promise.all([import('../lib/job-store.mjs'),import('../app/api/search/jobs/route.js')]);
 let now=1000;
 const store=createJobStore({path:':memory:',now:()=>now,maxActive:20,maxActivePerOwner:20,maxStartsPerWindow:2,maxStartsPerOwnerPerWindow:2,startWindowMs:60000});
 globalThis.__travelFlightJobStore=store;
 const owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73',other='f26e51cc-1c31-4303-a631-1a99f3902430';
 const input={origin:'YHZ',destination:'YYZ',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,childrenAges:[],filters:{}};
 const request=(token,key)=>new Request('http://127.0.0.1/api/search/jobs',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({action:'start',kind:'flight',requestKey:key,ownerToken:token,input})});
 try{
  const first=await POST(request(owner,'start_window_a'));
  assert.equal(first.status,202);
  assert.equal((await POST(request(owner,'start_window_a'))).status,202,'idempotent retries stay available while starts are limited');
  assert.equal((await POST(request(other,'start_window_b'))).status,202);
  const limited=await POST(request(other,'start_window_c'));
  assert.equal(limited.status,429);
  assert.equal(limited.headers.get('retry-after'),'60');
  now+=60000;
  assert.equal((await POST(request(other,'start_window_c'))).status,202);
 }finally{store.close();delete globalThis.__travelFlightJobStore;}
});
